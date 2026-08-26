import React from 'react';
import { MdLocationOn } from 'react-icons/md';
import { useCrag } from '../context/CragContext';
import { getCragSectorsGpxUrl } from '../utils/firebaseStorage';
import Button from './Button';

const GpxDownloadButton: React.FC = () => {
  const { crag } = useCrag();
  const cragId = crag?.cragId || '';

  const onDownload = async () => {
    if (!cragId) return;
    const response = await fetch(getCragSectorsGpxUrl(cragId));
    if (!response.ok) return;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = `${cragId}-sectors.gpx`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  return (
    <Button variant="primary" size="lg" fullWidth onClick={() => void onDownload()}>
      <MdLocationOn size={20} aria-hidden="true" />
      Download GPX
    </Button>
  );
};

export default GpxDownloadButton;
