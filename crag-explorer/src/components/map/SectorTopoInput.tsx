import React from 'react';
import { MdAddPhotoAlternate } from 'react-icons/md';

const TOPO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

interface SectorTopoInputProps {
  disabled?: boolean;
  previewUrl?: string | null;
  onFile?: (file: File) => void;
}

/** Topo image picker for a new sector. The file stays local until Save. */
const SectorTopoInput: React.FC<SectorTopoInputProps> = ({
  disabled,
  previewUrl,
  onFile,
}) => {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Clearing the value lets the same file be chosen again after a rejection.
    input.value = '';
    if (file) onFile?.(file);
  };

  return (
    <label
      className={
        previewUrl
          ? 'sector-map-info__topo-input sector-map-info__topo-input--filled'
          : 'sector-map-info__topo-input'
      }
    >
      {previewUrl ? (
        <img className="sector-map-info__topo-preview" src={previewUrl} alt="" />
      ) : (
        <>
          <MdAddPhotoAlternate className="sector-map-info__topo-icon" aria-hidden="true" />
          <span className="sector-map-info__topo-label">Add topo</span>
        </>
      )}
      <input
        className="sector-map-info__topo-file"
        type="file"
        accept={TOPO_ACCEPT}
        aria-label="Topo image"
        disabled={disabled}
        onChange={handleChange}
      />
    </label>
  );
};

export default SectorTopoInput;
