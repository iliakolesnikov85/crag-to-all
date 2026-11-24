import React, { useId, useState } from 'react';
import {
  CRAG_EXTERNAL_ID_MAX_LENGTH,
  CRAG_ID_MAX_LENGTH,
  CRAG_NAME_MAX_LENGTH,
  DEFAULT_CRAG_COUNTRY,
  validateCragCountry,
  validateCragExternalId,
  validateCragId,
  validateCragName,
} from '@crag-to-all/shared-crag';
import type { CragCreateInput, CragSettingsPatch } from '../../api/client';
import type { Crag, CragSource } from '../../types';
import Button from '../Button';
import Modal from '../Modal';
import CountryField from './CountryField';
import './CragManageModal.scss';

interface FieldErrors {
  id?: string;
  name?: string;
  externalId?: string;
  country?: string;
}

interface CragManageModalProps {
  mode: 'create' | 'edit';
  crag: Crag | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: CragCreateInput) => void;
  onSave: (input: CragSettingsPatch) => void;
}

const CragManageModal: React.FC<CragManageModalProps> = ({
  mode,
  crag,
  saving,
  error,
  onClose,
  onCreate,
  onSave,
}) => {
  const formId = useId().replace(/:/g, '');
  const idField = `${formId}-id`;
  const nameField = `${formId}-name`;
  const sourceField = `${formId}-source`;
  const externalField = `${formId}-external`;
  const publishedField = `${formId}-published`;
  const countryField = `${formId}-country`;
  const editedCrag = mode === 'edit' ? crag : null;
  const readOnly = editedCrag?.source === 'external';
  const savedPublished = editedCrag?.published !== false;
  const savedCountry = editedCrag?.country ?? '';
  const [id, setId] = useState('');
  const [name, setName] = useState(editedCrag?.cragName ?? '');
  const [source, setSource] = useState<CragSource>('explorer');
  const [externalId, setExternalId] = useState('');
  const [published, setPublished] = useState(savedPublished);
  const [country, setCountry] = useState(editedCrag ? savedCountry : DEFAULT_CRAG_COUNTRY);
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
    if (saving) return;
    if (editedCrag) {
      const publishedChanged = published !== savedPublished;
      const countryChanged = country !== savedCountry;
      let nextCountry: string | undefined;
      if (countryChanged) {
        const countryResult = validateCragCountry(country);
        if (!countryResult.ok) {
          setFieldErrors({ country: countryResult.error });
          return;
        }
        nextCountry = countryResult.value;
      }
      const countryPatch = nextCountry !== undefined ? { country: nextCountry } : {};
      if (readOnly) {
        if (!publishedChanged && nextCountry === undefined) onClose();
        else onSave({ ...(publishedChanged ? { published } : {}), ...countryPatch });
        return;
      }
      const nameResult = validateCragName(name);
      if (!nameResult.ok) {
        setFieldErrors({ name: nameResult.error });
        return;
      }
      const nameChanged = nameResult.value !== editedCrag.cragName;
      if (!nameChanged && !publishedChanged && nextCountry === undefined) {
        onClose();
        return;
      }
      onSave({
        ...(nameChanged ? { name: nameResult.value } : {}),
        ...(publishedChanged ? { published } : {}),
        ...countryPatch,
      });
      return;
    }
    const idResult = validateCragId(id);
    const nameResult = validateCragName(name);
    const countryResult = validateCragCountry(country);
    const externalResult = source === 'external' ? validateCragExternalId(externalId) : undefined;
    const errors: FieldErrors = {};
    if (!idResult.ok) errors.id = idResult.error;
    if (!nameResult.ok) errors.name = nameResult.error;
    if (!countryResult.ok) errors.country = countryResult.error;
    if (externalResult && !externalResult.ok) errors.externalId = externalResult.error;
    if (
      !idResult.ok
      || !nameResult.ok
      || !countryResult.ok
      || (externalResult != null && !externalResult.ok)
    ) {
      setFieldErrors(errors);
      return;
    }
    onCreate({
      id: idResult.value,
      name: nameResult.value,
      source,
      country: countryResult.value,
      ...(externalResult?.ok ? { externalId: externalResult.value } : {}),
    });
  };

  const showExternalId = editedCrag
    ? editedCrag.source === 'external' || Boolean(editedCrag.externalId)
    : source === 'external';
  const externalIdValue = editedCrag ? editedCrag.externalId ?? '' : externalId;
  const title = mode === 'create' ? 'Add crag' : readOnly ? 'Crag' : 'Edit crag';
  const nameReady = name.trim().length > 0;
  const countryReady = country.trim().length > 0;
  const canSave = !saving && (
    editedCrag
      ? readOnly || nameReady
      : nameReady
        && countryReady
        && id.trim().length > 0
        && (source !== 'external' || externalId.trim().length > 0)
  );

  return (
    <Modal
      open
      title={title}
      closeOnBackdrop={false}
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
      <form id={formId} className="crag-manage-form" onSubmit={handleSubmit}>
        {error ? (
          <p className="crag-manage-form__error" role="alert">
            {error}
          </p>
        ) : null}
        {readOnly ? (
          <p className="crag-manage-form__hint">The name cannot be changed. You can still change the country and Published.</p>
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
        <div className="crag-manage-form__field">
          <label className="crag-manage-form__label" htmlFor={sourceField}>
            Source
          </label>
          {editedCrag ? (
            <input
              id={sourceField}
              className="crag-manage-form__input"
              value={editedCrag.source ?? 'explorer'}
              disabled
            />
          ) : (
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
          )}
        </div>
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
        <CountryField
          id={countryField}
          value={country}
          disabled={saving}
          error={fieldErrors.country}
          onChange={(code) => {
            setCountry(code);
            clearError('country');
          }}
        />
        {editedCrag ? (
          <label className="crag-manage-form__check" htmlFor={publishedField}>
            <input
              id={publishedField}
              className="crag-manage-form__check-input"
              type="checkbox"
              checked={published}
              disabled={saving}
              onChange={(event) => setPublished(event.target.checked)}
            />
            Published
          </label>
        ) : null}
        {showExternalId ? (
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
              value={externalIdValue}
              maxLength={CRAG_EXTERNAL_ID_MAX_LENGTH}
              disabled={saving || editedCrag != null}
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
