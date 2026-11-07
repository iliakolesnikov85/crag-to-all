import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MdClose } from 'react-icons/md';
import { setBodyScrollLock } from '../utils/bodyScrollLock';
import Button from './Button';
import './Modal.scss';

/** Open dialogs, oldest first. Escape closes only the latest one. */
const openDialogs: Array<{ close: () => void }> = [];

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
}

const Modal: React.FC<ModalProps> = ({
  open,
  title,
  onClose,
  children,
  footer,
  closeOnBackdrop = true,
  wide = false,
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
    const field = dialog?.querySelector<HTMLElement>(
      '.modal-body input, .modal-body textarea, .modal-body select, .modal-body [contenteditable="true"]',
    );
    (field ?? dialog)?.focus();

    const entry = { close: () => onCloseRef.current() };
    openDialogs.push(entry);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (openDialogs[openDialogs.length - 1] !== entry) return;
      event.preventDefault();
      entry.close();
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

  return createPortal(
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        className={wide ? 'modal-panel modal-panel--wide' : 'modal-panel'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
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
