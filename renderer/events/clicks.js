import { FONT_STEP } from '../constants.js';
import { elements } from '../elements.js';
import { closeModal, isModalOpen, requestText } from '../modal.js';
import { state } from '../state.js';
import {
  closeCurrentDocFind,
  applyProject,
  closeGlobalSearch,
  closeHistory,
  createChapter,
  convertDocToProjectNote,
  convertProjectNoteToChapter,
  createFolder,
  createProjectNote,
  deleteFolder,
  deleteProjectNote,
  deleteSelectedDoc,
  exportProject,
  handleCharacterListClick,
  handleCurrentDocFindInput,
  handleDocFieldChange,
  handleGlobalSearchInput,
  handleProjectNoteChange,
  handleSearchInput,
  findInCurrentDoc,
  findNoteNodeId,
  loadDoc,
  refreshCurrentDocFind,
  openCurrentDocFind,
  openCurrentDocFindResult,
  openGlobalSearch,
  openGlobalSearchResult,
  openHistory,
  renameFolder,
  renameProjectNote,
  toggleProjectNotePinned,
  renameSelectedDoc,
  restoreHistory,
  saveCharacterForm,
  saveDoc,
  startNewCharacter,
  toggleBinderPinnedOnly,
  toggleFolderCollapsed,
  toggleBoardMode,
  toggleDocPinned,
  toggleFocusMode,
  toggleMobilePreview,
} from '../actions.js';
import {
  applyFontSize,
  applyViewMode,
  refreshCurrentCounts,
  refreshSelectionCounts,
  renderDocList,
  renderBoard,
  renderProjectNoteEditor,
  renderProjectNotes,
  setStatus,
  toggleDocMetaCollapsed,
  updateActionState,
} from '../ui.js';

function getRowFromEvent(event) {
  if (!(event.target instanceof HTMLElement)) {
    return null;
  }
  return event.target.closest('.item-row');
}

let binderMenuTarget = null;

function isBinderMenuOpen() {
  return Boolean(elements.binderContextMenu && !elements.binderContextMenu.classList.contains('hidden'));
}

function closeBinderContextMenu() {
  if (!elements.binderContextMenu) {
    return;
  }
  elements.binderContextMenu.classList.add('hidden');
  binderMenuTarget = null;
}

function openBinderContextMenu(event, target) {
  if (!elements.binderContextMenu) {
    return;
  }
  binderMenuTarget = target;
  if (elements.binderMenuConvert) {
    if (target.type === 'folder') {
      elements.binderMenuConvert.classList.add('hidden');
      elements.binderMenuConvert.disabled = true;
    } else {
      const convertLabel = target.type === 'doc' ? 'Convert to Note' : 'Convert to Chapter';
      elements.binderMenuConvert.textContent = convertLabel;
      elements.binderMenuConvert.disabled = false;
      elements.binderMenuConvert.classList.remove('hidden');
    }
  }
  elements.binderContextMenu.classList.remove('hidden');

  const menuRect = elements.binderContextMenu.getBoundingClientRect();
  const padding = 8;
  const maxLeft = window.innerWidth - menuRect.width - padding;
  const maxTop = window.innerHeight - menuRect.height - padding;
  const left = Math.max(padding, Math.min(event.clientX, maxLeft));
  const top = Math.max(padding, Math.min(event.clientY, maxTop));

  elements.binderContextMenu.style.left = `${left}px`;
  elements.binderContextMenu.style.top = `${top}px`;
}

