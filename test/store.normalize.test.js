const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeDoc,
  normalizeIndex,
  normalizeProject,
  normalizeCharacters,
} = require('../store/normalize');

test('normalizeDoc coerces fields and guards invalid status', () => {
  const normalized = normalizeDoc({
    title: 123,
    synopsis: null,
    status: 'invalid',
    pinned: 'yes',
    pov: 456,
    notes: undefined,
    text: 'hello',
  });

  assert.equal(normalized.title, '123');
  assert.equal(normalized.synopsis, '');
  assert.equal(normalized.status, 'draft');
  assert.equal(normalized.pinned, true);
  assert.equal(normalized.pov, '456');
  assert.equal(normalized.notes, '');
  assert.equal(normalized.text, 'hello');
});

test('normalizeIndex migrates legacy order/docs into v2 node structure', () => {
  const normalized = normalizeIndex({
    docs: {
      doc_a: { file: 'doc_a.json' },
      doc_b: { file: 'doc_b.json' },
    },
    order: ['doc_b', 'missing', 'doc_b'],
  });

  assert.equal(normalized.version, 2);
  assert.deepEqual(normalized.order, ['doc_b', 'doc_a']);
  assert.equal(normalized.rootIds.length, 2);
  assert.equal(Object.keys(normalized.docs).length, 2);

  normalized.rootIds.forEach((nodeId) => {
    assert.equal(normalized.nodes[nodeId].type, 'doc');
  });
});

test('normalizeIndex removes duplicate doc nodes and prevents folder cycles', () => {
  const normalized = normalizeIndex({
    docs: {
      doc1: { file: 'doc1.json' },
    },
    nodes: {
      f1: { id: 'f1', type: 'folder', children: ['f2'] },
      f2: { id: 'f2', type: 'folder', parentId: 'f1', children: ['f1', 'n1'] },
      n1: { id: 'n1', type: 'doc', docId: 'doc1', parentId: 'f2' },
      n2: { id: 'n2', type: 'doc', docId: 'doc1' },
    },
    rootIds: ['f1', 'n2'],
  });

  const docNodes = Object.values(normalized.nodes).filter(
    (node) => node.type === 'doc' && node.docId === 'doc1'
  );

  assert.equal(docNodes.length, 1);
  assert.deepEqual(normalized.order, ['doc1']);
  assert.ok(!normalized.nodes.f2.children.includes('f1'));
});

test('normalizeProject keeps unique notes and migrates legacy fields', () => {
  const normalized = normalizeProject({
    notes: [
      { id: 'custom', title: 'A', content: 'one' },
      { id: 'custom', title: 'B', content: 'two' },
    ],
    synopsis: 'syn',
    intro: 'int',
    setting: 'set',
  });

  const ids = normalized.notes.map((note) => note.id);

  assert.deepEqual(ids.slice(0, 3), ['setting', 'intro', 'synopsis']);
  assert.equal(ids.filter((id) => id === 'custom').length, 1);
});

test('normalizeCharacters trims fields and resolves duplicate ids', () => {
  const normalized = normalizeCharacters([
    {
      id: 'char_a',
      name: ' Alice ',
      role: ' Lead ',
      description: ' Hero ',
      tags: [' brave ', '', null],
      linkedChapters: ['doc1', ' ', 'doc2'],
    },
    { id: 'char_a', name: 'Bob' },
    { name: 'Charlie' },
  ]);

  assert.equal(normalized.length, 3);
  assert.equal(normalized[0].id, 'char_a');
  assert.equal(normalized[0].name, 'Alice');
  assert.equal(normalized[0].role, 'Lead');
  assert.equal(normalized[0].description, 'Hero');
  assert.deepEqual(normalized[0].tags, ['brave']);
  assert.deepEqual(normalized[0].linkedChapters, ['doc1', 'doc2']);

  assert.notEqual(normalized[1].id, 'char_a');
  assert.ok(normalized[1].id.startsWith('char_a_'));
  assert.ok(/^char_/.test(normalized[2].id));
});
