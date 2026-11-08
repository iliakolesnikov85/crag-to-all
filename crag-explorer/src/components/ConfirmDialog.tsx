import { useId } from 'react';
import Button from './Button';
import Modal from './Modal';
import './ConfirmDialog.scss';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  onResult: (confirmed: boolean) => void;
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onResult,
}: ConfirmDialogProps) {
  const messageId = `${useId().replace(/:/g, '')}-message`;

  return (
    <Modal
      open
      compact
      title={title}
      describedBy={messageId}
      onClose={() => onResult(false)}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            initialFocus={destructive}
            aria-describedby={messageId}
            onClick={() => onResult(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'primary'}
            initialFocus={!destructive}
            aria-describedby={messageId}
            onClick={() => onResult(true)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p id={messageId} className="confirm-dialog-message">{message}</p>
    </Modal>
  );
}

export default ConfirmDialog;