export function bindClickHandlers() {
  elements.fileList.addEventListener('click', (event) => {
    if (isBinderMenuOpen()) {
      closeBinderContextMenu();
    }
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const pinToggle = event.target.closest('[data-action="toggle-pin"]');
    if (pinToggle && pinToggle.dataset.docId) {
      event.preventDefault();
      toggleDocPinned(pinToggle.dataset.docId);
      return;
    }
    if (pinToggle && pinToggle.dataset.noteId) {
      event.preventDefault();
      toggleProjectNotePinned(pinToggle.dataset.noteId);
      return;
    }
    const toggle = event.target.closest('[data-action="toggle-folder"]');
    if (toggle && toggle.dataset.nodeId) {
      toggleFolderCollapsed(toggle.dataset.nodeId);
      return;
    }
    const row = getRowFromEvent(event);
    if (!row) {
      return;
    }
    const rowType = row.dataset.type || 'doc';
    const nodeId = row.dataset.nodeId || null;
    if (rowType === 'folder') {
      state.selectedDocId = null;
      state.selectedBinderNodeId = nodeId;
      state.activeProjectNoteId = null;
      state.viewMode = 'editor';
      updateActionState();
      renderDocList();
      applyViewMode();
      return;
    }
    if (rowType === 'note') {
      const noteId = row.dataset.noteId || '';
      if (!noteId) {
        return;
      }
      state.selectedDocId = null;
      state.selectedBinderNodeId = nodeId;
      state.activeProjectNoteId = noteId;
      state.viewMode = 'project-note';
      updateActionState();
      renderDocList();
      renderProjectNotes();
      renderProjectNoteEditor();
      applyViewMode();
      return;
    }
    const docId = row.dataset.id;
    if (!docId) {
      return;
    }
    state.selectedBinderNodeId = nodeId;
    state.selectedDocId = docId;
    state.activeProjectNoteId = null;
    updateActionState();
    renderDocList();
    state.viewMode = 'editor';
    loadDoc(docId);
  });

  elements.fileList.addEventListener('contextmenu', (event) => {
    const row = getRowFromEvent(event);
    if (!row) {
      return;
    }
    const rowType = row.dataset.type || '';
    if (rowType !== 'doc' && rowType !== 'note' && rowType !== 'folder') {
      return;
    }
    event.preventDefault();
    const nodeId = row.dataset.nodeId || null;

    if (rowType === 'folder') {
      if (!nodeId) {
        return;
      }
      state.selectedDocId = null;
      state.selectedBinderNodeId = nodeId;
      state.activeProjectNoteId = null;
      state.viewMode = 'editor';
      updateActionState();
      renderDocList();
      applyViewMode();
      openBinderContextMenu(event, { type: 'folder', nodeId });
      return;
    }

    if (rowType === 'doc') {
      const docId = row.dataset.id || '';
      if (!docId) {
        return;
      }
      state.selectedDocId = docId;
      state.selectedBinderNodeId = nodeId;
      state.activeProjectNoteId = null;
      state.viewMode = 'editor';
      updateActionState();
      renderDocList();
      openBinderContextMenu(event, { type: 'doc', nodeId, docId });
      return;
    }

    const noteId = row.dataset.noteId || '';
    if (!noteId) {
      return;
    }
    state.selectedDocId = null;
    state.selectedBinderNodeId = nodeId;
    state.activeProjectNoteId = noteId;
    state.viewMode = 'project-note';
    updateActionState();
    renderDocList();
    openBinderContextMenu(event, { type: 'note', nodeId, noteId });
  });

  if (elements.binderContextMenu) {
    elements.binderContextMenu.addEventListener('click', async (event) => {
      if (!(event.target instanceof HTMLElement) || !binderMenuTarget) {
        return;
      }
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) {
        return;
      }
      const action = actionButton.dataset.action;
      const target = binderMenuTarget;
      closeBinderContextMenu();

      if (target.type === 'folder') {
        if (action === 'rename') {
          await renameFolder(target.nodeId);
          return;
        }
        if (action === 'delete') {
          await deleteFolder(target.nodeId);
        }
        return;
      }

      if (target.type === 'doc') {
        if (action === 'rename') {
          await renameSelectedDoc();
          return;
        }
        if (action === 'delete') {
          await deleteSelectedDoc();
          return;
        }
        if (action === 'convert') {
          await convertDocToProjectNote(target.docId);
        }
        return;
      }

      if (target.type === 'note') {
        if (action === 'rename') {
          await renameProjectNote(target.noteId);
          return;
        }
        if (action === 'delete') {
          await deleteProjectNote(target.noteId);
          return;
        }
        if (action === 'convert') {
          await convertProjectNoteToChapter(target.noteId);
        }
      }
    });
  }

  elements.boardGrid.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const pinToggle = event.target.closest('[data-action="toggle-pin"]');
    if (pinToggle && pinToggle.dataset.docId) {
      event.preventDefault();
      toggleDocPinned(pinToggle.dataset.docId);
      return;
    }
    const card = event.target.closest('.board-card');
    if (!card || !card.dataset.id) {
      return;
    }
    loadDoc(card.dataset.id);
    state.activeProjectNoteId = null;
    state.viewMode = 'editor';
    applyViewMode();
  });
  if (elements.boardSearchInput) {
    elements.boardSearchInput.addEventListener('input', (event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      state.boardQuery = String(event.target.value || '');
      renderBoard();
    });
  }
  if (elements.boardStatusFilter) {
    elements.boardStatusFilter.addEventListener('change', (event) => {
      if (!(event.target instanceof HTMLSelectElement)) {
        return;
      }
      const next = String(event.target.value || 'all').toLowerCase();
      state.boardStatusFilter = next || 'all';
      renderBoard();
    });
  }
  if (elements.boardMissingSynopsisOnly) {
    elements.boardMissingSynopsisOnly.addEventListener('change', (event) => {
      if (!(event.target instanceof HTMLInputElement)) {
        return;
      }
      state.boardMissingSynopsisOnly = Boolean(event.target.checked);
      renderBoard();
    });
  }
  if (elements.btnBoardResetFilters) {
    elements.btnBoardResetFilters.addEventListener('click', () => {
      state.boardQuery = '';
      state.boardStatusFilter = 'all';
      state.boardMissingSynopsisOnly = false;
      if (elements.boardSearchInput) {
        elements.boardSearchInput.value = '';
      }
      if (elements.boardStatusFilter) {
        elements.boardStatusFilter.value = 'all';
      }
      if (elements.boardMissingSynopsisOnly) {
        elements.boardMissingSynopsisOnly.checked = false;
      }
      renderBoard();
    });
  }

  elements.btnNewProject.addEventListener('click', async () => {
    try {
      const name = String(
        await requestText({
          title: 'Project name',
          placeholder: 'My Manuscript',
          value: 'My Manuscript',
          confirmLabel: 'Create',
        })
      ).trim();
      if (!name) {
        return;
      }
      const project = await window.api.createProject(name);
      await applyProject(project, 'Project created.');
    } catch (error) {
      setStatus(error.message || 'Unable to create project.', true);
    }
  });

  elements.btnOpenProject.addEventListener('click', async () => {
    try {
      const project = await window.api.openProject();
      await applyProject(project, 'Project loaded.');
    } catch (error) {
      setStatus(error.message || 'Unable to open project.', true);
    }
  });

  elements.btnNewFile.addEventListener('click', createChapter);
  if (elements.btnNewFolder) {
    elements.btnNewFolder.addEventListener('click', createFolder);
  }
  if (elements.btnNewNote) {
    elements.btnNewNote.addEventListener('click', createProjectNote);
  }
  if (elements.btnBinderPinnedOnly) {
    elements.btnBinderPinnedOnly.addEventListener('click', () => toggleBinderPinnedOnly());
  }
  if (elements.btnFindInChapter) {
    elements.btnFindInChapter.addEventListener('click', openCurrentDocFind);
  }
  if (elements.btnGlobalSearch) {
    elements.btnGlobalSearch.addEventListener('click', openGlobalSearch);
  }
  if (elements.btnHistory) {
    elements.btnHistory.addEventListener('click', openHistory);
  }
  if (elements.btnExportDoc) {
    elements.btnExportDoc.addEventListener('click', () => exportProject('doc'));
  }
  if (elements.btnExportPdf) {
    elements.btnExportPdf.addEventListener('click', () => exportProject('pdf'));
  }
  if (elements.btnMobilePreview) {
    elements.btnMobilePreview.addEventListener('click', () => toggleMobilePreview());
  }
  elements.btnSave.addEventListener('click', () => saveDoc());
  if (elements.btnToggleBoard) {
    elements.btnToggleBoard.addEventListener('click', toggleBoardMode);
  }
  if (elements.btnFocus) {
    elements.btnFocus.addEventListener('click', () => toggleFocusMode());
  }
  if (elements.btnTogglePin) {
    elements.btnTogglePin.addEventListener('click', () => {
      if (state.viewMode === 'project-note' && state.activeProjectNoteId) {
        toggleProjectNotePinned(state.activeProjectNoteId);
        return;
      }
      toggleDocPinned(state.currentDocId);
    });
  }
  elements.btnAddProjectNote.addEventListener('click', createProjectNote);
  if (elements.characterList) {
    elements.characterList.addEventListener('click', handleCharacterListClick);
  }
  if (elements.btnSaveCharacter) {
    elements.btnSaveCharacter.addEventListener('click', saveCharacterForm);
  }
  if (elements.btnNewCharacter) {
    elements.btnNewCharacter.addEventListener('click', startNewCharacter);
  }
  elements.btnFontSmaller.addEventListener('click', () => {
    applyFontSize(state.fontSize - FONT_STEP);
  });
  elements.btnFontLarger.addEventListener('click', () => {
    applyFontSize(state.fontSize + FONT_STEP);
  });
  if (elements.btnToggleDocMeta) {
    elements.btnToggleDocMeta.addEventListener('click', toggleDocMetaCollapsed);
  }

  elements.searchInput.addEventListener('input', handleSearchInput);

  elements.globalSearchInput.addEventListener('input', handleGlobalSearchInput);
  elements.globalSearchClose.addEventListener('click', closeGlobalSearch);
  elements.globalSearchOverlay.addEventListener('click', (event) => {
    if (event.target === elements.globalSearchOverlay) {
      closeGlobalSearch();
    }
  });

  elements.globalSearchResults.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const item = event.target.closest('.search-item');
    if (!item || !item.dataset.id) {
      return;
    }
    openGlobalSearchResult({
      id: item.dataset.id,
      type: item.dataset.type,
      field: item.dataset.field,
    });
  });

  if (elements.localFindInput) {
    elements.localFindInput.addEventListener('input', handleCurrentDocFindInput);
  }
  if (elements.localFindClose) {
    elements.localFindClose.addEventListener('click', closeCurrentDocFind);
  }
  if (elements.localFindOverlay) {
    elements.localFindOverlay.addEventListener('click', (event) => {
      if (event.target === elements.localFindOverlay) {
        closeCurrentDocFind();
      }
    });
  }
  if (elements.localFindResults) {
    elements.localFindResults.addEventListener('click', (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      const colTarget = event.target.closest('[data-find-index]');
      if (colTarget && colTarget.dataset.findIndex) {
        const colIndex = Number.parseInt(colTarget.dataset.findIndex, 10);
        if (Number.isFinite(colIndex)) {
          openCurrentDocFindResult(colIndex, { closeOverlay: true });
        }
        return;
      }
      const item = event.target.closest('.search-item');
      if (!item || !item.dataset.index) {
        return;
      }
      const index = Number.parseInt(item.dataset.index, 10);
      if (Number.isFinite(index)) {
        openCurrentDocFindResult(index, { closeOverlay: true });
      }
    });
  }

  elements.editorText.addEventListener('input', (event) => {
    handleDocFieldChange('text', event.target.value);
    refreshCurrentDocFind();
  });

  elements.editorText.addEventListener('select', refreshSelectionCounts);
  elements.editorText.addEventListener('keyup', refreshSelectionCounts);
  elements.editorText.addEventListener('mouseup', refreshSelectionCounts);

  elements.editorNotes.addEventListener('input', (event) => {
    handleDocFieldChange('notes', event.target.value);
  });

  elements.docTitle.addEventListener('input', (event) => {
    handleDocFieldChange('title', event.target.value);
  });

  elements.docSynopsis.addEventListener('input', (event) => {
    handleDocFieldChange('synopsis', event.target.value);
  });

  elements.docPov.addEventListener('input', (event) => {
    handleDocFieldChange('pov', event.target.value);
  });

  elements.docStatus.addEventListener('change', (event) => {
    handleDocFieldChange('status', event.target.value);
  });

  elements.projectNoteEditor.addEventListener('input', (event) => {
    if (!state.activeProjectNoteId) {
      return;
    }
    handleProjectNoteChange(state.activeProjectNoteId, event.target.value);
    refreshCurrentDocFind();
    refreshCurrentCounts();
    refreshSelectionCounts();
  });

  elements.projectNoteEditor.addEventListener('select', refreshSelectionCounts);
  elements.projectNoteEditor.addEventListener('keyup', refreshSelectionCounts);
  elements.projectNoteEditor.addEventListener('mouseup', refreshSelectionCounts);

  elements.btnRenameProjectNote.addEventListener('click', () => {
    if (state.activeProjectNoteId) {
      renameProjectNote(state.activeProjectNoteId);
    }
  });

  elements.btnDeleteProjectNote.addEventListener('click', () => {
    if (state.activeProjectNoteId) {
      deleteProjectNote(state.activeProjectNoteId);
    }
  });

  elements.projectNotesList.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const rename = event.target.closest('.note-rename');
    if (rename) {
      const wrapper = rename.closest('.project-note');
      if (wrapper && wrapper.dataset.id) {
        renameProjectNote(wrapper.dataset.id);
      }
      return;
    }
    const remove = event.target.closest('.note-delete');
    if (remove) {
      const wrapper = remove.closest('.project-note');
      if (wrapper && wrapper.dataset.id) {
        deleteProjectNote(wrapper.dataset.id);
      }
      return;
    }
    const wrapper = event.target.closest('.project-note');
    if (!wrapper || !wrapper.dataset.id) {
      return;
    }
    const id = wrapper.dataset.id;
    state.activeProjectNoteId = id;
    state.selectedBinderNodeId = findNoteNodeId(id);
    state.selectedDocId = null;
    state.viewMode = 'project-note';
    renderProjectNotes();
    renderProjectNoteEditor();
    applyViewMode();
  });

  elements.modalCancel.addEventListener('click', () => closeModal(null));
  elements.modalConfirm.addEventListener('click', () =>
    closeModal(elements.modalInput.value)
  );
  elements.modalOverlay.addEventListener('click', (event) => {
    if (event.target === elements.modalOverlay) {
      closeModal(null);
    }
  });
  elements.modalInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      closeModal(elements.modalInput.value);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (isBinderMenuOpen() && event.key === 'Escape') {
      event.preventDefault();
      closeBinderContextMenu();
      return;
    }
    if (isModalOpen() && event.key === 'Escape') {
      event.preventDefault();
      closeModal(null);
      return;
    }
    if (elements.localFindOverlay && !elements.localFindOverlay.classList.contains('hidden') && event.key === 'Escape') {
      event.preventDefault();
      closeCurrentDocFind();
      return;
    }
    if (!elements.globalSearchOverlay.classList.contains('hidden') && event.key === 'Escape') {
      event.preventDefault();
      closeGlobalSearch();
      return;
    }
    if (!elements.historyOverlay.classList.contains('hidden') && event.key === 'Escape') {
      event.preventDefault();
      closeHistory();
      return;
    }
    if (event.key === 'Escape' && state.focusMode) {
      event.preventDefault();
      toggleFocusMode(false);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveDoc();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault();
      if (event.shiftKey) {
        openGlobalSearch();
        return;
      }
      openCurrentDocFind();
      return;
    }
    if (event.key === 'F3') {
      event.preventDefault();
      findInCurrentDoc(event.shiftKey ? -1 : 1);
    }
  });

  document.addEventListener('mousedown', (event) => {
    if (!isBinderMenuOpen() || !elements.binderContextMenu) {
      return;
    }
    if (event.target instanceof Node && elements.binderContextMenu.contains(event.target)) {
      return;
    }
    closeBinderContextMenu();
  });

  elements.historyClose.addEventListener('click', closeHistory);
  elements.historyOverlay.addEventListener('click', (event) => {
    if (event.target === elements.historyOverlay) {
      closeHistory();
    }
  });
  elements.historyList.addEventListener('click', (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }
    const action = event.target.closest('[data-action="restore"]');
    if (!action) {
      return;
    }
    const id = action.dataset.id;
    if (id) {
      restoreHistory(id);
    }
  });

  if (elements.btnMobilePreviewClose) {
    elements.btnMobilePreviewClose.addEventListener('click', () => toggleMobilePreview(false));
  }
  if (elements.mobilePreviewOverlay) {
    elements.mobilePreviewOverlay.addEventListener('click', (event) => {
      if (event.target === elements.mobilePreviewOverlay) {
        toggleMobilePreview(false);
      }
    });
  }
}
