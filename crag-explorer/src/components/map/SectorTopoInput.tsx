import React from 'react';
import { MdAddPhotoAlternate } from 'react-icons/md';

interface SectorTopoInputProps {
  disabled?: boolean;
}

/** Topo image picker for a new sector. The chosen file is not uploaded yet. */
const SectorTopoInput: React.FC<SectorTopoInputProps> = ({ disabled }) => {
  return (
    <label className="sector-map-info__topo-input">
      <MdAddPhotoAlternate className="sector-map-info__topo-icon" aria-hidden="true" />
      <span className="sector-map-info__topo-label">Add topo</span>
      <input
        className="sector-map-info__topo-file"
        type="file"
        accept="image/*"
        aria-label="Topo image"
        disabled={disabled}
      />
    </label>
  );
};

export default SectorTopoInput;
