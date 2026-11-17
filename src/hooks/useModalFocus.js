import { useEffect, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalFocus(dialogRef, { enabled = true, onEscape, initialFocusSelector } = {}) {
  const escapeRef = useRef(onEscape);
  const selectorRef = useRef(initialFocusSelector);

  useEffect(() => { escapeRef.current = onEscape; }, [onEscape]);
  useEffect(() => { selectorRef.current = initialFocusSelector; }, [initialFocusSelector]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!enabled || !dialog) return undefined;

    const previousFocus = document.activeElement;
    const focusables = () => [...dialog.querySelectorAll(FOCUSABLE)]
      .filter(element => element.getClientRects().length > 0);
    const focusInitial = () => {
      const preferred = selectorRef.current ? dialog.querySelector(selectorRef.current) : null;
      (preferred || focusables()[0] || dialog).focus();
    };

    const onKeyDown = event => {
      if (event.key === 'Escape' && escapeRef.current) {
        event.preventDefault();
        escapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = focusables();
      if (!controls.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    const onFocusIn = event => {
      if (!dialog.contains(event.target)) focusInitial();
    };

    focusInitial();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [dialogRef, enabled]);
}

