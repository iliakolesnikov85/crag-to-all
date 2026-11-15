import React, { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { CragMemberRole } from '@crag-to-all/shared-crag';
import { lookupVerifiedAccount, type CragMember, type VerifiedAccount } from '../../api/client';
import Button from '../Button';
import Modal from '../Modal';
import { displayValue } from './memberDisplay';
import './MemberEditorModal.scss';

interface MemberEditorModalProps {
  open: boolean;
  cragId: string;
  mode: 'add' | 'edit';
  member: CragMember | null;
  allowOwnerRole: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: { userId: string; role: CragMemberRole }) => void;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not look up that email.';
}

const MemberEditorModal: React.FC<MemberEditorModalProps> = ({
  open,
  cragId,
  mode,
  member,
  allowOwnerRole,
  saving,
  error,
  onClose,
  onSave,
}) => {
  const formId = useId().replace(/:/g, '');
  const emailId = `${formId}-email`;
  const roleId = `${formId}-role`;
  const [email, setEmail] = useState('');
  const [account, setAccount] = useState<VerifiedAccount | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [role, setRole] = useState<CragMemberRole>(
    mode === 'edit' && member ? member.role : 'admin',
  );

  const lookup = useMutation({
    mutationFn: (address: string) => lookupVerifiedAccount(cragId, address),
    onSuccess: (found) => {
      setAccount(found);
      setEmail(found.email);
      setLookupError(null);
    },
    onError: (lookupFailure) => {
      console.error('Failed to look up a verified account:', lookupFailure);
      setAccount(null);
      setLookupError(errorText(lookupFailure));
    },
  });

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const runLookup = () => {
    const address = email.trim();
    if (!address || lookup.isPending || saving) return;
    setAccount(null);
    setLookupError(null);
    lookup.mutate(address);
  };

  const save = () => {
    if (saving) return;
    if (mode === 'add') {
      if (!account) return;
      onSave({ userId: account.uid, role });
      return;
    }
    if (!member) return;
    onSave({ userId: member.userId, role });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'add' && !account) {
      runLookup();
      return;
    }
    save();
  };

  const shownError = lookupError ?? error;
  const canSave = !saving && (mode === 'edit' || account !== null);
  const roleOptions: Array<{ value: CragMemberRole; label: string }> = [
    { value: 'admin', label: 'Admin' },
  ];
  if (allowOwnerRole) {
    roleOptions.push({ value: 'owner', label: 'Owner' });
  }

  return (
    <Modal
      open={open}
      title={mode === 'add' ? 'Add member' : 'Change member'}
      closeOnBackdrop={false}
      onClose={handleClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={!canSave}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      <form id={formId} className="member-editor" onSubmit={handleSubmit}>
        {shownError ? (
          <p className="member-editor__error" role="alert">
            {shownError}
          </p>
        ) : null}
        {mode === 'add' ? (
          <div className="member-editor__lookup">
            <label className="member-editor__field" htmlFor={emailId}>
              <span className="member-editor__label">Email</span>
              <input
                id={emailId}
                className="member-editor__input"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setAccount(null);
                  setLookupError(null);
                }}
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={runLookup}
              disabled={email.trim().length === 0 || lookup.isPending || saving}
            >
              {lookup.isPending ? 'Looking up...' : 'Look up'}
            </Button>
          </div>
        ) : null}
        {mode === 'add' && account ? (
          <dl className="member-editor__identity">
            <dt>Name</dt>
            <dd>{displayValue(account.name)}</dd>
            <dt>Email</dt>
            <dd>{account.email}</dd>
            <dt>User UID</dt>
            <dd>{account.uid}</dd>
          </dl>
        ) : null}
        {mode === 'edit' && member ? (
          <dl className="member-editor__identity">
            <dt>Name</dt>
            <dd>{displayValue(member.name)}</dd>
            <dt>Email</dt>
            <dd>{displayValue(member.email)}</dd>
            <dt>User UID</dt>
            <dd>{member.userId}</dd>
          </dl>
        ) : null}
        <label className="member-editor__field" htmlFor={roleId}>
          <span className="member-editor__label">Role</span>
          <select
            id={roleId}
            className="member-editor__input"
            value={role}
            onChange={(event) => setRole(event.target.value as CragMemberRole)}
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </form>
    </Modal>
  );
};

export default MemberEditorModal;
