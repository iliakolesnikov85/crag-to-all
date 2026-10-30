import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CragContext } from '../../context/CragContext';
import type { Sector } from '../../types';
import {
  createSectorGeoEditor,
  type SectorEditPatch,
  type SectorGeoEditHost,
  type SectorGeoEditor,
} from '../../utils/map/sectorGeoEditor';
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
    save: vi.fn(async (patch: SectorEditPatch) => ({
      ...sector,
      geo: patch.geo ?? sector.geo,
      name: patch.name ?? sector.name,
      version: 4,
    })),
  } satisfies SectorGeoEditHost;
}

function renderInfo(host?: SectorGeoEditHost) {
  const editor = host
    ? createSectorGeoEditor({ geo: sector.geo!, name: sector.name, host })
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
    expect(screen.queryByRole('button', { name: 'Edit sector Shaumian' })).not.toBeInTheDocument();
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
    const editor = createSectorGeoEditor({ geo: sector.geo!, name: sector.name, host });
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

    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));

    expect(host.hidePopup).not.toHaveBeenCalled();
    expect(screen.queryByText('Route 4, 6A')).not.toBeInTheDocument();
    expect(screen.queryByText('and 1 more...')).not.toBeInTheDocument();
    expect(screen.getByText('You can drag the marker on the map to move it.')).toBeInTheDocument();
    const hint = screen.getByText('You can drag the marker on the map to move it.');
    const save = screen.getByRole('button', { name: 'Save sector Shaumian' });
    expect(save).toHaveTextContent('Save');
    expect(screen.getByRole('button', { name: 'Cancel sector edit for Shaumian' })).toHaveTextContent('Cancel');
    expect(hint.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('turns coordinates into inputs and moves the marker after blur', () => {
    const host = openEditor(false);
    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
      target: { value: 'north' },
    });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Latitude' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Latitude must be a number from -90 to 90.');
    expect(host.setLatLng).not.toHaveBeenCalled();
  });

  it('restores the original coordinates on cancel', () => {
    const host = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
      target: { value: '43' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel sector edit for Shaumian' }));

    expect(host.setLatLng).toHaveBeenCalledWith({ lat: 42.5, lon: 45.25 });
    expect(screen.getByText('42.500000, 45.250000')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Latitude' })).not.toBeInTheDocument();
    expect(screen.queryByText('You can drag the marker on the map to move it.')).not.toBeInTheDocument();
    expect(screen.getByText('Pobre Tortuguita, 6C+')).toBeInTheDocument();
  });

  it('saves coordinates and leaves edit mode', async () => {
    const host = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Longitude' }), {
      target: { value: '46' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sector Shaumian' }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Longitude' })).not.toBeInTheDocument();
    });
    expect(host.save).toHaveBeenCalledWith({ geo: { lat: 42.5, lon: 46 } });
    expect(screen.getByText('42.500000, 46.000000')).toBeInTheDocument();
  });

  it('keeps edit mode and shows the save error', async () => {
    const host = openEditor();
    host.save.mockRejectedValue(new Error('Could not save coordinates'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
      target: { value: '41' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save sector Shaumian' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save coordinates');
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('turns the name into an input and saves a rename without coordinates', async () => {
    const host = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));

    expect(screen.getByText('Name')).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: 'Name' });
    expect(name).toHaveValue('Shaumian');
    fireEvent.change(name, { target: { value: 'North Wall' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save sector North Wall' }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    });
    expect(host.save).toHaveBeenCalledWith({ name: 'North Wall' });
    expect(screen.getByRole('link', { name: 'North Wall' })).toHaveAttribute(
      'href',
      'sector/north%20wall',
    );
  });

  it('keeps edit mode when the name is empty', () => {
    const host = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save sector/ }));

    expect(host.save).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a sector name.');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('unlinks the sector image while the name is edited', () => {
    const host = createHost();
    const editor = createSectorGeoEditor({ geo: sector.geo!, name: sector.name, host });
    editors.push(editor);
    const { container } = render(
      <CragContext.Provider value={cragValue}>
        <SectorMapInfo
          sector={{ ...sector, images: [{ imageFile: 'shaumian.jpg' }] }}
          navigate={() => {}}
          geoEditor={editor}
        />
      </CragContext.Provider>,
    );

    const imageLink = container.querySelector('img')?.closest('a');
    expect(imageLink).toHaveAttribute('href', 'sector/shaumian');

    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
    expect(container.querySelector('img')?.closest('a')).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'North Wall' },
    });
    expect(container.querySelector('img')?.closest('a')).toBeNull();
    expect(container.querySelector('a[href*="north"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel sector edit for North Wall' }));
    expect(container.querySelector('img')?.closest('a')).toHaveAttribute('href', 'sector/shaumian');
  });

  it('restores the sector name on cancel', () => {
    const host = openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Other' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel sector edit for Other' }));

    expect(host.save).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Shaumian' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
  });
});

describe('SectorMapInfo new sector', () => {
  const draft: Sector = { name: '', geo: { lat: 42.5, lon: 45.25 }, routes: [], images: [] };
  const editors: SectorGeoEditor[] = [];

  afterEach(() => {
    for (const editor of editors) editor.dispose();
    editors.length = 0;
  });

  function renderDraft() {
    const host = createHost();
    const editor = createSectorGeoEditor({ geo: draft.geo!, name: '', isNew: true, host });
    editors.push(editor);
    editor.startEdit();
    render(
      <CragContext.Provider value={cragValue}>
        <SectorMapInfo sector={draft} navigate={() => {}} geoEditor={editor} isNew />
      </CragContext.Provider>,
    );
    return host;
  }

  it('opens in edit mode with an empty name and a topo file input', () => {
    renderDraft();

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('42.500000');
    expect(screen.getByLabelText('Topo image')).toHaveAttribute('type', 'file');
    expect(screen.getByRole('button', { name: 'Create sector' })).toHaveTextContent('Save');
    expect(screen.getByRole('button', { name: 'Discard new sector' })).toHaveTextContent('Cancel');
  });

  it('creates the sector with its name and location on save', async () => {
    const host = renderDraft();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'North Wall' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sector' }));

    await waitFor(() => {
      expect(host.setEditing).toHaveBeenLastCalledWith(false);
    });
    expect(host.save).toHaveBeenCalledWith({
      name: 'North Wall',
      geo: { lat: 42.5, lon: 45.25 },
    });
  });

  it('ends the draft on cancel without saving', () => {
    const host = renderDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Discard new sector' }));

    expect(host.save).not.toHaveBeenCalled();
    expect(host.setEditing).toHaveBeenLastCalledWith(false);
  });
});
