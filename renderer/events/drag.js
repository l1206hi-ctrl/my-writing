import { refreshDocs } from '../actions.js';
import { elements } from '../elements.js';
import { state } from '../state.js';
import { setStatus } from '../ui.js';

let listDragSource = null;
let boardDragSource = null;

function getRowFromEvent(event) {
  if (!(event.target instanceof HTMLElement)) {
    return null;
  }
  return event.target.closest('.item-row');
}

export function bindDragHandlers() {
  function clearRowDropState(row) {
    if (!row) {
      return;
    }
    row.classList.remove('drag-over');
    row.classList.remove('drag-over-before');
    row.classList.remove('drag-over-after');
    row.classList.remove('drag-over-inside');
    delete row.dataset.dropPosition;
  }

  function clearListDragOver() {
    elements.fileList.querySelectorAll('.item-row').forEach((node) => {
      clearRowDropState(node);
    });
  }

  function getSiblingNodeIds(parentId) {
    if (parentId && state.binder.nodes[parentId] && state.binder.nodes[parentId].type === 'folder') {
      const children = state.binder.nodes[parentId].children;
      return Array.isArray(children) ? children : [];
    }
    return Array.isArray(state.binder.rootIds) ? state.binder.rootIds : [];
  }

  function getDropPosition(row, event) {
    const rect = row.getBoundingClientRect();
    const relativeY = event.clientY - rect.top;
    const ratio = rect.height > 0 ? relativeY / rect.height : 0.5;
    const rowType = row.dataset.type || '';
    if (rowType === 'folder') {
      if (ratio < 0.25) {
        return 'before';
      }
      if (ratio > 0.75) {
        return 'after';
      }
      return 'inside';
    }
    return ratio < 0.5 ? 'before' : 'after';
  }

  function clearBoardDragOver() {
    elements.boardGrid.querySelectorAll('.drag-over').forEach((node) => {
      node.classList.remove('drag-over');
    });
  }

  elements.fileList.addEventListener('dragstart', (event) => {
    const row = getRowFromEvent(event);
    if (!row || !row.dataset.nodeId || !['doc', 'note', 'folder'].includes(row.dataset.type || '')) {
      return;
    }
    listDragSource = row;
    row.classList.add('dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', row.dataset.nodeId || '');
    }
  });

  elements.fileList.addEventListener('dragover', (event) => {
    if (!listDragSource) {
      return;
    }
    const row = getRowFromEvent(event);
    if (!row) {
      event.preventDefault();
      clearListDragOver();
      return;
    }
    if (row === listDragSource || !row.dataset.nodeId) {
      return;
    }
    event.preventDefault();
    clearListDragOver();
    const dropPosition = getDropPosition(row, event);
    row.dataset.dropPosition = dropPosition;
    row.classList.add('drag-over');
    row.classList.add(`drag-over-${dropPosition}`);
  });

  elements.fileList.addEventListener('dragleave', (event) => {
    const row = getRowFromEvent(event);
    if (row) {
      clearRowDropState(row);
    }
  });

  elements.fileList.addEventListener('drop', async (event) => {
    if (!listDragSource) {
      return;
    }
    const sourceNodeId = String(listDragSource.dataset.nodeId || '').trim();
    if (!sourceNodeId) {
      return;
    }

    const row = getRowFromEvent(event);
    if (row && row === listDragSource) {
      event.preventDefault();
      clearListDragOver();
      return;
    }
    let parentId = null;
    let targetIndex = null;

    if (row && row !== listDragSource && row.dataset.nodeId) {
      const targetType = row.dataset.type || '';
      const targetNodeId = String(row.dataset.nodeId || '').trim();
      const dropPosition = row.dataset.dropPosition || getDropPosition(row, event);
      if (!targetNodeId) {
        return;
      }
      if (targetType === 'folder' && dropPosition === 'inside') {
        parentId = targetNodeId;
        const siblings = getSiblingNodeIds(parentId);
        targetIndex = siblings.length;
      } else {
        parentId =
          targetType === 'folder'
            ? String(row.dataset.parentId || '').trim() || null
            : String(row.dataset.parentId || '').trim() || null;
        const siblings = getSiblingNodeIds(parentId);
        const idx = siblings.indexOf(targetNodeId);
        const offset = dropPosition === 'after' ? 1 : 0;
        targetIndex = idx >= 0 ? idx + offset : siblings.length;
      }
    } else {
      parentId = null;
      const siblings = getSiblingNodeIds(parentId);
      const firstRow = elements.fileList.querySelector('.item-row');
      if (firstRow) {
        const firstRect = firstRow.getBoundingClientRect();
        targetIndex = event.clientY < firstRect.top ? 0 : siblings.length;
      } else {
        targetIndex = siblings.length;
      }
    }

    try {
      event.preventDefault();
      await window.api.moveBinderNode(state.projectPath, sourceNodeId, parentId, targetIndex);
    } catch (error) {
      setStatus(error.message || 'Move failed.', true);
    }
    clearListDragOver();
    await refreshDocs();
  });

  elements.fileList.addEventListener('dragend', () => {
    if (listDragSource) {
      listDragSource.classList.remove('dragging');
    }
    listDragSource = null;
    clearListDragOver();
  });

  elements.boardGrid.addEventListener('dragstart', (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const card = event.target.closest('.board-card');
    if (!card || card.getAttribute('draggable') !== 'true') {
      return;
    }
    boardDragSource = card;
    card.classList.add('dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.nodeId || card.dataset.id || '');
    }
  });

  elements.boardGrid.addEventListener('dragover', (event) => {
    if (!boardDragSource || !(event.target instanceof HTMLElement)) {
      return;
    }
    event.preventDefault();
    const card = event.target.closest('.board-card');
    clearBoardDragOver();
    if (!card || card === boardDragSource) {
      return;
    }
    card.classList.add('drag-over');
  });

  elements.boardGrid.addEventListener('dragleave', (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const card = event.target.closest('.board-card');
    if (card) {
      card.classList.remove('drag-over');
    }
  });

  elements.boardGrid.addEventListener('drop', async (event) => {
    if (!boardDragSource) {
      return;
    }
    event.preventDefault();
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const card = event.target.closest('.board-card');
    if (card === boardDragSource) {
      clearBoardDragOver();
      return;
    }

    const sourceNodeId = String(boardDragSource.dataset.nodeId || '').trim();
    if (!sourceNodeId) {
      clearBoardDragOver();
      return;
    }

    let parentId = null;
    let targetIndex = null;
    if (card && card.dataset.nodeId) {
      const targetNodeId = String(card.dataset.nodeId || '').trim();
      parentId = String(card.dataset.parentId || '').trim() || null;
      const siblings = getSiblingNodeIds(parentId);
      const idx = siblings.indexOf(targetNodeId);
      targetIndex = idx >= 0 ? idx : siblings.length;
    } else {
      parentId = String(boardDragSource.dataset.parentId || '').trim() || null;
      const siblings = getSiblingNodeIds(parentId);
      targetIndex = siblings.length;
    }

    try {
      await window.api.moveBinderNode(state.projectPath, sourceNodeId, parentId, targetIndex);
    } catch (error) {
      setStatus(error.message || 'Reorder failed.', true);
    }
    clearBoardDragOver();
    await refreshDocs();
  });

  elements.boardGrid.addEventListener('dragend', () => {
    if (boardDragSource) {
      boardDragSource.classList.remove('dragging');
    }
    boardDragSource = null;
    clearBoardDragOver();
  });
}
