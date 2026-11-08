import React, { useId, useState } from 'react';
import type { Route } from '../types';
import {
  ROUTE_NAME_MAX_LENGTH,
  ROUTE_TAG_GROUPS,
  ROUTE_TYPES,
  buildRouteWrite,
  gradeChoices,
  routeEditDraft,
  sameRouteDraft,
  toggleRouteTag,
  type RouteEditDraft,
  type RouteEditErrors,
} from '../utils/routeEditor';
import { confirm } from '../context/ConfirmContext';
import Button from './Button';
import ChoiceGroup from './ChoiceGroup';
import Modal from './Modal';
import RouteRating from './RouteRating';
import './RouteDetailsModal.scss';

const LEAVE_CONFIRM = 'Leave this edit? Your unsaved changes will be lost.';

interface RouteDetailsModalProps {
  open: boolean;
  route: Route | null;
  sectorName: string;
  takenNames: readonly string[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (route: Route) => void;
}

function RouteDetailsModal({
  open,
  route,
  sectorName,
  takenNames,
  saving,
  error,
  onClose,
  onSave,
}: RouteDetailsModalProps) {
  const formId = useId().replace(/:/g, '');
  const nameId = `${formId}-name`;
  const gradeId = `${formId}-grade`;
  const typeId = `${formId}-type`;
  const descriptionId = `${formId}-description`;
  const heightId = `${formId}-height`;
  const nameErrorId = `${formId}-name-error`;
  const heightErrorId = `${formId}-height-error`;
  const [draft, setDraft] = useState<RouteEditDraft>(() => routeEditDraft(route));
  const [fieldErrors, setFieldErrors] = useState<RouteEditErrors>({});
  const grades = gradeChoices(draft.grade);

  const requestClose = () => {
    if (saving) return;
    const dirty = !sameRouteDraft(draft, routeEditDraft(route));
    if (!dirty) {
      onClose();
      return;
    }
    void confirm({
      title: 'Leave this edit?',
      message: LEAVE_CONFIRM,
      confirmLabel: 'Leave',
      destructive: true,
    }).then((leave) => {
      if (leave) onClose();
    });
  };

  const updateDraft = (patch: Partial<RouteEditDraft>, field?: keyof RouteEditErrors) => {
    setDraft((current) => ({ ...current, ...patch }));
    if (!field) return;
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
    const result = buildRouteWrite(sectorName, route, draft, takenNames);
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    onSave(result.route);
  };

  const canSave = draft.name.trim().length > 0 && !saving;

  return (
    <Modal
      open={open}
      title={route ? 'Edit route' : 'Add route'}
      closeOnBackdrop={false}
      onClose={requestClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!canSave}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <form id={formId} className="route-details-form" onSubmit={handleSubmit}>
        {error ? (
          <p className="route-details-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="route-details-field">
          <label className="route-details-label" htmlFor={nameId}>
            Name
          </label>
          <input
            id={nameId}
            className={fieldErrors.name ? 'route-details-input is-invalid' : 'route-details-input'}
            value={draft.name}
            maxLength={ROUTE_NAME_MAX_LENGTH}
            disabled={saving}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? nameErrorId : undefined}
            onChange={(event) => updateDraft({ name: event.target.value }, 'name')}
          />
          {fieldErrors.name ? (
            <p id={nameErrorId} className="route-details-field-error">
              {fieldErrors.name}
            </p>
          ) : null}
        </div>
        <div className="route-details-row">
          <div className="route-details-field">
            <label className="route-details-label" htmlFor={gradeId}>
              Grade
            </label>
            <select
              id={gradeId}
              className="route-details-input"
              value={draft.grade}
              disabled={saving}
              onChange={(event) => updateDraft({ grade: event.target.value })}
            >
              {grades.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>
          <div className="route-details-field">
            <label className="route-details-label" htmlFor={typeId}>
              Type
            </label>
            <select
              id={typeId}
              className="route-details-input"
              value={draft.type}
              disabled={saving}
              onChange={(event) => updateDraft({ type: event.target.value as RouteEditDraft['type'] })}
            >
              <option value=""></option>
              {ROUTE_TYPES.map((routeType) => (
                <option key={routeType} value={routeType}>
                  {routeType}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="route-details-field">
          <label className="route-details-label" htmlFor={descriptionId}>
            Description
          </label>
          <textarea
            id={descriptionId}
            className="route-details-input route-details-description"
            value={draft.description}
            maxLength={20_000}
            rows={4}
            disabled={saving}
            onChange={(event) => updateDraft({ description: event.target.value })}
          />
        </div>
        <div className="route-details-row">
          <div className="route-details-field">
            <span className="route-details-label">Rating</span>
            <RouteRating
              rating={draft.rating}
              disabled={saving}
              onChange={(rating) => updateDraft({ rating })}
            />
          </div>
          <div className="route-details-field">
            <label className="route-details-label" htmlFor={heightId}>
              Height
            </label>
            <div className="route-details-measure">
              <input
                id={heightId}
                className={fieldErrors.height ? 'route-details-input is-invalid' : 'route-details-input'}
                inputMode="decimal"
                autoComplete="off"
                value={draft.height}
                disabled={saving}
                aria-invalid={fieldErrors.height ? true : undefined}
                aria-describedby={fieldErrors.height ? heightErrorId : undefined}
                onChange={(event) => updateDraft({ height: event.target.value }, 'height')}
              />
              <span className="route-details-unit">meters</span>
            </div>
            {fieldErrors.height ? (
              <p id={heightErrorId} className="route-details-field-error">
                {fieldErrors.height}
              </p>
            ) : null}
          </div>
        </div>
        {ROUTE_TAG_GROUPS.map((group) => (
          <ChoiceGroup
            key={group.label}
            label={group.label}
            options={group.tags.map((tag) => ({ value: tag, label: tag }))}
            selected={draft.tags}
            disabled={saving}
            onToggle={(tag) => updateDraft({ tags: toggleRouteTag(draft.tags, tag) })}
          />
        ))}
      </form>
    </Modal>
  );
}

export default RouteDetailsModal;
