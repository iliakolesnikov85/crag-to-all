import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from '../../context/ConfirmContext';
import type { MarkerEditor } from '../../hooks/useMarkerEditor';
import type { CragMapMarker } from '../../types';
import { startMarkerEdit } from '../../utils/map/markerEditState';
import MarkerMapInfo from './MarkerMapInfo';

const marker: CragMapMarker = {
  type: 'parking_space',
  info: 'Lot A',
  geo: { lat: 44, lon: 6 },
};

function editorWith(remove: () => void): MarkerEditor {
  return {
    state: startMarkerEdit('0', marker.geo, marker.type, marker.info, false),
    startEdit() {},
    startDraft() {},
    setLatText() {},
    setLonText() {},
    setType() {},
    setInfoText() {},
    commitDraft() {},
    beginDrag() {},
    moveTo() {},
    endDrag() {},
    cancel() {},
    apply() {},
    remove,
    dismiss() {},
  };
}

function renderEditor(remove: () => void) {
  render(
    <ConfirmProvider>
      <MarkerMapInfo
        markerKey="0"
        marker={marker}
        index={0}
        editor={editorWith(remove)}
        editable
      />
    </ConfirmProvider>,
  );
}

describe('MarkerMapInfo delete', () => {
  it('asks before deleting and leaves the marker when cancelled', async () => {
    const remove = vi.fn();
    renderEditor(remove);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Parking' }));

    expect(screen.getByRole('dialog', { name: 'Delete marker' })).toHaveTextContent(
      'Delete the "Parking" marker?',
    );
    expect(remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes the marker after confirmation', async () => {
    const remove = vi.fn();
    renderEditor(remove);

    fireEvent.click(screen.getByRole('button', { name: 'Delete Parking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(remove).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
