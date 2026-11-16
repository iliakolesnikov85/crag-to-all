import React, { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CragMemberRole } from '@crag-to-all/shared-crag';
import {
  deleteCragMember,
  listCragMembers,
  upsertCragMember,
  type CragMember,
} from '../../api/client';
import { queryKeys } from '../../api/queryClient';
import { useAuthSession, useCanEditCrag, useCanManageMembers } from '../../auth/useAuthSession';
import { confirm } from '../../context/ConfirmContext';
import { useCrag } from '../../context/CragContext';
import Button from '../Button';
import MemberEditorModal from './MemberEditorModal';
import { displayValue, memberLabel, roleLabel } from './memberDisplay';
import './CragMembersPanel.scss';

type MemberEditor =
  | { mode: 'add' }
  | { mode: 'edit'; member: CragMember };

function errorText(error: unknown, fallback: string): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : fallback;
}

function canChangeRow(member: CragMember, superadmin: boolean): boolean {
  return superadmin || member.role === 'admin';
}

const CragMembersPanel: React.FC = () => {
  const { crag } = useCrag();
  const account = useAuthSession();
  const canSee = useCanEditCrag(crag);
  const canManage = useCanManageMembers(crag.id);
  const queryClient = useQueryClient();
  const headingId = useId();
  const [editor, setEditor] = useState<MemberEditor | null>(null);
  const [editorSession, setEditorSession] = useState(0);
  const membersQuery = useQuery({
    queryKey: queryKeys.cragMembers(crag.id),
    queryFn: () => listCragMembers(crag.id),
    enabled: canSee && crag.id.length > 0,
  });

  const saveMember = useMutation({
    mutationFn: (input: { userId: string; role: CragMemberRole }) => (
      upsertCragMember(crag.id, input.userId, input.role)
    ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cragMembers(crag.id) });
      setEditor(null);
    },
    onError: (error) => {
      console.error('Failed to save crag member:', error);
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) => deleteCragMember(crag.id, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cragMembers(crag.id) });
    },
    onError: (error) => {
      console.error('Failed to remove crag member:', error);
    },
  });

  const openEditor = (next: MemberEditor) => {
    saveMember.reset();
    setEditorSession((value) => value + 1);
    setEditor(next);
  };

  const handleRemove = async (member: CragMember) => {
    let confirmed = false;
    try {
      confirmed = await confirm({
        title: 'Remove member',
        message: `Remove ${memberLabel(member)} from this crag?`,
        confirmLabel: 'Remove',
        destructive: true,
      });
    } catch (error) {
      console.error('Failed to confirm member removal:', error);
      return;
    }
    if (!confirmed) return;
    removeMember.mutate(member.userId);
  };

  if (!canSee) return null;

  const members = membersQuery.data ?? [];
  const superadmin = account?.superadmin === true;
  const removeError = errorText(removeMember.error, 'Could not remove that member.');
  const saveError = errorText(saveMember.error, 'Could not save that member.');

  return (
    <section className="crag-members" aria-labelledby={headingId}>
      <div className="crag-members__header">
        <h3 id={headingId}>Authors</h3>
        {canManage ? (
          <Button type="button" onClick={() => openEditor({ mode: 'add' })}>
            Add member
          </Button>
        ) : null}
      </div>
      {membersQuery.isLoading ? (
        <p className="crag-members__status">Loading members...</p>
      ) : null}
      {membersQuery.isError ? (
        <p className="crag-members__error" role="alert">
          {errorText(membersQuery.error, 'Could not load crag members.')}
        </p>
      ) : null}
      {removeError ? (
        <p className="crag-members__error" role="alert">
          {removeError}
        </p>
      ) : null}
      {membersQuery.isSuccess && members.length === 0 ? (
        <p className="crag-members__status">No members yet.</p>
      ) : null}
      {membersQuery.isSuccess && members.length > 0 ? (
        <div className="crag-members__table-wrap">
          <table className="crag-members__table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>User UID</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => {
                const label = memberLabel(member);
                const changeable = canChangeRow(member, superadmin);
                return (
                  <tr key={member.userId}>
                    <td>{displayValue(member.name)}</td>
                    <td>{displayValue(member.email)}</td>
                    <td>{roleLabel(member.role)}</td>
                    <td className="crag-members__uid">{member.userId}</td>
                    {canManage ? (
                      <td>
                        {changeable ? (
                          <div className="crag-members__actions">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              aria-label={`Edit ${label}`}
                              disabled={removeMember.isPending}
                              onClick={() => openEditor({ mode: 'edit', member })}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              aria-label={`Remove ${label}`}
                              disabled={removeMember.isPending}
                              onClick={() => {
                                void handleRemove(member);
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {editor ? (
        <MemberEditorModal
          key={editorSession}
          open
          cragId={crag.id}
          mode={editor.mode}
          member={editor.mode === 'edit' ? editor.member : null}
          allowOwnerRole={superadmin}
          saving={saveMember.isPending}
          error={saveError}
          onClose={() => {
            if (saveMember.isPending) return;
            saveMember.reset();
            setEditor(null);
          }}
          onSave={(input) => saveMember.mutate(input)}
        />
      ) : null}
    </section>
  );
};

export default CragMembersPanel;
