import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { deleteSector } from '../api/client';
import { canEditCrag } from '../api/permissions';
import SectorOptionsMenu from '../components/SectorOptionsMenu';
import SectorView from '../components/SectorView';
import { useCrag } from '../context/CragContext';
import { Sector } from '../types';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { setMapCenter } from '../utils/map';

const MISSING_ID_MESSAGE = 'This sector cannot be deleted because it has no id.';
const PERMISSION_MESSAGE = 'You do not have permission to edit this crag.';

interface SectorPageProps {
  sectors: Sector[];
  onSectorChange?: (sectorName: string | undefined) => void;
  onSectorDeleted?: (sectorId: string) => void;
}

const SectorPage: React.FC<SectorPageProps> = ({ sectors, onSectorChange, onSectorDeleted }) => {
  const { sectorName } = useParams<{ sectorName: string }>();
  const { crag, getUrl } = useCrag();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (onSectorChange) {
      onSectorChange(sectorName);
    }
  }, [sectorName, onSectorChange]);

  const sector = sectors.find(s => s.name.toLowerCase() === (sectorName || '').toLowerCase());
  const canEdit = canEditCrag(crag);

  const handleDelete = async () => {
    if (!sector || deleting) return;
    if (!canEditCrag(crag)) {
      setDeleteError(PERMISSION_MESSAGE);
      return;
    }
    if (!sector.id) {
      setDeleteError(MISSING_ID_MESSAGE);
      return;
    }
    const confirmed = window.confirm(
      `Delete the "${sector.name}" sector? This permanently removes the sector and all of its routes.`,
    );
    if (!confirmed) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteSector(crag.cragId, sector.id);
      onSectorDeleted?.(sector.id);
      navigate(getUrl('/routes'));
    } catch (error) {
      console.error('Failed to delete sector:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete sector');
    } finally {
      setDeleting(false);
    }
  };

  if (!sector) return <div className="page">Sector not found.</div>;

  return (
    <div className="page">
      <SectorView
        cragId={crag.cragId}
        sector={sector}
        getImageUrl={getCragImageUrl}
        headerActions={
          canEdit ? (
            <SectorOptionsMenu disabled={deleting} onDelete={() => void handleDelete()} />
          ) : undefined
        }
        headerAlert={deleteError}
        createLink={(to: string, children: React.ReactNode) => (
          <Link
            className="link"
            to={getUrl(to)}
            onClick={() => {
              if (to !== '/map') return;
              if (sector?.geo) setMapCenter(crag.cragId, [sector?.geo.lat, sector?.geo.lon], 17);
            }}
          >
            {children}
          </Link>
        )}
      />
    </div>
  );
};

export default SectorPage;
