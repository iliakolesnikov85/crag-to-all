import React, { useEffect, useId, useState } from 'react';
import type { DescriptionSection } from '../types';
import {
  DESCRIPTION_NAME_MAX_LENGTH,
  isEmptyHtml,
  sectionHtmlToParagraphs,
} from '../utils/descriptionHtml';
import Button from './Button';
import Modal from './Modal';
import RichTextInput from './RichTextInput';
import './DescriptionSectionModal.scss';

interface DescriptionSectionModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initialName: string;
  initialHtml: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (section: DescriptionSection) => void;
}

const DescriptionSectionModal: React.FC<DescriptionSectionModalProps> = ({
  open,
  mode,
  initialName,
  initialHtml,
  saving,
  error,
  onClose,
  onSave,
}) => {
  const formId = useId().replace(/:/g, '');
  const nameId = `${formId}-name`;
  const [name, setName] = useState(initialName);
  const [html, setHtml] = useState(initialHtml);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setHtml(initialHtml);
    setLocalError(null);
  }, [open, initialName, initialHtml]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setLocalError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setLocalError('Enter a section name.');
      return;
    }
    let paragraphs: string[];
    try {
      paragraphs = sectionHtmlToParagraphs(html);
    } catch (submitError) {
      console.error('Could not read section contents:', submitError);
      setLocalError(
        submitError instanceof Error ? submitError.message : 'Could not read section contents.',
      );
      return;
    }
    if (paragraphs.length === 0) {
      setLocalError('Enter the section contents.');
      return;
    }
    onSave({ subheader: trimmedName, paragraphs });
  };

  const canSave = name.trim().length > 0 && !isEmptyHtml(html) && !saving;
  const shownError = localError ?? error;

  return (
    <Modal
      open={open}
      title={mode === 'add' ? 'Add section' : 'Edit section'}
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!canSave}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <form id={formId} className="description-section-form" onSubmit={handleSubmit}>
        {shownError ? (
          <p className="description-form-error" role="alert">
            {shownError}
          </p>
        ) : null}
        <label className="description-field" htmlFor={nameId}>
          <span className="description-field-label">Name</span>
          <input
            id={nameId}
            className="description-name-input"
            value={name}
            maxLength={DESCRIPTION_NAME_MAX_LENGTH}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <RichTextInput label="Contents" value={html} onChange={setHtml} />
      </form>
    </Modal>
  );
};

export default DescriptionSectionModal;
