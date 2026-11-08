import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MdClose } from 'react-icons/md';
import { setBodyScrollLock } from '../utils/bodyScrollLock';
import Button from './Button';
import './Modal.scss';

/** Open dialogs, oldest first. Escape closes only the latest one, and Tab stays inside it. */
const openDialogs: Array<{ close: () => void }> = [];

const TABBABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]',
].join(', ');

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Form dialogs keep edits when the press lands outside the panel. */
  closeOnBackdrop?: boolean;
  /** Photo dialogs need more than the default form width. */
  wide?: boolean;
  /** Short prompts stay a small dialog on a phone. */
  compact?: boolean;
  /** Id of the text that explains this dialog. Focused actions repeat it. */
  describedBy?: string;
}

function isTabbable(element: HTMLElement): boolean {
  if (element.closest('[hidden], [inert]')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (element.getAttribute('tabindex') === '-1') return false;
  if (element.getAttribute('contenteditable') === 'true') return true;
  return element.tabIndex >= 0;
}

function tabbableElements(dialog: HTMLElement): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const items: HTMLElement[] = [];
  dialog.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR).forEach((element) => {
    if (seen.has(element) || !isTabbable(element)) return;
    seen.add(element);
    items.push(element);
  });
  return items;
}

function keepTabInside(dialog: HTMLElement, event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const items = tabbableElements(dialog);
  if (items.length === 0) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const inside = active instanceof HTMLElement && dialog.contains(active) && active !== dialog;
  if (!inside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

const Modal: React.FC<ModalProps> = ({
  open,
  title,
  onClose,
  children,
  footer,
  closeOnBackdrop = true,
  wide = false,
  compact = false,
  describedBy,
}) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBodyScrollLock(true);

    const dialog = dialogRef.current;
    const preferred = dialog?.querySelector<HTMLElement>('[data-initial-focus]');
    const field = dialog?.querySelector<HTMLElement>(
      '.modal-body input, .modal-body textarea, .modal-body select, .modal-body [contenteditable="true"]',
    );
    (preferred ?? field ?? dialog)?.focus();

    const entry = { close: () => onCloseRef.current() };
    openDialogs.push(entry);

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs[openDialogs.length - 1] !== entry) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        entry.close();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialogNode = dialogRef.current;
      if (!dialogNode) return;
      keepTabInside(dialogNode, event);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = openDialogs.lastIndexOf(entry);
      if (index >= 0) openDialogs.splice(index, 1);
      setBodyScrollLock(false);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (event.target !== event.currentTarget) return;
    onCloseRef.current();
  };

  const backdropClass = compact ? 'modal-backdrop modal-backdrop--compact' : 'modal-backdrop';
  const panelClass = [
    'modal-panel',
    wide ? 'modal-panel--wide' : '',
    compact ? 'modal-panel--compact' : '',
  ].filter(Boolean).join(' ');

  return createPortal(
    <div className={backdropClass} onMouseDown={handleBackdropMouseDown}>
      <div
        className={panelClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        ref={dialogRef}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          <Button
            type="button"
            iconOnly
            size="sm"
            variant="ghost"
            aria-label="Close"
            aria-describedby={describedBy}
            onClick={() => onCloseRef.current()}
          >
            <MdClose />
          </Button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
