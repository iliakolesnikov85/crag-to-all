import React, { useState } from 'react';
import { MdDelete, MdEdit } from 'react-icons/md';
import { patchCragDescription, type DescriptionPatchResult } from '../api/client';
import { canManageCrag } from '../api/permissions';
import Button from '../components/Button';
import DescriptionSectionModal from '../components/DescriptionSectionModal';
import { useCrag } from '../context/CragContext';
import type { DescriptionSection } from '../types';
import { paragraphsToHtml } from '../utils/descriptionHtml';
import './DescriptionPage.scss';

interface DescriptionPageProps {
  description: DescriptionSection[];
  version?: number;
  onDescriptionChange: (next: DescriptionPatchResult) => void;
}

type SectionEditor =
  | { mode: 'add' }
  | { mode: 'edit'; index: number };

const MISSING_VERSION_MESSAGE = 'This crag cannot be saved because it has no version.';
const PERMISSION_MESSAGE = 'You do not have permission to edit this crag.';

function editorKey(editor: SectionEditor | null): string {
  if (editor?.mode === 'edit') return `edit-${editor.index}`;
  if (editor?.mode === 'add') return 'add';
  return 'closed';
}

const DescriptionPage: React.FC<DescriptionPageProps> = ({
  description,
  version,
  onDescriptionChange,
}) => {
  const { crag } = useCrag();
  const [editor, setEditor] = useState<SectionEditor | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canEdit = canManageCrag(crag.cragId);
  const busy = saving || removing;
  const editingSection = editor?.mode === 'edit' ? description[editor.index] : undefined;

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setSaveError(null);
  };

  const openAdd = () => {
    if (!canEdit || busy) return;
    setActionError(null);
    setSaveError(null);
    setEditor({ mode: 'add' });
  };

  const openEdit = (index: number) => {
    if (!canEdit || busy) return;
    setActionError(null);
    setSaveError(null);
    setEditor({ mode: 'edit', index });
  };

  const handleSave = async (section: DescriptionSection) => {
    if (!canManageCrag(crag.cragId)) {
      setSaveError(PERMISSION_MESSAGE);
      return;
    }
    if (version == null) {
      setSaveError(MISSING_VERSION_MESSAGE);
      return;
    }
    if (editor == null) return;

    const next =
      editor.mode === 'add'
        ? [...description, section]
        : description.map((item, index) => (index === editor.index ? section : item));

    setSaving(true);
    setSaveError(null);
    try {
      const saved = await patchCragDescription(crag.cragId, version, next);
      onDescriptionChange(saved);
      setEditor(null);
    } catch (error) {
      console.error('Failed to save description:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save description');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (index: number) => {
    const section = description[index];
    if (!section || busy) return;
    if (!canManageCrag(crag.cragId)) {
      setActionError(PERMISSION_MESSAGE);
      return;
    }
    const confirmed = window.confirm(`Remove the "${section.subheader}" section?`);
    if (!confirmed) return;
    if (version == null) {
      setActionError(MISSING_VERSION_MESSAGE);
      return;
    }

    setRemoving(true);
    setActionError(null);
    try {
      const next = description.filter((_, itemIndex) => itemIndex !== index);
      const saved = await patchCragDescription(crag.cragId, version, next);
      onDescriptionChange(saved);
    } catch (error) {
      console.error('Failed to remove description section:', error);
      setActionError(
        error instanceof Error ? error.message : 'Failed to remove description section',
      );
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="page">
      <div className="description-content">
        {actionError ? (
          <p className="description-action-error" role="alert">
            {actionError}
          </p>
        ) : null}
        {description.length > 0 ? (
          description.map((section, index) => (
            <div key={`${section.subheader}-${index}`} className="description-section">
              <div className="description-section-header">
                <h3>{section.subheader}</h3>
                {canEdit ? (
                  <div className="description-section-actions">
                    <Button
                      type="button"
                      iconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit ${section.subheader}`}
                      disabled={busy}
                      onClick={() => openEdit(index)}
                    >
                      <MdEdit />
                    </Button>
                    <Button
                      type="button"
                      iconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${section.subheader}`}
                      disabled={busy}
                      onClick={() => void handleRemove(index)}
                    >
                      <MdDelete />
                    </Button>
                  </div>
                ) : null}
              </div>
              <div
                className="description-body"
                dangerouslySetInnerHTML={{ __html: paragraphsToHtml(section.paragraphs) }}
              />
            </div>
          ))
        ) : canEdit ? null : (
          <p>Loading description...</p>
        )}
        {canEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="description-add"
            disabled={busy}
            onClick={openAdd}
          >
            Add section
          </Button>
        ) : null}
      </div>
      <DescriptionSectionModal
        key={editorKey(editor)}
        open={editor !== null}
        mode={editor?.mode ?? 'add'}
        initialName={editingSection?.subheader ?? ''}
        initialHtml={editingSection ? paragraphsToHtml(editingSection.paragraphs) : ''}
        saving={saving}
        error={saveError}
        onClose={closeEditor}
        onSave={(section) => void handleSave(section)}
      />
    </div>
  );
};

export default DescriptionPage;
