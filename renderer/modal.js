import { elements } from './elements.js';

let modalResolver = null;

export function isModalOpen() {
  return !elements.modalOverlay.classList.contains('hidden');
}

export function closeModal(result) {
  if (!modalResolver) {
    return;
  }
  const resolve = modalResolver;
  modalResolver = null;
  elements.modalOverlay.classList.add('hidden');
  resolve(result);
}

export function requestText({ title, placeholder, value, confirmLabel }) {
  if (modalResolver) {
    closeModal(null);
  }
  return new Promise((resolve) => {
    modalResolver = resolve;
    elements.modalTitle.textContent = title || 'Enter value';
    elements.modalInput.value = value || '';
    elements.modalInput.placeholder = placeholder || '';
    elements.modalConfirm.textContent = confirmLabel || 'OK';
    elements.modalOverlay.classList.remove('hidden');
    setTimeout(() => {
      elements.modalInput.focus();
      elements.modalInput.select();
    }, 0);
  });
}
