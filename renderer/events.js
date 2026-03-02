import { bindClickHandlers } from './events/clicks.js';
import { bindDragHandlers } from './events/drag.js';
import { bindWorkspaceResizer } from './events/workspace.js';

export function bindEvents() {
  bindDragHandlers();
  bindClickHandlers();
  bindWorkspaceResizer();
}
