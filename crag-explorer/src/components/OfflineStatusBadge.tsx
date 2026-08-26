import React from 'react';
import { Link } from 'react-router';
import { MdCheckCircle, MdCloudDownload, MdFileDownload } from 'react-icons/md';
import './OfflineStatusBadge.scss';

export type OfflineBadgeState = 'not-saved' | 'saved' | 'update';

interface OfflineStatusBadgeProps {
  state: OfflineBadgeState;
  variant: 'card' | 'header';
  inline?: boolean;
  /** Link target for `update` / `not-saved` (preferred over callbacks). */
  to?: string;
  /** When state is `update` and `to` is unset, tap runs this. */
  onUpdate?: () => void;
  /** When state is `not-saved` and `to` is unset, tap runs this. */
  onNotSaved?: () => void;
  busy?: boolean;
}

const OfflineStatusBadge: React.FC<OfflineStatusBadgeProps> = ({
  state,
  variant,
  inline = false,
  to,
  onUpdate,
  onNotSaved,
  busy = false,
}) => {
  const canNavigate = (state === 'update' || state === 'not-saved') && Boolean(to) && !busy;
  const action =
    !canNavigate && state === 'update' && onUpdate
      ? onUpdate
      : !canNavigate && state === 'not-saved' && onNotSaved
        ? onNotSaved
        : undefined;
  const isButton = Boolean(action);
  const isInteractive = canNavigate || isButton;

  const label =
    state === 'saved'
      ? 'Saved on this device'
      : state === 'update'
        ? 'New guide data — tap to update'
        : 'Not saved — tap to open Download tab';

  const shortLabel =
    state === 'saved' ? 'Saved' : state === 'update' ? 'Update' : 'Not saved';

  const className = [
    'offline-status',
    `offline-status--${variant}`,
    `offline-status--${state}`,
    inline ? 'offline-status--inline' : '',
    isInteractive ? 'offline-status--action' : '',
    busy ? 'offline-status--busy' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isButton || busy) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      action?.();
    }
  };

  const body = (
    <>
      <span className="offline-status__icon" aria-hidden="true">
        {state === 'saved' ? (
          <MdCheckCircle focusable="false" />
        ) : state === 'update' ? (
          <MdCloudDownload focusable="false" />
        ) : (
          <MdFileDownload focusable="false" />
        )}
      </span>
      <span className="offline-status__label">{shortLabel}</span>
    </>
  );

  if (canNavigate && to) {
    return (
      <Link className={className} to={to} title={label} aria-label={label}>
        {body}
      </Link>
    );
  }

  return (
    <span
      className={className}
      title={label}
      aria-label={label}
      role={isButton ? 'button' : undefined}
      tabIndex={isButton && !busy ? 0 : undefined}
      aria-disabled={isButton && busy ? true : undefined}
      onClick={
        isButton
          ? (e) => {
              e.stopPropagation();
              if (!busy) action?.();
            }
          : undefined
      }
      onKeyDown={isButton ? handleKeyDown : undefined}
    >
      {body}
    </span>
  );
};

export default OfflineStatusBadge;
