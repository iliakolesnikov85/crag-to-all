import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CragContext } from '../context/CragContext';
import type { LatLng, Sector } from '../types';
import {
  createSectorGeoEditor,
  type SectorGeoEditHost,
  type SectorGeoEditor,
} from '../utils/map/sectorGeoEditor';
import SectorMapInfo from './SectorMapInfo';

const cragValue = {
  crag: { cragId: 'shulaveri', cragName: 'Shulaveri', source: 'explorer' as const },
  getUrl: (url: string) => url,
};

const sector: Sector = {
  id: 'shaumian',
  name: 'Shaumian',
  version: 3,
  geo: { lat: 42.5, lon: 45.25 },
  routes: [
    {
      name: 'Pobre Tortuguita',
      grade: '6C+',
      sectorName: 'Shaumian',
      description: '',
      tags: [],
      images: [],
    },
  ],
  images: [],
};

function createHost(inView = true) {
  return {
    setEditing: vi.fn(),
    setDragging: vi.fn(),
    setLatLng: vi.fn(),
    isInView: vi.fn(() => inView),
    centerOn: vi.fn(),
    hidePopup: vi.fn(),
    showPopup: vi.fn(),
    save: vi.fn(async (geo: LatLng) => ({ ...sector, geo, version: 4 })),
  } satisfies SectorGeoEditHost;
}

function renderInfo(host?: SectorGeoEditHost) {
  const editor = host
    ? createSectorGeoEditor({ geo: sector.geo!, host })
    : null;
  render(
    <CragContext.Provider value={cragValue}>
      <SectorMapInfo sector={sector} navigate={() => {}} geoEditor={editor} />
    </CragContext.Provider>,
  );
  return editor;
}

describe('SectorMapInfo coordinates', () => {
  const editors: SectorGeoEditor[] = [];

  afterEach(() => {
    for (const editor of editors) editor.dispose();
    editors.length = 0;
  });

  function openEditor(inView = true) {
    const host = createHost(inView);
    const editor = renderInfo(host);
    if (editor) editors.push(editor);
    return host;
  }

  it('shows coordinates and no edit button when the pin cannot be moved', () => {
    renderInfo();

    expect(screen.getByText('42.500000, 45.250000')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit coordinates for Shaumian' })).not.toBeInTheDocument();
  });

  it('omits the coordinate row when the sector has no location', () => {
    render(
      <CragContext.Provider value={cragValue}>
        <SectorMapInfo
          sector={{ ...sector, geo: null }}
          navigate={() => {}}
        />
      </CragContext.Provider>,
    );

    expect(screen.getByText('Shaumian')).toBeInTheDocument();
    expect(screen.queryByText(/42\.500000/)).not.toBeInTheDocument();
  });

  it('shows four routes, then replaces them with a drag hint while editing', () => {
    const routes = [1, 2, 3, 4, 5].map((index) => ({
      name: `Route ${index}`,
      grade: '6A',
      sectorName: 'Shaumian',
      description: '',
      tags: [],
      images: [],
    }));
    const host = createHost();
    const editor = createSectorGeoEditor({ geo: sector.geo!, host });
    editors.push(editor);
    render(
      <CragContext.Provider value={cragValue}>
        <SectorMapInfo
          sector={{ ...sector, routes }}
          navigate={() => {}}
          geoEditor={editor}
        />
      </CragContext.Provider>,
    );

    expect(screen.getByText('Route 4, 6A')).toBeInTheDocument();
    expect(screen.queryByText('Route 5, 6A')).not.toBeInTheDocument();
    expect(screen.getByText('and 1 more...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit coordinates for Shaumian' }));

    expect(host.hidePopup).not.toHaveBeenCalled();
    expect(screen.queryByText('Route 4, 6A')).not.toBeInTheDocument();
    expect(screen.queryByText('and 1 more...')).not.toBeInTheDocument();
    expect(screen.getByText('You can drag the marker on the map to move it.')).toBeInTheDocument();
    const hint = screen.getByText('You can drag the marker on the map to move it.');
    const save = screen.getByRole('button', { name: 'Save coordinates for Shaumian' });
    expect(save).toHaveTextContent('Save');
    expect(screen.getByRole('button', { name: 'Cancel coordinate edit for Shaumian' })).toHaveTextContent('Cancel');
    expect(hint.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('turns coordinates into inputs and moves the marker after blur', () => {
    const host = openEditor(false);
    fireEvent.click(screen.getByRole('button', { name: 'Edit coordinates for Shaumian' }));

    const latitude = screen.getByRole('textbox', { name: 'Latitude' });
    expect(latitude).toHaveValue('42.500000');
    expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('45.250000');

    fireEvent.change(latitude, { target: { value: '43' } });
    expect(host.setLatLng).not.toHaveBeenCalled();

    fireEvent.blur(latitude);

    expect(host.setLatLng).toHaveBeenCalledWith({ lat: 43, lon: 45.25 });
    expect(host.centerOn).toHaveBeenCalledWith({ lat: 43, lon: 45.25 });
    expect(latitude).toHaveValue('43.000000');
  });

  it('shows a validation error and does not move the marker', () => {
    const host = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Edit coordinates for Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
      target: { value: 'north' },
    });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Latitude' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Latitude must be a number from -90 to 90.');
    expect(host.setLatLng).not.toHaveBeenCalled();
  });

  it('restores the original coordinates on cancel', () => {
    const host = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Edit coordinates for Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
      target: { value: '43' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel coordinate edit for Shaumian' }));

    expect(host.setLatLng).toHaveBeenCalledWith({ lat: 42.5, lon: 45.25 });
    expect(screen.getByText('42.500000, 45.250000')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Latitude' })).not.toBeInTheDocument();
    expect(screen.queryByText('You can drag the marker on the map to move it.')).not.toBeInTheDocument();
    expect(screen.getByText('Pobre Tortuguita, 6C+')).toBeInTheDocument();
  });

  it('saves coordinates and leaves edit mode', async () => {
    const host = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Edit coordinates for Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Longitude' }), {
      target: { value: '46' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save coordinates for Shaumian' }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Longitude' })).not.toBeInTheDocument();
    });
    expect(host.save).toHaveBeenCalledWith({ lat: 42.5, lon: 46 });
    expect(screen.getByText('42.500000, 46.000000')).toBeInTheDocument();
  });

  it('keeps edit mode and shows the save error', async () => {
    const host = openEditor();
    host.save.mockRejectedValue(new Error('Could not save coordinates'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Edit coordinates for Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
      target: { value: '41' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save coordinates for Shaumian' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save coordinates');
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
