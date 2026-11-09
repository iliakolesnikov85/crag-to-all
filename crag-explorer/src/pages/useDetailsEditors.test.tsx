import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { patchSectorGeo } from '../api/client';
import { CragContext } from '../context/CragContext';
import { withQueryClient } from '../test/helpers';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import type { Sector } from '../types';
import useDetailsEditors from './useDetailsEditors';

vi.mock('../api/client', () => ({
  patchSectorGeo: vi.fn(),
}));

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
  getUrl: (url: string) => url,
};

const editableSector: Sector = {
  ...sampleCragData.sectors[0],
  id: 'sector-1',
  version: 2,
};

const MISSING_SECTOR_MESSAGE = 'This sector could not be found. Reload the page and try again.';

function EditorsHarness({ initialSectors }: { initialSectors: Sector[] }) {
  const [sectors, setSectors] = useState(initialSectors);
  const editors = useDetailsEditors({ sectors });
  return (
    <>
      <button type="button" onClick={() => editors.openNewRoute(editableSector)}>Add route</button>
      <button type="button" onClick={() => editors.openRoute(editableSector, 0)}>Edit route</button>
      <button type="button" onClick={() => setSectors([])}>Drop sector</button>
      {editors.dialogs}
    </>
  );
}

function renderEditors() {
  return render(
    withQueryClient(
      <CragContext.Provider value={cragValue}>
        <EditorsHarness initialSectors={[editableSector]} />
      </CragContext.Provider>,
    ),
  );
}

describe('useDetailsEditors saveRoute', () => {
  beforeEach(() => {
    vi.mocked(patchSectorGeo).mockReset();
  });

  it('refuses to add a route when the sector is no longer loaded', () => {
    renderEditors();
    fireEvent.click(screen.getByRole('button', { name: 'Add route' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Arete' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop sector' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('dialog', { name: 'Add route' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(MISSING_SECTOR_MESSAGE);
    expect(patchSectorGeo).not.toHaveBeenCalled();
  });

  it('refuses to edit a route when the sector is no longer loaded', () => {
    renderEditors();
    fireEvent.click(screen.getByRole('button', { name: 'Edit route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Drop sector' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('dialog', { name: 'Edit route' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(MISSING_SECTOR_MESSAGE);
    expect(patchSectorGeo).not.toHaveBeenCalled();
  });
});
