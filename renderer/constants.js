export const DEFAULT_DOC = {
  title: '',
  synopsis: '',
  status: 'draft',
  pinned: false,
  pov: '',
  notes: '',
  text: '',
};

export const DEFAULT_PROJECT_META = {
  notes: [
    { id: 'synopsis', title: 'Synopsis', content: '', pinned: false },
    { id: 'intro', title: 'Intro', content: '', pinned: false },
  ],
};

export const STATUS_VALUES = new Set(['draft', 'revise', 'done']);

export const FONT_KEY = 'inkfold.fontSize';
export const DOC_META_COLLAPSED_KEY = 'inkfold.docMetaCollapsed';
export const LAST_PROJECT_KEY = 'inkfold.lastProject';
export const LAST_DOC_KEY = 'inkfold.lastDoc';
export const FONT_MIN = 14;
export const FONT_MAX = 28;
export const FONT_STEP = 1;
export const SEARCH_DELAY = 250;
export const AUTO_SAVE_DELAY = 600;
export const PROJECT_SAVE_DELAY = 800;
export const SIDEBAR_WIDTH_KEY = 'inkfold.sidebarWidth';
export const SIDEBAR_WIDTH_MIN = 220;
export const SIDEBAR_WIDTH_MAX = 520;
