import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatLng } from '../types';
import { TOPO_TYPE_ERROR, readTopoGps } from '../utils/topoImage';
import AddTopoModal from './AddTopoModal';

vi.mock('../utils/topoImage', async () => {
  const actual = await vi.importActual<typeof import('../utils/topoImage')>('../utils/topoImage');
  return {
    ...actual,
    readTopoGps: vi.fn(async () => null),
  };
});

const sectorGeo: LatLng = { lat: 42.5, lon: 45.25 };

function jpegFile(name = 'topo.jpg'): File {
  const bytes = new Uint8Array(12);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  return new File([bytes], name, { type: 'image/jpeg' });
}

function renderModal(overrides: Partial<ComponentProps<typeof AddTopoModal>> = {}) {
  const onClose = vi.fn();
  const onSave = vi.fn();
  render(
    <AddTopoModal
      open
      offerPhotoLocation
      currentGeo={sectorGeo}
      saving={false}
      error={null}
      onClose={onClose}
      onSave={onSave}
      {...overrides}
    />,
  );
  return { onClose, onSave };
}

function chooseFile(file: File): void {
  fireEvent.change(screen.getByLabelText('Topo image'), { target: { files: [file] } });
}

describe('AddTopoModal', () => {
  beforeEach(() => {
    vi.mocked(readTopoGps).mockReset();
    vi.mocked(readTopoGps).mockResolvedValue(null);
  });

  it('keeps save disabled until a topo image is chosen', () => {
    renderModal();

    expect(screen.getByRole('dialog', { name: 'Add topo image' })).toBeInTheDocument();
    expect(screen.getByLabelText('Topo image')).toHaveAttribute('type', 'file');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows an error for an invalid image and does not ask about a location', async () => {
    const { onSave } = renderModal();
    chooseFile(new File(['not-an-image!'], 'notes.txt', { type: 'text/plain' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(TOPO_TYPE_ERROR);
    expect(screen.queryByRole('dialog', { name: 'Use photo location?' })).not.toBeInTheDocument();
    expect(readTopoGps).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a photo that has no location', async () => {
    const { onSave } = renderModal();
    const file = jpegFile();
    chooseFile(file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
    expect(readTopoGps).toHaveBeenCalledWith(file);
    expect(screen.queryByRole('dialog', { name: 'Use photo location?' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(file, null);
  });

  it('asks to use the photo location when the sector has no topos', async () => {
    const photo: LatLng = { lat: 41.1, lon: 44.2 };
    vi.mocked(readTopoGps).mockResolvedValue(photo);
    const { onSave } = renderModal();
    chooseFile(jpegFile());

    expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toHaveTextContent(
      'This photo was taken at 41.100000, 44.200000. Use that location for this sector?',
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Use photo location' }));

    expect(screen.queryByRole('dialog', { name: 'Use photo location?' })).not.toBeInTheDocument();
    expect(screen.getByText('Sector location will be 41.100000, 44.200000.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.any(File), photo);
  });

  it('drops an accepted photo location when a replacement has no GPS', async () => {
    const first = jpegFile('first.jpg');
    const replacement = jpegFile('second.jpg');
    vi.mocked(readTopoGps).mockImplementation(async (file) => (
      file === first ? { lat: 41.1, lon: 44.2 } : null
    ));
    const { onSave } = renderModal();
    chooseFile(first);
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo location' }));
    expect(screen.getByText('Sector location will be 41.100000, 44.200000.')).toBeInTheDocument();

    chooseFile(replacement);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
    expect(screen.queryByRole('dialog', { name: 'Use photo location?' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sector location will be/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(replacement, null);
  });

  it('compares a replacement photo with the sector pin', async () => {
    const first = jpegFile('first.jpg');
    const replacement = jpegFile('second.jpg');
    vi.mocked(readTopoGps).mockImplementation(async (file) => (
      file === first ? { lat: 41.1, lon: 44.2 } : sectorGeo
    ));
    const { onSave } = renderModal();
    chooseFile(first);
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo location' }));

    chooseFile(replacement);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
    expect(screen.queryByRole('dialog', { name: 'Use photo location?' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sector location will be/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(replacement, null);
  });

  it('keeps the map location when a replacement photo location is declined', async () => {
    const first = jpegFile('first.jpg');
    const replacement = jpegFile('second.jpg');
    const replacementGeo: LatLng = { lat: 40.2, lon: 43.3 };
    vi.mocked(readTopoGps).mockImplementation(async (file) => (
      file === first ? { lat: 41.1, lon: 44.2 } : replacementGeo
    ));
    const { onSave } = renderModal();
    chooseFile(first);
    fireEvent.click(await screen.findByRole('button', { name: 'Use photo location' }));

    chooseFile(replacement);
    expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toHaveTextContent(
      '40.200000, 43.300000',
    );
    expect(screen.queryByText(/Sector location will be/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep map location' }));

    expect(screen.queryByText(/Sector location will be/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(replacement, null);
  });

  it('keeps the sector location when the photo location is declined', async () => {
    vi.mocked(readTopoGps).mockResolvedValue({ lat: 41.1, lon: 44.2 });
    const { onSave } = renderModal();
    const file = jpegFile();
    chooseFile(file);
    expect(await screen.findByRole('dialog', { name: 'Use photo location?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Keep map location' }));

    expect(screen.queryByRole('dialog', { name: 'Use photo location?' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Sector location will be/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(file, null);
  });

  it('does not ask when the photo location matches the sector', async () => {
    vi.mocked(readTopoGps).mockResolvedValue(sectorGeo);
    renderModal();
    chooseFile(jpegFile());

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
    expect(readTopoGps).toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Use photo location?' })).not.toBeInTheDocument();
  });

  it('does not read a location when the sector already has a topo', async () => {
    vi.mocked(readTopoGps).mockResolvedValue({ lat: 41.1, lon: 44.2 });
    const { onSave } = renderModal({ offerPhotoLocation: false });
    const file = jpegFile();
    chooseFile(file);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });
    expect(readTopoGps).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Use photo location?' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(file, null);
  });

  it('closes after an image is selected without asking', async () => {
    const { onClose } = renderModal();
    chooseFile(jpegFile());
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Leave this topo?' })).not.toBeInTheDocument();
  });
});
