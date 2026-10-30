import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CragContext } from '../../context/CragContext';
import type { LatLng, Sector } from '../../types';
import { createDraftTopo, type DraftTopo } from '../../utils/map/draftTopo';
import {
  createSectorGeoEditor,
  type SectorEditPatch,
  type SectorGeoEditHost,
  type SectorGeoEditor,
} from '../../utils/map/sectorGeoEditor';
import { TOPO_TYPE_ERROR, readTopoGps } from '../../utils/topoImage';
import SectorMapInfo from './SectorMapInfo';

vi.mock('../../utils/topoImage', async () => {
  const actual = await vi.importActual<typeof import('../../utils/topoImage')>('../../utils/topoImage');
  return {
    ...actual,
    readTopoGps: vi.fn(async () => null),
  };
});

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
  const topos: DraftTopo[] = [];

  beforeEach(() => {
    vi.mocked(readTopoGps).mockReset();
    vi.mocked(readTopoGps).mockResolvedValue(null);
  });

  afterEach(() => {
    for (const editor of editors) editor.dispose();
    editors.length = 0;
    for (const topo of topos) topo.dispose();
    topos.length = 0;
    vi.restoreAllMocks();
  });

  function jpegFile(): File {
    const bytes = new Uint8Array(12);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    return new File([bytes], 'topo.jpg', { type: 'image/jpeg' });
  }

  function renderDraft() {
    const host = createHost();
    const editor = createSectorGeoEditor({ geo: draft.geo!, name: '', isNew: true, host });
    const topo = createDraftTopo();
    editors.push(editor);
    topos.push(topo);
    editor.startEdit();
    render(
      <CragContext.Provider value={cragValue}>
        <SectorMapInfo sector={draft} navigate={() => {}} geoEditor={editor} topo={topo} isNew />
      </CragContext.Provider>,
    );
    return { host, topo };
  }

  function chooseFile(file: File): void {
    fireEvent.change(screen.getByLabelText('Topo image'), { target: { files: [file] } });
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
    const { host } = renderDraft();
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
    const { host } = renderDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Discard new sector' }));

    expect(host.save).not.toHaveBeenCalled();
    expect(host.setEditing).toHaveBeenLastCalledWith(false);
  });

  it('shows an error for an invalid image and does not ask about a location', async () => {
    renderDraft();
    chooseFile(new File(['not-an-image!'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(TOPO_TYPE_ERROR);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(readTopoGps).not.toHaveBeenCalled();
    expect(document.querySelector('.sector-map-info__topo-preview')).toBeNull();
  });

  it('keeps an accepted photo when a later file is rejected', async () => {
    renderDraft();
    chooseFile(jpegFile());
    await waitFor(() => {
      expect(document.querySelector('.sector-map-info__topo-preview')).toBeTruthy();
    });

    chooseFile(new File(['not-an-image!'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(TOPO_TYPE_ERROR);
    expect(document.querySelector('.sector-map-info__topo-preview')).toHaveAttribute('src', 'blob:preview');
  });

  it('moves the pin when the photo location is used', async () => {
    const photo: LatLng = { lat: 41.1, lon: 44.2 };
    vi.mocked(readTopoGps).mockResolvedValue(photo);
    const { host } = renderDraft();
    chooseFile(jpegFile());

    expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();
    expect(screen.getByText(/41\.100000, 44\.200000/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use photo location' }));

    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('41.100000');
    expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('44.200000');
    expect(host.setLatLng).toHaveBeenCalledWith(photo);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create sector' })).toBeEnabled();
  });

  it('leaves the clicked location when the photo location is declined', async () => {
    vi.mocked(readTopoGps).mockResolvedValue({ lat: 41.1, lon: 44.2 });
    const { host } = renderDraft();
    chooseFile(jpegFile());
    expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep map location' }));

    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('42.500000');
    expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('45.250000');
    expect(host.setLatLng).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('keeps the clicked location when the location dialog is dismissed', async () => {
    vi.mocked(readTopoGps).mockResolvedValue({ lat: 41.1, lon: 44.2 });
    renderDraft();
    chooseFile(jpegFile());
    expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('42.500000');
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
  });

  it('does not ask when the photo location matches the pin', async () => {
    vi.mocked(readTopoGps).mockResolvedValue({ lat: 42.5, lon: 45.25 });
    renderDraft();
    chooseFile(jpegFile());

    await waitFor(() => {
      expect(readTopoGps).toHaveBeenCalled();
    });
    await vi.mocked(readTopoGps).mock.results[0]?.value;
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.sector-map-info__topo-preview')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create sector' })).toBeEnabled();
  });

  it('keeps the photo when its location cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(readTopoGps).mockRejectedValue(new Error('bad exif'));
    renderDraft();
    chooseFile(jpegFile());

    await waitFor(() => {
      expect(warn).toHaveBeenCalled();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('.sector-map-info__topo-preview')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create sector' })).toBeEnabled();
    warn.mockRestore();
  });

  it('does not save until the photo location has been read and chosen', async () => {
    let resolveGps: (geo: LatLng | null) => void = () => {};
    vi.mocked(readTopoGps).mockReturnValue(new Promise((resolve) => {
      resolveGps = resolve;
    }));
    const { host } = renderDraft();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'North Wall' },
    });
    chooseFile(jpegFile());

    expect(await screen.findByRole('status')).toHaveTextContent('Checking photo...');
    await waitFor(() => {
      expect(document.querySelector('.sector-map-info__topo-preview')).toBeTruthy();
    });
    const save = screen.getByRole('button', { name: 'Create sector' });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Enter' });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Latitude' }), { key: 'Enter' });
    expect(host.save).not.toHaveBeenCalled();

    resolveGps({ lat: 41.1, lon: 44.2 });

    expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();
    expect(save).toBeDisabled();
    expect(host.save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Keep map location' }));

    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => {
      expect(host.save).toHaveBeenCalledWith({
        name: 'North Wall',
        geo: { lat: 42.5, lon: 45.25 },
      });
    });
  });

  it('does not apply the photo location while the sector is already saving', async () => {
    let releaseSave: (() => void) | undefined;
    const { host, topo } = renderDraft();
    host.save.mockReturnValue(new Promise((resolve) => {
      releaseSave = () => resolve({
        ...sector,
        name: 'North Wall',
        version: 4,
      });
    }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'North Wall' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create sector' }));
    await waitFor(() => expect(host.save).toHaveBeenCalled());

    topo.setGpsPrompt({ lat: 41.1, lon: 44.2 });

    expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use photo location' }));

    expect(screen.getByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('42.500000');
    expect(host.setLatLng).not.toHaveBeenCalled();

    releaseSave?.();
    await waitFor(() => expect(host.setEditing).toHaveBeenLastCalledWith(false));
  });
});
