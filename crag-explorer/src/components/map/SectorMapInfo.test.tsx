import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CragContext } from '../../context/CragContext';
import { useSectorEditor, type NewSectorInput } from '../../hooks/useSectorEditor';
import type { LatLng, Sector } from '../../types';
import { DRAFT_SECTOR_ID, DRAFT_SECTOR_LABEL, type SectorEditPatch } from '../../utils/map/sectorEditState';
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
      id: 'pobre',
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

type SaveSector = (sector: Sector, patch: SectorEditPatch) => Promise<Sector>;
type CreateSector = (input: NewSectorInput, topo: File | null) => Promise<Sector>;

interface HarnessProps {
  sector: Sector;
  editable?: boolean;
  isNew?: boolean;
  map: L.Map;
  saveSector: SaveSector;
  createSector: CreateSector;
}

/** Hosts the editor the way MapWidget does and exposes the pin position for assertions. */
function Harness({ sector: initial, editable = true, isNew = false, map, saveSector, createSector }: HarnessProps) {
  const [current, setCurrent] = useState(initial);
  const editor = useSectorEditor({
    map,
    sectors: isNew ? [current] : [current],
    saveSector,
    createSector,
    onSaved: setCurrent,
  });
  const started = useRef(false);
  const { startDraft } = editor;
  useEffect(() => {
    if (!isNew || started.current || !initial.geo) return;
    started.current = true;
    startDraft(initial.geo);
  }, [isNew, initial.geo, startDraft]);

  const edit = editor.state;
  const shown: Sector | null = isNew
    ? edit?.target === DRAFT_SECTOR_ID
      ? { id: DRAFT_SECTOR_ID, name: DRAFT_SECTOR_LABEL, geo: edit.currentGeo, routes: [], images: [] }
      : null
    : current;

  return (
    <>
      <div data-testid="pin">{edit ? `${edit.currentGeo.lat},${edit.currentGeo.lon}` : 'none'}</div>
      {shown ? <SectorMapInfo sector={shown} editor={editor} editable={editable} isNew={isNew} /> : null}
    </>
  );
}

function defaultSave(): SaveSector {
  return vi.fn(async (target: Sector, patch: SectorEditPatch) => ({
    ...target,
    geo: patch.geo ?? target.geo,
    name: patch.name ?? target.name,
    version: 4,
  }));
}

function defaultCreate(): CreateSector {
  return vi.fn(async (input: NewSectorInput) => ({
    id: 'new-1',
    version: 1,
    routes: [],
    images: [],
    ...input,
  }));
}

