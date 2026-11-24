import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCrag,
  deleteCrag,
  patchCragSettings,
  type CragCreateInput,
  type CragSettingsPatch,
} from '../api/client';
import { queryKeys } from '../api/queryClient';
import { useCragsQuery } from '../api/useCragsQuery';
import { useAuthSession } from '../auth/useAuthSession';
import Button from '../components/Button';
import CragManageModal from '../components/editors/CragManageModal';
import { confirm } from '../context/ConfirmContext';
import type { Crag } from '../types';
import NotFound from './NotFound';
import './CragManagePage.scss';

type Editor =
  | { mode: 'create' }
  | { mode: 'edit'; crag: Crag };

function errorText(error: unknown, fallback: string): string | null {
  if (!error) return null;
  return error instanceof Error ? error.message : fallback;
}

function formatUpdatedAt(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const CragManagePage: React.FC = () => {
  const account = useAuthSession();
  const cragsQuery = useCragsQuery();
  const queryClient = useQueryClient();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [editorSession, setEditorSession] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshCrag = async (cragId?: string) => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.cragsAll });
    if (cragId) {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cragAll(cragId) });
    }
  };

  const saveCreate = useMutation({
    mutationFn: (input: CragCreateInput) => createCrag(input),
    onSuccess: async () => {
      await refreshCrag();
      setEditor(null);
    },
    onError: (error) => {
      console.error('Failed to create crag:', error);
    },
  });

  const saveEdit = useMutation({
    mutationFn: (input: { cragId: string; version: number; patch: CragSettingsPatch }) => (
      patchCragSettings(input.cragId, input.version, input.patch)
    ),
    onSuccess: async (_saved, input) => {
      await refreshCrag(input.cragId);
      setEditor(null);
    },
    onError: (error) => {
      console.error('Failed to save crag:', error);
    },
  });

  const removeCrag = useMutation({
    mutationFn: (cragId: string) => deleteCrag(cragId),
    onSuccess: async (_saved, cragId) => {
      await refreshCrag(cragId);
    },
    onError: (error) => {
      console.error('Failed to delete crag:', error);
    },
  });

  if (account?.superadmin !== true) return <NotFound />;

  const busy = saveCreate.isPending || saveEdit.isPending || removeCrag.isPending;
  const crags = cragsQuery.data ?? [];

  const openEditor = (next: Editor) => {
    saveCreate.reset();
    saveEdit.reset();
    setActionError(null);
    setEditorSession((value) => value + 1);
    setEditor(next);
  };

  const handleDelete = async (crag: Crag) => {
    if (busy || crag.sectorCount !== 0) return;
    let confirmed = false;
    try {
      confirmed = await confirm({
        title: 'Delete crag',
        message: `Delete ${crag.cragName}? This cannot be undone.`,
        confirmLabel: 'Delete',
        destructive: true,
      });
    } catch (error) {
      console.error('Failed to confirm crag delete:', error);
      return;
    }
    if (!confirmed) return;
    removeCrag.mutate(crag.id);
  };

  const handleCreate = (input: CragCreateInput) => {
    if (busy) return;
    setActionError(null);
    saveCreate.mutate(input);
  };

  const handleSave = (patch: CragSettingsPatch) => {
    if (busy || editor?.mode !== 'edit') return;
    const crag = editor.crag;
    if (typeof crag.version !== 'number') {
      setActionError('Reload the page before saving this crag.');
      return;
    }
    if (
      patch.name === undefined
      && patch.published === undefined
      && patch.country === undefined
    ) return;
    setActionError(null);
    saveEdit.mutate({ cragId: crag.id, version: crag.version, patch });
  };

  const modalError = editor?.mode === 'create'
    ? errorText(saveCreate.error, 'Could not create the crag.')
    : actionError ?? errorText(saveEdit.error, 'Could not save the crag.');

  return (
    <div className="page crag-manage">
      <div className="crag-manage__header">
        <Button type="button" onClick={() => openEditor({ mode: 'create' })} disabled={busy}>
          Add crag
        </Button>
      </div>
      {cragsQuery.isPending ? <p className="crag-manage__status">Loading crags...</p> : null}
      {cragsQuery.isError ? (
        <p className="crag-manage__error" role="alert">
          {errorText(cragsQuery.error, 'Failed to load crags.')}
        </p>
      ) : null}
      {removeCrag.error ? (
        <p className="crag-manage__error" role="alert">
          {errorText(removeCrag.error, 'Could not delete the crag.')}
        </p>
      ) : null}
      <div className="crag-manage__table-wrap">
        <table className="crag-manage__table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Name</th>
              <th>Source</th>
              <th>Sectors</th>
              <th>Published</th>
              <th>Updated</th>
              <th className="crag-manage__actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {crags.map((crag) => (
              <tr key={crag.id}>
                <td className="crag-manage__id">{crag.id}</td>
                <td>{crag.cragName}</td>
                <td>{crag.source ?? ''}</td>
                <td>{typeof crag.sectorCount === 'number' ? crag.sectorCount : ''}</td>
                <td>{crag.published === false ? 'No' : 'Yes'}</td>
                <td title={crag.updatedAt}>{formatUpdatedAt(crag.updatedAt)}</td>
                <td className="crag-manage__actions">
                  <div className="crag-manage__action-buttons">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      aria-label={`Edit ${crag.cragName}`}
                      disabled={busy}
                      onClick={() => openEditor({ mode: 'edit', crag })}
                    >
                      Edit
                    </Button>
                    {crag.sectorCount === 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        aria-label={`Delete ${crag.cragName}`}
                        disabled={busy}
                        onClick={() => {
                          void handleDelete(crag);
                        }}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!cragsQuery.isPending && crags.length === 0 ? (
          <p className="crag-manage__status">No crags yet.</p>
        ) : null}
      </div>
      {editor ? (
        <CragManageModal
          key={editorSession}
          mode={editor.mode}
          crag={editor.mode === 'edit' ? editor.crag : null}
          saving={saveCreate.isPending || saveEdit.isPending}
          error={modalError}
          onClose={() => {
            if (busy) return;
            setEditor(null);
          }}
          onCreate={handleCreate}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
};

export default CragManagePage;
