import { elements } from '../elements.js';
import { state } from '../state.js';

export function renderCharacterList() {
  if (!elements.characterList) {
    return;
  }
  elements.characterList.innerHTML = '';
  if (!state.characters.length) {
    const empty = document.createElement('div');
    empty.className = 'file-item empty';
    empty.textContent = 'No characters captured yet.';
    elements.characterList.appendChild(empty);
    return;
  }
  state.characters.forEach((character) => {
    const entry = document.createElement('div');
    entry.className = 'character-entry';
    entry.dataset.id = character.id;
    if (state.characterFormId === character.id) {
      entry.classList.add('active');
    }

    const info = document.createElement('div');
    info.className = 'character-entry-info';

    const name = document.createElement('span');
    name.className = 'character-entry-name';
    name.textContent = character.name || 'Unnamed character';
    info.appendChild(name);

    const role = document.createElement('span');
    role.className = 'character-entry-role';
    role.textContent = character.role || 'Role pending';
    info.appendChild(role);

    entry.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'character-entry-actions';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'mini ghost danger';
    remove.textContent = 'Delete';
    remove.dataset.action = 'delete';

    actions.appendChild(remove);
    entry.appendChild(actions);

    elements.characterList.appendChild(entry);
  });
}

function setCharacterFormButtonText(isEditing) {
  if (elements.btnSaveCharacter) {
    elements.btnSaveCharacter.textContent = isEditing ? 'Save changes' : 'Save character';
  }
}

export function populateCharacterForm(character) {
  if (!elements.characterName) {
    return;
  }
  elements.characterName.value = character?.name || '';
  if (elements.characterRole) {
    elements.characterRole.value = character?.role || '';
  }
  if (elements.characterTags) {
    elements.characterTags.value = Array.isArray(character?.tags) ? character.tags.join(', ') : '';
  }
  if (elements.characterDescription) {
    elements.characterDescription.value = character?.description || '';
  }
  setCharacterFormButtonText(Boolean(character));
}

export function clearCharacterFormUI() {
  if (!elements.characterName) {
    return;
  }
  elements.characterName.value = '';
  if (elements.characterRole) {
    elements.characterRole.value = '';
  }
  if (elements.characterTags) {
    elements.characterTags.value = '';
  }
  if (elements.characterDescription) {
    elements.characterDescription.value = '';
  }
  setCharacterFormButtonText(false);
}
