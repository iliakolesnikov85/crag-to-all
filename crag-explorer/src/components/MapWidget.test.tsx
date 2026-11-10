import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSector, patchCrag } from '../api/client';
import { CragContext } from '../context/CragContext';
import { SAMPLE_CRAG_ID, sampleCragData } from '../test/fixtures/cragData';
import { withQueryClient } from '../test/helpers';
import type { CragData, Sector } from '../types';
import MapWidget from './MapWidget';

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    createSector: vi.fn(),
    patchCrag: vi.fn(),
    patchSectorGeo: vi.fn(),
    uploadCragImage: vi.fn(),
  };
});

const MAIN: Sector = {
  ...sampleCragData.sectors[0],
  id: 'main',
  version: 1,
};

const EMPTY: Sector = {
  ...sampleCragData.sectors[1],
  id: 'empty',
  version: 1,
};

const INITIAL: CragData = {
  ...sampleCragData,
  source: 'explorer',
  sectors: [MAIN, EMPTY],
};

const cragValue = {
  crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag', source: 'explorer' as const },
  getUrl: (url: string) => `/${url}`,
};

function MapHarness({ initial = INITIAL }: { initial?: CragData }) {
  const [data, setData] = useState(initial);
  return (
    <MapWidget
      cragData={data}
      onSectorCreated={(sector) => {
        setData((current) => ({ ...current, sectors: [...current.sectors, sector] }));
      }}
      onSectorGeoSaved={(sector) => {
        setData((current) => ({
          ...current,
          sectors: current.sectors.map((item) => (item.id === sector.id ? sector : item)),
        }));
      }}
    />
  );
}

function markerByLabel(name: string): HTMLElement {
  const labels = [...document.querySelectorAll('.custom-marker .label')];
  const label = labels.find((node) => node.textContent === name);
  const icon = label?.closest('.leaflet-marker-icon');
  if (!(icon instanceof HTMLElement)) {
    throw new Error(`No map marker labelled ${name}`);
  }
  return icon;
}

function clickMapBackground(): void {
  const container = document.querySelector('.leaflet-container');
  if (!(container instanceof HTMLElement)) throw new Error('Map has not been created');
  fireEvent.click(container);
}

async function startPlacing(name: 'Add sector' | 'Add marker'): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  const subject = name === 'Add marker' ? 'marker' : 'sector';
  expect(screen.getByRole('status')).toHaveTextContent(`Click the map where the new ${subject} should be`);
  // Placement ignores the activating click; wait until the map listener is armed.
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

/** A promise that stays pending until the test rejects it. */
function holdRejection(): { promise: Promise<never>; reject: (error: Error) => void } {
  let reject = (_error: Error) => {};
  const promise = new Promise<never>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject: (error) => reject(error) };
}

describe('MapWidget', () => {
  beforeEach(() => {
    vi.mocked(createSector).mockReset();
    vi.mocked(patchCrag).mockReset();
  });

  function renderMap(initial?: CragData) {
    return render(
      withQueryClient(
        <MemoryRouter>
          <CragContext.Provider value={cragValue}>
            <MapHarness initial={initial} />
          </CragContext.Provider>
        </MemoryRouter>,
      ),
    );
  }

  it('opens the sector card when a marker is clicked and closes it on a map click', async () => {
    renderMap();

    await waitFor(() => {
      expect(markerByLabel('Main Wall')).toBeTruthy();
    });
    fireEvent.click(markerByLabel('Main Wall'));

    expect(screen.getByRole('dialog', { name: 'Sector details' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Main Wall' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Sector details' })).not.toBeInTheDocument();

    fireEvent.click(markerByLabel('Main Wall'));
    expect(screen.getByRole('dialog', { name: 'Sector details' })).toBeInTheDocument();

    clickMapBackground();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Sector details' })).not.toBeInTheDocument();
    });
  });

  it('places a draft sector from the add-sector control', async () => {
    renderMap();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add sector' })).toBeInTheDocument();
    });
    await startPlacing('Add sector');
    expect(document.querySelectorAll('.custom-marker .label')).toHaveLength(1);

    clickMapBackground();

    await waitFor(() => {
      expect(markerByLabel('New sector')).toBeTruthy();
    });
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create sector' })).toBeInTheDocument();
  });

  it('removes the draft when it is cancelled', async () => {
    renderMap();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add sector' })).toBeInTheDocument();
    });
    await startPlacing('Add sector');
    clickMapBackground();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Discard new sector' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Discard new sector' }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    });
    expect(document.querySelectorAll('.custom-marker .label')).toHaveLength(1);
    expect(createSector).not.toHaveBeenCalled();
  });

  it('selects the created sector after save', async () => {
    const created: Sector = {
      id: 'north',
      name: 'North Wall',
      version: 1,
      geo: { lat: 42.2, lon: 44.6 },
      routes: [],
      images: [],
    };
    vi.mocked(createSector).mockResolvedValue(created);
    renderMap();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add sector' })).toBeInTheDocument();
    });
    await startPlacing('Add sector');
    clickMapBackground();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'North Wall' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sector' }));

    await waitFor(() => {
      expect(createSector).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'North Wall' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Sector details' })).toBeInTheDocument();
  });

  it('drops a marker edit when the card was closed and the save then fails', async () => {
    const pending = holdRejection();
    vi.mocked(patchCrag).mockReturnValue(pending.promise);
    renderMap({ ...INITIAL, version: 1, markers: [] });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add marker' })).toBeInTheDocument();
    });
    await startPlacing('Add marker');
    clickMapBackground();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create marker' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create marker' }));
    await waitFor(() => {
      expect(patchCrag).toHaveBeenCalled();
    });
    expect(document.querySelector('.custom-marker--editing')).toBeTruthy();

    clickMapBackground();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Map marker' })).not.toBeInTheDocument();
    });
    expect(document.querySelector('.custom-marker--editing')).toBeTruthy();

    pending.reject(new Error('Could not save marker'));

    await waitFor(() => {
      expect(document.querySelector('.custom-marker--editing')).toBeNull();
    });
    expect(document.querySelector('.map-marker')).toBeNull();
    expect(screen.queryByRole('dialog', { name: 'Map marker' })).not.toBeInTheDocument();
  });
});
