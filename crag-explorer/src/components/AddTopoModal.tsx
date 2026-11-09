import { useState } from 'react';
import type { LatLng } from '../types';
import { formatSectorCoordinatePair } from '../utils/map/sectorCoordinates';
import Button from './Button';
import Modal from './Modal';
import PhotoLocationPrompt from './PhotoLocationPrompt';
import SectorTopoInput from './map/SectorTopoInput';
import { useTopoFile } from './map/useTopoFile';
import './AddTopoModal.scss';

interface AddTopoModalProps {
  open: boolean;
  /** Ask about the photo's GPS. Used when the sector has no topos yet. */
  offerPhotoLocation: boolean;
  currentGeo: LatLng | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  /** `geo` is set when the user chose the photo location for a sector with no topos. */
  onSave: (file: File, geo: LatLng | null) => void;
}

function AddTopoModal({
  open,
  offerPhotoLocation,
  currentGeo,
  saving,
  error,
  onClose,
  onSave,
}: AddTopoModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [chosenGeo, setChosenGeo] = useState<LatLng | null>(null);
  const topo = useTopoFile({
    file,
    checkLocation: offerPhotoLocation,
    currentGeo,
    saving,
    onAccept(next) {
      // The location belongs to the photo that was just accepted. A replacement
      // starts over, compared with the sector pin rather than the previous choice.
      setChosenGeo(null);
      setFile(next);
    },
    onUseLocation: setChosenGeo,
  });
  const gpsPrompt = offerPhotoLocation ? topo.gpsPrompt : null;
  const waitForPhotoLocation = topo.pending || gpsPrompt != null;

  const requestClose = () => {
    if (saving) return;
    onClose();
  };

  const save = () => {
    if (saving || !file || waitForPhotoLocation) return;
    onSave(file, offerPhotoLocation ? chosenGeo : null);
  };

  return (
    <Modal
      open={open}
      title="Add topo image"
      closeOnBackdrop={false}
      onClose={requestClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving || !file || waitForPhotoLocation}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </>
      }
    >
      {error ? (
        <p className="add-topo__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="add-topo">
        <SectorTopoInput
          disabled={saving}
          previewUrl={topo.previewUrl}
          onFile={topo.chooseFile}
        />
        {topo.pending ? (
          <p className="add-topo__status" role="status">Checking photo...</p>
        ) : topo.error ? (
          <p className="add-topo__error" role="alert">{topo.error}</p>
        ) : null}
        {chosenGeo ? (
          <p className="add-topo__location">
            Sector location will be {formatSectorCoordinatePair(chosenGeo)}.
          </p>
        ) : null}
      </div>
      <PhotoLocationPrompt
        location={gpsPrompt}
        subject="this sector"
        onUse={topo.usePhotoLocation}
        onKeep={topo.dismissGpsPrompt}
      />
    </Modal>
  );
}

export default AddTopoModal;
