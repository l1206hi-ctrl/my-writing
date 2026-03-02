import { restoreLastProject } from './actions.js';
import { bindEvents } from './events.js';
import {
  applyViewMode,
  loadDocMetaCollapsed,
  initChapterScrollSizing,
  loadFontSize,
  loadSidebarWidth,
  setStatus,
  updateActionState,
  updateCurrentDocLabel,
  updateProjectInfo,
} from './ui.js';

export function initApp() {
  bindEvents();
  updateProjectInfo();
  updateCurrentDocLabel();
  applyViewMode();
  updateActionState();
  loadFontSize();
  loadDocMetaCollapsed();
  loadSidebarWidth();
  initChapterScrollSizing();
  setStatus('Ready.');
  restoreLastProject();
}
