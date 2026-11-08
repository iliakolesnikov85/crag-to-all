import React, { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Sector } from '../types';
import {
  MONTHS,
  ORIENTATIONS,
  buildSectorEditPatch,
  sectorEditDraft,
  type Orientation,
  type SectorDetailsPatch,
  type SectorEditDraft,
  type SectorEditErrors,
} from '../utils/sectorDetails';
import { SECTOR_NAME_MAX_LENGTH } from '../utils/sectorName';
import { confirm } from '../context/ConfirmContext';
import Button from './Button';
import ChoiceGroup, { type ChoiceOption } from './ChoiceGroup';
import Modal from './Modal';
import './SectorDetailsModal.scss';

interface SectorDetailsModalProps {
  open: boolean;
  sector: Sector;
  takenNames: readonly string[];
  mapUrl: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onLocationClick: () => void;
  onSave: (patch: SectorDetailsPatch) => void;
}

const MONTH_OPTIONS: ChoiceOption<number>[] = MONTHS.map((label, value) => ({ value, label }));
const ORIENTATION_OPTIONS: ChoiceOption<Orientation>[] = ORIENTATIONS.map((direction) => ({
  value: direction,
  label: direction,
}));
const LEAVE_CONFIRM = 'Leave this edit? Your unsaved changes will be lost.';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 5);
}

