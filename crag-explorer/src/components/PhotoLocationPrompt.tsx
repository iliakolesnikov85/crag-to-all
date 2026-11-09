import type { LatLng } from '../types';
import { formatSectorCoordinatePair } from '../utils/map/sectorCoordinates';
import Button from './Button';
import Modal from './Modal';
import './PhotoLocationPrompt.scss';

interface PhotoLocationPromptProps {
  location: LatLng | null;
  /** Completes the question: "Use that location for {subject}?" */
  subject: string;
  onUse: () => void;
  onKeep: () => void;
}

/** Asks whether a topo photo's GPS should become the sector location. */
function PhotoLocationPrompt({ location, subject, onUse, onKeep }: PhotoLocationPromptProps) {
  if (!location) return null;

  return (
    <Modal
      open
      title="Use photo location?"
      onClose={onKeep}
      footer={
        <>
          <Button type="button" size="sm" variant="secondary" onClick={onKeep}>
            Keep map location
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={onUse}>
            Use photo location
          </Button>
        </>
      }
    >
      <p className="photo-location-prompt">
        This photo was taken at {formatSectorCoordinatePair(location)}. Use that location for {subject}?
      </p>
    </Modal>
  );
}

export default PhotoLocationPrompt;
