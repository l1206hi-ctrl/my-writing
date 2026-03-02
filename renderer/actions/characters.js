import { elements } from '../elements.js';
import { state } from '../state.js';
import {
  applyViewMode,
  clearCharacterFormUI,
  populateCharacterForm,
  renderCharacterList,
  setStatus,
  updateCurrentDocLabel,
} from '../ui.js';

function parseTags(value) {
  return String(value || '')
    .split(',')
    .map((segment) => segment.trim().replace(/^#+/, ''))
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
}

function getCharacterFormPayload() {
  if (!elements.characterName) {
    return null;
  }
  const name = elements.characterName.value.trim();
  if (!name) {
    return null;
  }
  const role = elements.characterRole ? elements.characterRole.value.trim() : '';
  const description = elements.characterDescription
    ? elements.characterDescription.value.trim()
    : '';
  const tags = elements.characterTags ? parseTags(elements.characterTags.value) : [];
  return {
    id: state.characterFormId,
    name,
    role,
    description,
    tags,
  };
}

export async function refreshCharacters() {
  if (!state.projectPath) {
    state.characters = [];
    renderCharacterList();
    return;
  }
  try {
    const chars = await window.api.listCharacters(state.projectPath);
    state.characters = Array.isArray(chars) ? chars : [];
  } catch (error) {
    state.characters = [];
  }
  renderCharacterList();
}

export function startNewCharacter() {
  state.characterFormId = null;
  clearCharacterFormUI();
  state.selectedDocId = null;
  state.viewMode = 'character';
  applyViewMode();
  updateCurrentDocLabel();
  renderCharacterList();
  if (elements.characterName) {
    elements.characterName.focus();
  }
}

export function startCharacterEdit(characterId) {
  const character = state.characters.find((item) => item.id === characterId);
  if (!character) {
    return;
  }
  state.characterFormId = character.id;
  renderCharacterList();
  state.selectedDocId = null;
  state.viewMode = 'character';
  applyViewMode();
  updateCurrentDocLabel();
  populateCharacterForm(character);
  if (elements.characterName) {
    elements.characterName.focus();
  }
}

export async function deleteCharacterEntry(characterId) {
  if (!state.projectPath || !characterId) {
    return;
  }
  try {
    const deleted = await window.api.deleteCharacter(state.projectPath, characterId);
    if (!deleted) {
      setStatus('Unable to find character.', true);
      return;
    }
    await refreshCharacters();
    state.characterFormId = null;
    clearCharacterFormUI();
    setStatus('Character removed.');
  } catch (error) {
    setStatus(error.message || 'Delete failed.', true);
  }
}

export async function saveCharacterForm() {
  if (!state.projectPath) {
    setStatus('Open or create a project first.', true);
    return;
  }
  const payload = getCharacterFormPayload();
  if (!payload) {
    setStatus('Name is required.', true);
    return;
  }
  const isEdit = Boolean(payload.id);
  const data = { ...payload };
  if (!isEdit) {
    delete data.id;
  }
  try {
    const saved = isEdit
      ? await window.api.updateCharacter(state.projectPath, data)
      : await window.api.createCharacter(state.projectPath, data);
    if (!saved) {
      setStatus('Character save failed.', true);
      return;
    }
    await refreshCharacters();
    state.characterFormId = null;
    clearCharacterFormUI();
    setStatus(isEdit ? 'Character updated.' : 'Character added.');
  } catch (error) {
    setStatus(error.message || 'Character save failed.', true);
  }
}

export async function handleCharacterListClick(event) {
  if (!(event.target instanceof HTMLElement)) {
    return;
  }
  const entry = event.target.closest('.character-entry');
  if (!entry) {
    return;
  }
  const id = entry.dataset.id;
  const action = event.target.dataset.action;
  if (!id) {
    return;
  }
  if (action === 'delete') {
    await deleteCharacterEntry(id);
    return;
  }
  startCharacterEdit(id);
}