function sameItems<T>(left: readonly T[], right: readonly T[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function sameDraft(left: SectorEditDraft, right: SectorEditDraft): boolean {
  return left.name === right.name
    && left.altitude === right.altitude
    && left.approachMinutes === right.approachMinutes
    && left.sunStart === right.sunStart
    && left.sunEnd === right.sunEnd
    && sameItems(left.months, right.months)
    && sameItems(left.orientations, right.orientations);
}

const SectorDetailsModal: React.FC<SectorDetailsModalProps> = ({
  open,
  sector,
  takenNames,
  mapUrl,
  saving,
  error,
  onClose,
  onLocationClick,
  onSave,
}) => {
  const navigate = useNavigate();
  const formId = useId().replace(/:/g, '');
  const nameId = `${formId}-name`;
  const altitudeId = `${formId}-altitude`;
  const approachId = `${formId}-approach`;
  const nameErrorId = `${formId}-name-error`;
  const [draft, setDraft] = useState<SectorEditDraft>(() => sectorEditDraft(sector));
  const [fieldErrors, setFieldErrors] = useState<SectorEditErrors>({});

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const clearError = (field: keyof SectorEditErrors) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateDraft = (patch: Partial<SectorEditDraft>, field?: keyof SectorEditErrors) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (field) clearError(field);
  };

  const toggleMonth = (month: number) => {
    setDraft((current) => {
      const months = current.months.includes(month)
        ? current.months.filter((item) => item !== month)
        : [...current.months, month].sort((a, b) => a - b);
      return { ...current, months };
    });
  };

  const toggleOrientation = (direction: Orientation) => {
    setDraft((current) => {
      const selected = current.orientations.includes(direction)
        ? current.orientations.filter((item) => item !== direction)
        : [...current.orientations, direction];
      return {
        ...current,
        orientations: ORIENTATIONS.filter((item) => selected.includes(item)),
      };
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const result = buildSectorEditPatch(sector, draft, takenNames);
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    if (Object.keys(result.patch).length === 0) {
      onClose();
      return;
    }
    onSave(result.patch);
  };

  const canSave = draft.name.trim().length > 0 && !saving;

  const handleLocationClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const dirty = !sameDraft(draft, sectorEditDraft(sector));
    if (!dirty) {
      onLocationClick();
      return;
    }
    event.preventDefault();
    void confirm({
      title: 'Leave this edit?',
      message: LEAVE_CONFIRM,
      confirmLabel: 'Leave',
      destructive: true,
    }).then((leave) => {
      if (!leave) return;
      onLocationClick();
      navigate(mapUrl);
    });
  };

  return (
    <Modal
      open={open}
      title="Edit sector"
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
      <form id={formId} className="edit-sector-form" onSubmit={handleSubmit}>
        {error ? (
          <p className="edit-sector-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="edit-sector-field">
          <label className="edit-sector-label" htmlFor={nameId}>
            Name
          </label>
          <input
            id={nameId}
            className={fieldErrors.name ? 'edit-sector-input is-invalid' : 'edit-sector-input'}
            value={draft.name}
            maxLength={SECTOR_NAME_MAX_LENGTH}
            disabled={saving}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? nameErrorId : undefined}
            onChange={(event) => updateDraft({ name: event.target.value }, 'name')}
          />
          {fieldErrors.name ? (
            <p id={nameErrorId} className="edit-sector-field-error">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>
        <ChoiceGroup
          label="Best season"
          options={MONTH_OPTIONS}
          selected={draft.months}
          disabled={saving}
          onToggle={toggleMonth}
        />
        <ChoiceGroup
          label="Orientation"
          options={ORIENTATION_OPTIONS}
          selected={draft.orientations}
          disabled={saving}
          onToggle={toggleOrientation}
        />
        <div className="edit-sector-pair">
          <div className="edit-sector-field">
            <label className="edit-sector-label" htmlFor={approachId}>
              Approach time
            </label>
            <div className="edit-sector-measure">
              <input
                id={approachId}
                className={fieldErrors.approachTime ? 'edit-sector-input is-invalid' : 'edit-sector-input'}
                inputMode="numeric"
                autoComplete="off"
                value={draft.approachMinutes}
                disabled={saving}
                aria-invalid={fieldErrors.approachTime ? true : undefined}
                onChange={(event) => updateDraft(
                  { approachMinutes: digitsOnly(event.target.value) },
                  'approachTime',
                )}
              />
              <span className="edit-sector-unit">minutes</span>
            </div>
            {fieldErrors.approachTime ? (
              <p className="edit-sector-field-error">{fieldErrors.approachTime}</p>
            ) : null}
          </div>
          <div className="edit-sector-field">
            <label className="edit-sector-label" htmlFor={altitudeId}>
              Altitude
            </label>
            <div className="edit-sector-measure">
              <input
                id={altitudeId}
                className={fieldErrors.altitude ? 'edit-sector-input is-invalid' : 'edit-sector-input'}
                inputMode="numeric"
                autoComplete="off"
                value={draft.altitude}
                disabled={saving}
                aria-invalid={fieldErrors.altitude ? true : undefined}
                onChange={(event) => updateDraft({ altitude: digitsOnly(event.target.value) }, 'altitude')}
              />
              <span className="edit-sector-unit">meters</span>
            </div>
            {fieldErrors.altitude ? (
              <p className="edit-sector-field-error">{fieldErrors.altitude}</p>
            ) : null}
          </div>
        </div>
        <div className="edit-sector-field">
          <span className="edit-sector-label">Time in sun</span>
          <div className="edit-sector-time">
            <input
              className={fieldErrors.timeInSun ? 'edit-sector-input is-invalid' : 'edit-sector-input'}
              type="time"
              aria-label="Time in sun from"
              value={draft.sunStart}
              disabled={saving}
              onChange={(event) => updateDraft({ sunStart: event.target.value }, 'timeInSun')}
            />
            <span className="edit-sector-time-dash" aria-hidden="true">-</span>
            <input
              className={fieldErrors.timeInSun ? 'edit-sector-input is-invalid' : 'edit-sector-input'}
              type="time"
              aria-label="Time in sun until"
              value={draft.sunEnd}
              disabled={saving}
              onChange={(event) => updateDraft({ sunEnd: event.target.value }, 'timeInSun')}
            />
          </div>
          {fieldErrors.timeInSun ? (
            <p className="edit-sector-field-error">{fieldErrors.timeInSun}</p>
          ) : null}
        </div>
        <div className="edit-sector-field">
          <span className="edit-sector-label">Location</span>
          {sector.geo ? (
            <p className="edit-sector-coords">{`${sector.geo.lat}, ${sector.geo.lon}`}</p>
          ) : null}
          <p className="edit-sector-hint">
            You can change the location on the <Link to={mapUrl} onClick={handleLocationClick}>map</Link>.
          </p>
        </div>
      </form>
    </Modal>
  );
};

export default SectorDetailsModal;