describe('SectorMapInfo', () => {
  let map: L.Map;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    map = L.map(container).setView([42.5, 45.25], 14);
  });

  afterEach(() => {
    map.remove();
    container.remove();
    vi.restoreAllMocks();
  });

  function renderInfo(overrides: Partial<HarnessProps> = {}) {
    const props: HarnessProps = {
      sector,
      map,
      saveSector: defaultSave(),
      createSector: defaultCreate(),
      ...overrides,
    };
    const view = render(
      <MemoryRouter>
        <CragContext.Provider value={cragValue}>
          <Harness {...props} />
        </CragContext.Provider>
      </MemoryRouter>,
    );
    return { ...view, props };
  }

  function pin(): string {
    return screen.getByTestId('pin').textContent ?? '';
  }

  describe('coordinates', () => {
    it('shows coordinates and no edit button when the pin cannot be moved', () => {
      renderInfo({ editable: false });

      expect(screen.getByText('42.500000, 45.250000')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit sector Shaumian' })).not.toBeInTheDocument();
    });

    it('omits the coordinate row when the sector has no location', () => {
      renderInfo({ sector: { ...sector, geo: null } });

      expect(screen.getByText('Shaumian')).toBeInTheDocument();
      expect(screen.queryByText(/42\.500000/)).not.toBeInTheDocument();
    });

    it('shows four routes, then replaces them with a drag hint while editing', () => {
      const routes = [1, 2, 3, 4, 5].map((index) => ({
        id: `route-${index}`,
        name: `Route ${index}`,
        grade: '6A',
        sectorName: 'Shaumian',
        description: '',
        tags: [],
        images: [],
      }));
      renderInfo({ sector: { ...sector, routes } });

      expect(screen.getByText('Route 4, 6A')).toBeInTheDocument();
      expect(screen.queryByText('Route 5, 6A')).not.toBeInTheDocument();
      expect(screen.getByText('and 1 more...')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));

      expect(screen.queryByText('Route 4, 6A')).not.toBeInTheDocument();
      expect(screen.queryByText('and 1 more...')).not.toBeInTheDocument();
      const hint = screen.getByText('You can drag the marker on the map to move it.');
      const save = screen.getByRole('button', { name: 'Save sector Shaumian' });
      expect(save).toHaveTextContent('Save');
      expect(screen.getByRole('button', { name: 'Cancel sector edit for Shaumian' })).toHaveTextContent('Cancel');
      expect(hint.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('turns coordinates into inputs and moves the pin after blur', () => {
      const panTo = vi.spyOn(map, 'panTo');
      renderInfo();
      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));

      const latitude = screen.getByRole('textbox', { name: 'Latitude' });
      expect(latitude).toHaveValue('42.500000');
      expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('45.250000');

      fireEvent.change(latitude, { target: { value: '43' } });
      expect(pin()).toBe('42.5,45.25');

      fireEvent.blur(latitude);

      expect(pin()).toBe('43,45.25');
      // jsdom gives the map no size, so the new point is outside the view.
      expect(panTo).toHaveBeenCalledWith([43, 45.25], { animate: false });
      expect(latitude).toHaveValue('43.000000');
    });

    it('shows a validation error and does not move the pin', () => {
      renderInfo();
      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
        target: { value: 'north' },
      });
      fireEvent.blur(screen.getByRole('textbox', { name: 'Latitude' }));

      expect(screen.getByRole('alert')).toHaveTextContent('Latitude must be a number from -90 to 90.');
      expect(pin()).toBe('42.5,45.25');
    });

    it('restores the original coordinates on cancel', () => {
      renderInfo();
      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Latitude' }), {
        target: { value: '43' },
      });
      fireEvent.blur(screen.getByRole('textbox', { name: 'Latitude' }));
      expect(pin()).toBe('43,45.25');

      fireEvent.click(screen.getByRole('button', { name: 'Cancel sector edit for Shaumian' }));

      expect(pin()).toBe('none');
      expect(screen.getByText('42.500000, 45.250000')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Latitude' })).not.toBeInTheDocument();
      expect(screen.queryByText('You can drag the marker on the map to move it.')).not.toBeInTheDocument();
      expect(screen.getByText('Pobre Tortuguita, 6C+')).toBeInTheDocument();
    });

    it('saves coordinates and leaves edit mode', async () => {
      const { props } = renderInfo();
      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Longitude' }), {
        target: { value: '46' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save sector Shaumian' }));

      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: 'Longitude' })).not.toBeInTheDocument();
      });
      expect(props.saveSector).toHaveBeenCalledWith(sector, { geo: { lat: 42.5, lon: 46 } });
      expect(screen.getByText('42.500000, 46.000000')).toBeInTheDocument();
    });

    it('keeps edit mode and shows the save error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const saveSector = vi.fn(async () => {
        throw new Error('Could not save coordinates');
      });
      renderInfo({ saveSector });
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
      const { props } = renderInfo();
      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));

      expect(screen.getByText('Name')).toBeInTheDocument();
      const name = screen.getByRole('textbox', { name: 'Name' });
      expect(name).toHaveValue('Shaumian');
      fireEvent.change(name, { target: { value: 'North Wall' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save sector North Wall' }));

      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
      });
      expect(props.saveSector).toHaveBeenCalledWith(sector, { name: 'North Wall' });
      expect(screen.getByRole('link', { name: 'North Wall' })).toHaveAttribute(
        'href',
        '/sector/north%20wall',
      );
    });

    it('keeps edit mode when the name is empty', () => {
      const { props } = renderInfo();
      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: '   ' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Save sector/ }));

      expect(props.saveSector).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent('Enter a sector name.');
      expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    });

    it('unlinks the sector image while the name is edited', () => {
      const { container: root } = renderInfo({
        sector: { ...sector, images: [{ imageFile: 'shaumian.jpg' }] },
      });

      const imageLink = root.querySelector('img')?.closest('a');
      expect(imageLink).toHaveAttribute('href', '/sector/shaumian');

      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
      expect(root.querySelector('img')?.closest('a')).toBeNull();

      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: 'North Wall' },
      });
      expect(root.querySelector('img')?.closest('a')).toBeNull();
      expect(root.querySelector('a[href*="north"]')).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel sector edit for North Wall' }));
      expect(root.querySelector('img')?.closest('a')).toHaveAttribute('href', '/sector/shaumian');
    });

    it('restores the sector name on cancel', () => {
      const { props } = renderInfo();
      fireEvent.click(screen.getByRole('button', { name: 'Edit sector Shaumian' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: 'Other' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel sector edit for Other' }));

      expect(props.saveSector).not.toHaveBeenCalled();
      expect(screen.getByRole('link', { name: 'Shaumian' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'Name' })).not.toBeInTheDocument();
    });
  });

  describe('new sector', () => {
    const draft: Sector = { name: '', geo: { lat: 42.5, lon: 45.25 }, routes: [], images: [] };

    beforeEach(() => {
      vi.mocked(readTopoGps).mockReset();
      vi.mocked(readTopoGps).mockResolvedValue(null);
    });

    function jpegFile(): File {
      const bytes = new Uint8Array(12);
      bytes[0] = 0xff;
      bytes[1] = 0xd8;
      bytes[2] = 0xff;
      return new File([bytes], 'topo.jpg', { type: 'image/jpeg' });
    }

    function renderDraft(overrides: Partial<HarnessProps> = {}) {
      return renderInfo({ sector: draft, isNew: true, ...overrides });
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
      const { props } = renderDraft();
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: 'North Wall' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create sector' }));

      await waitFor(() => {
        expect(pin()).toBe('none');
      });
      expect(props.createSector).toHaveBeenCalledWith(
        { name: 'North Wall', geo: { lat: 42.5, lon: 45.25 } },
        null,
      );
    });

    it('ends the draft on cancel without saving', () => {
      const { props } = renderDraft();
      fireEvent.click(screen.getByRole('button', { name: 'Discard new sector' }));

      expect(props.createSector).not.toHaveBeenCalled();
      expect(pin()).toBe('none');
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

    it('uploads the chosen photo with the new sector', async () => {
      const { props } = renderDraft();
      const file = jpegFile();
      chooseFile(file);
      await waitFor(() => {
        expect(document.querySelector('.sector-map-info__topo-preview')).toBeTruthy();
      });
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
        target: { value: 'North Wall' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Create sector' }));

      await waitFor(() => {
        expect(props.createSector).toHaveBeenCalledWith(
          { name: 'North Wall', geo: { lat: 42.5, lon: 45.25 } },
          file,
        );
      });
    });

    it('moves the pin when the photo location is used', async () => {
      const photo: LatLng = { lat: 41.1, lon: 44.2 };
      vi.mocked(readTopoGps).mockResolvedValue(photo);
      renderDraft();
      chooseFile(jpegFile());

      expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();
      expect(screen.getByText(/41\.100000, 44\.200000/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Use photo location' }));

      expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('41.100000');
      expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('44.200000');
      expect(pin()).toBe('41.1,44.2');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create sector' })).toBeEnabled();
    });

    it('leaves the clicked location when the photo location is declined', async () => {
      vi.mocked(readTopoGps).mockResolvedValue({ lat: 41.1, lon: 44.2 });
      renderDraft();
      chooseFile(jpegFile());
      expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Keep map location' }));

      expect(screen.getByRole('textbox', { name: 'Latitude' })).toHaveValue('42.500000');
      expect(screen.getByRole('textbox', { name: 'Longitude' })).toHaveValue('45.250000');
      expect(pin()).toBe('42.5,45.25');
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
        expect(document.querySelector('.sector-map-info__topo-preview')).toBeTruthy();
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create sector' })).toBeEnabled();
      });
      expect(readTopoGps).toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps the photo when its location cannot be read', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mocked(readTopoGps).mockRejectedValue(new Error('bad exif'));
      renderDraft();
      chooseFile(jpegFile());

      await waitFor(() => {
        expect(warn).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(document.querySelector('.sector-map-info__topo-preview')).toBeTruthy();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create sector' })).toBeEnabled();
      warn.mockRestore();
    });

    it('does not save until the photo location has been read and chosen', async () => {
      let resolveGps: (geo: LatLng | null) => void = () => {};
      vi.mocked(readTopoGps).mockReturnValue(new Promise((resolve) => {
        resolveGps = resolve;
      }));
      const { props } = renderDraft();
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
      expect(props.createSector).not.toHaveBeenCalled();

      resolveGps({ lat: 41.1, lon: 44.2 });

      expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();
      expect(save).toBeDisabled();
      expect(props.createSector).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Keep map location' }));

      expect(save).toBeEnabled();
      fireEvent.click(save);
      await waitFor(() => {
        expect(props.createSector).toHaveBeenCalledWith(
          { name: 'North Wall', geo: { lat: 42.5, lon: 45.25 } },
          expect.any(File),
        );
      });
    });
  });
});
