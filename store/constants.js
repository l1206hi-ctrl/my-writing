const STORE_DIR = '._scriv';
const INDEX_FILE = 'index.json';
const PROJECT_FILE = 'project.json';
const HISTORY_DIR = 'history';
const CHARACTERS_FILE = 'characters.json';
const STATUS_VALUES = new Set(['draft', 'revise', 'done']);
const HISTORY_LIMIT = 30;
const HISTORY_INTERVAL = 2 * 60 * 1000;

const DOC_TEMPLATE = {
  title: '',
  synopsis: '',
  status: 'draft',
  pinned: false,
  pov: '',
  notes: '',
  text: '',
};

const PROJECT_TEMPLATE = {
  notes: [
    { id: 'synopsis', title: 'Synopsis', content: '', pinned: false },
    { id: 'intro', title: 'Intro', content: '', pinned: false },
  ],
};

module.exports = {
  STORE_DIR,
  INDEX_FILE,
  PROJECT_FILE,
  HISTORY_DIR,
  CHARACTERS_FILE,
  STATUS_VALUES,
  HISTORY_LIMIT,
  HISTORY_INTERVAL,
  DOC_TEMPLATE,
  PROJECT_TEMPLATE,
};
