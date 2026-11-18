import React, { useId, useState } from 'react';
import {
  CRAG_EXTERNAL_ID_MAX_LENGTH,
  CRAG_ID_MAX_LENGTH,
  CRAG_NAME_MAX_LENGTH,
  validateCragExternalId,
  validateCragId,
  validateCragName,
} from '@crag-to-all/shared-crag';
import type { CragCreateInput } from '../../api/client';
import type { Crag, CragSource } from '../../types';
import Button from '../Button';
import Modal from '../Modal';
import './CragManageModal.scss';

interface FieldErrors {
  id?: string;
  name?: string;
  externalId?: string;
}

interface CragManageModalProps {
  mode: 'create' | 'edit';
  crag: Crag | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: CragCreateInput) => void;
  onRename: (name: string) => void;
}

const CragManageModal: React.FC<CragManageModalProps> = ({
  mode,
  crag,
  saving,
  error,
  onClose,
  onCreate,
  onRename,
}) => {
  const formId = useId().replace(/:/g, '');
  const idField = `${formId}-id`;
  const nameField = `${formId}-name`;
  const sourceField = `${formId}-source`;
  const externalField = `${formId}-external`;
  const editedCrag = mode === 'edit' ? crag : null;
  const readOnly = editedCrag?.source === 'external';
  const [id, setId] = useState(editedCrag?.id ?? '');
  const [name, setName] = useState(editedCrag?.cragName ?? '');
  const [source, setSource] = useState<CragSource>(
    editedCrag?.source === 'external' ? 'external' : 'explorer',
  );
  const [externalId, setExternalId] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const clearError = (field: keyof FieldErrors) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || readOnly) return;
    if (editedCrag) {
      const nameResult = validateCragName(name);
      if (!nameResult.ok) {
        setFieldErrors({ name: nameResult.error });
        return;
      }
      if (nameResult.value === editedCrag.cragName) {
        onClose();
        return;
      }
      setFieldErrors({});
      onRename(nameResult.value);
      return;
    }
    const idResult = validateCragId(id);
    const nameResult = validateCragName(name);
    const externalResult = source === 'external' ? validateCragExternalId(externalId) : undefined;
    const errors: FieldErrors = {};
    if (!idResult.ok) errors.id = idResult.error;
    if (!nameResult.ok) errors.name = nameResult.error;
    if (externalResult && !externalResult.ok) errors.externalId = externalResult.error;
    if (!idResult.ok || !nameResult.ok || (externalResult != null && !externalResult.ok)) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    const input: CragCreateInput = {
      id: idResult.value,
      name: nameResult.value,
      source,
    };
    if (externalResult?.ok) input.externalId = externalResult.value;
    onCreate(input);
  };

  const title = mode === 'create' ? 'Add crag' : readOnly ? 'Crag' : 'Edit crag';
  const shownSource = editedCrag ? (editedCrag.source ?? 'explorer') : source;
  const canSave = !saving && !readOnly && name.trim().length > 0
    && (editedCrag != null || id.trim().length > 0)
    && (editedCrag != null || source !== 'external' || externalId.trim().length > 0);

  return (
    <Modal
      open
      title={title}
      closeOnBackdrop={false}
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            {readOnly ? 'Close' : 'Cancel'}
          </Button>
          {readOnly ? null : (
            <Button type="submit" form={formId} disabled={!canSave}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </>
      }
    >
      <form id={formId} className="crag-manage-form" onSubmit={handleSubmit}>
        {error ? (
          <p className="crag-manage-form__error" role="alert">
            {error}
          </p>
        ) : null}
        {readOnly ? (
          <p className="crag-manage-form__hint">An extracted crag is read-only.</p>
        ) : null}
        <div className="crag-manage-form__field">
          <label className="crag-manage-form__label" htmlFor={idField}>
            Id
          </label>
          <input
            id={idField}
            className={fieldErrors.id ? 'crag-manage-form__input is-invalid' : 'crag-manage-form__input'}
            value={editedCrag ? editedCrag.id : id}
            maxLength={CRAG_ID_MAX_LENGTH}
            disabled={saving || editedCrag != null}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={fieldErrors.id ? true : undefined}
            aria-describedby={fieldErrors.id ? `${idField}-error` : undefined}
            onChange={(event) => {
              setId(event.target.value);
              clearError('id');
            }}
          />
          {fieldErrors.id ? (
            <p id={`${idField}-error`} className="crag-manage-form__field-error">
              {fieldErrors.id}
            </p>
          ) : null}
        </div>
        {editedCrag ? (
          <div className="crag-manage-form__field">
            <label className="crag-manage-form__label" htmlFor={sourceField}>
              Source
            </label>
            <input
              id={sourceField}
              className="crag-manage-form__input"
              value={shownSource}
              disabled
            />
          </div>
        ) : (
          <div className="crag-manage-form__field">
            <label className="crag-manage-form__label" htmlFor={sourceField}>
              Source
            </label>
            <select
              id={sourceField}
              className="crag-manage-form__input"
              value={source}
              disabled={saving}
              onChange={(event) => {
                const next = event.target.value === 'external' ? 'external' : 'explorer';
                setSource(next);
                if (next !== 'external') clearError('externalId');
              }}
            >
              <option value="explorer">explorer</option>
              <option value="external">external</option>
            </select>
          </div>
        )}
        {readOnly ? null : (
          <div className="crag-manage-form__field">
            <label className="crag-manage-form__label" htmlFor={nameField}>
              Name
            </label>
            <input
              id={nameField}
              className={fieldErrors.name ? 'crag-manage-form__input is-invalid' : 'crag-manage-form__input'}
              value={name}
              maxLength={CRAG_NAME_MAX_LENGTH}
              disabled={saving}
              autoComplete="off"
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? `${nameField}-error` : undefined}
              onChange={(event) => {
                setName(event.target.value);
                clearError('name');
              }}
            />
            {fieldErrors.name ? (
              <p id={`${nameField}-error`} className="crag-manage-form__field-error">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
        )}
        {editedCrag == null && source === 'external' ? (
          <div className="crag-manage-form__field">
            <label className="crag-manage-form__label" htmlFor={externalField}>
              External id
            </label>
            <input
              id={externalField}
              className={
                fieldErrors.externalId
                  ? 'crag-manage-form__input is-invalid'
                  : 'crag-manage-form__input'
              }
              value={externalId}
              maxLength={CRAG_EXTERNAL_ID_MAX_LENGTH}
              disabled={saving}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={fieldErrors.externalId ? true : undefined}
              aria-describedby={fieldErrors.externalId ? `${externalField}-error` : undefined}
              onChange={(event) => {
                setExternalId(event.target.value);
                clearError('externalId');
              }}
            />
            {fieldErrors.externalId ? (
              <p id={`${externalField}-error`} className="crag-manage-form__field-error">
                {fieldErrors.externalId}
              </p>
            ) : null}
          </div>
        ) : null}
      </form>
    </Modal>
  );
};

export default CragManageModal;
