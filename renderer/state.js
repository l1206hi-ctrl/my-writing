export function createInitialState(overrides = {}) {
  return {
    projectPath: null,
    projectName: null,
    docs: [],
    binder: { rootIds: [], nodes: {}, order: [] },
    currentDocId: null,
    currentDoc: null,
    docMetaCollapsed: false,
    selectedDocId: null,
    selectedBinderNodeId: null,
    collapsedFolderIds: new Set(),
    dirty: false,
    fontSize: 18,
    chapterFilterQuery: '',
    binderPinnedOnly: false,
    localFindQuery: '',
    localFindResults: [],
    globalSearchQuery: '',
    globalSearchResults: [],
    docStats: new Map(),
    totalCounts: { withSpaces: 0, withoutSpaces: 0 },
    currentCounts: { withSpaces: 0, withoutSpaces: 0 },
    selectionCounts: { withSpaces: 0, withoutSpaces: 0 },
    selectionActive: false,
    viewMode: 'editor',
    boardQuery: '',
    boardStatusFilter: 'all',
    boardMissingSynopsisOnly: false,
    projectMeta: null,
    openProjectNoteId: null,
    activeProjectNoteId: null,
    historyEntries: [],
    mobilePreviewOpen: false,
    focusMode: false,
    characters: [],
    characterFormId: null,
    ...overrides,
  };
}

export const state = createInitialState();

export function resetProjectState(project = null) {
  const preserved = {
    docMetaCollapsed: state.docMetaCollapsed,
    fontSize: state.fontSize,
  };
  Object.assign(
    state,
    createInitialState({
      projectPath: project && project.path ? project.path : null,
      projectName: project && project.name ? project.name : null,
    }),
    preserved
  );
}
