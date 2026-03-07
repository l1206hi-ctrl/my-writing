const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ensureStore,
  readIndex,
  readDocFile,
  repairStore,
  writeJsonAtomic,
} = require('../store/io');
const { getStoreDir, getIndexPath } = require('../store/paths');

async function createTempProjectPath() {
  return fs.promises.mkdtemp(path.join(os.tmpdir(), 'inkfold-io-test-'));
}

test('writeJsonAtomic writes valid JSON without leftover temp files', async () => {
  const projectPath = await createTempProjectPath();
  const filePath = path.join(projectPath, 'sample.json');

  await writeJsonAtomic(filePath, { value: 1 });
  await writeJsonAtomic(filePath, { value: 2 });

  const raw = await fs.promises.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  assert.equal(parsed.value, 2);

  const entries = await fs.promises.readdir(projectPath);
  const tempFiles = entries.filter((name) => name.includes('.tmp-'));
  assert.equal(tempFiles.length, 0);

  await fs.promises.rm(projectPath, { recursive: true, force: true });
});

test('repairStore recovers corrupted index and document files', async () => {
  const projectPath = await createTempProjectPath();
  await ensureStore(projectPath);

  const storeDir = getStoreDir(projectPath);
  const indexPath = getIndexPath(projectPath);
  const brokenDocPath = path.join(storeDir, 'doc_sample.json');

  await fs.promises.writeFile(indexPath, '{"docs":', 'utf-8');
  await fs.promises.writeFile(brokenDocPath, '{"title":', 'utf-8');

  const result = await repairStore(projectPath);

  assert.ok(Array.isArray(result.repaired));
  assert.ok(result.repaired.includes('index.json'));
  assert.ok(result.repaired.includes('doc_sample.json'));

  const index = await readIndex(projectPath);
  assert.ok(index.docs.doc_sample);

  const recoveredDoc = await readDocFile(brokenDocPath);
  assert.equal(recoveredDoc.title, 'Recovered sample');

  const storeFiles = await fs.promises.readdir(storeDir);
  assert.ok(storeFiles.some((name) => name.startsWith('index.json.corrupt-')));
  assert.ok(storeFiles.some((name) => name.startsWith('doc_sample.json.corrupt-')));

  await fs.promises.rm(projectPath, { recursive: true, force: true });
});
