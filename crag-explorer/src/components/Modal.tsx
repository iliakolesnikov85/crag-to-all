import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MdClose } from 'react-icons/md';
import { setBodyScrollLock } from '../utils/bodyScrollLock';
import Button from './Button';
import './Modal.scss';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, footer }) => {
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

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      setBodyScrollLock(false);
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    onCloseRef.current();
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown}>
      <div
        className="modal-panel"
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
