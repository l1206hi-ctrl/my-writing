import { elements } from '../elements.js';
import { setSidebarWidth } from '../ui.js';

export function bindWorkspaceResizer() {
  if (!elements.workspaceResizer || !elements.workspace) {
    return;
  }
  let active = false;
  const onMouseMove = (event) => {
    if (!active) {
      return;
    }
    const bounds = elements.workspace.getBoundingClientRect();
    const width = event.clientX - bounds.left;
    setSidebarWidth(width);
  };
  const stopDragging = () => {
    if (!active) {
      return;
    }
    active = false;
    document.body.classList.remove('resizing');
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stopDragging);
  };
  elements.workspaceResizer.addEventListener('mousedown', (event) => {
    event.preventDefault();
    active = true;
    document.body.classList.add('resizing');
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopDragging);
  });
  elements.workspaceResizer.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    const current = Number.parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '0',
      10
    );
    const delta = event.key === 'ArrowLeft' ? -10 : 10;
    setSidebarWidth(current + delta);
  });
}
