import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useDeleteSector, usePatchSector } from '../api/useCragMutations';
import { canEditCrag } from '../api/permissions';
import EditSectorModal from '../components/EditSectorModal';
import SectorOptionsMenu from '../components/SectorOptionsMenu';
import SectorView from '../components/SectorView';
import { useCrag } from '../context/CragContext';
import { Sector } from '../types';
import type { SectorDetailsPatch } from '../utils/sectorDetails';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { setMapCenter } from '../utils/map';

const DELETE_MISSING_ID_MESSAGE = 'This sector cannot be deleted because it has no id.';
const EDIT_MISSING_ID_MESSAGE = 'This sector cannot be edited because it has no id.';
const EDIT_MISSING_VERSION_MESSAGE = 'This sector cannot be edited because it has no version.';
const PERMISSION_MESSAGE = 'You do not have permission to edit this crag.';

interface SectorPageProps {
  sectors: Sector[];
  onSectorChange?: (sectorName: string | undefined) => void;
}

function otherSectorNames(sectors: readonly Sector[], sector: Sector): string[] {
  return sectors
    .filter((item) => item !== sector && !(sector.id != null && item.id === sector.id))
    .map((item) => item.name);
}

const SectorPage: React.FC<SectorPageProps> = ({ sectors, onSectorChange }) => {
  const { sectorName } = useParams<{ sectorName: string }>();
  const { crag, getUrl } = useCrag();
  const navigate = useNavigate();
  const deleteSectorMutation = useDeleteSector(crag.cragId);
  const patchSectorMutation = usePatchSector(crag.cragId);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const sector = sectors.find(s => s.name.toLowerCase() === (sectorName || '').toLowerCase());
  const editing = editingSector !== null && sector?.id === editingSector.id;
  const canEdit = canEditCrag(crag);

  useEffect(() => {
    if (onSectorChange) {
      onSectorChange(sectorName);
    }
  }, [sectorName, onSectorChange]);

  useEffect(() => {
    if (editingSector !== null && sector?.id !== editingSector.id) {
      setEditingSector(null);
      setEditError(null);
    }
  }, [editingSector, sector?.id]);

  const handleDelete = async () => {
    if (!sector || deleteSectorMutation.isPending) return;
    if (!canEditCrag(crag)) {
      setHeaderError(PERMISSION_MESSAGE);
      return;
    }
    if (!sector.id) {
      setHeaderError(DELETE_MISSING_ID_MESSAGE);
      return;
    }
    const confirmed = window.confirm(
      `Delete the "${sector.name}" sector? This permanently removes the sector and all of its routes.`,
    );
    if (!confirmed) return;

    setHeaderError(null);
    try {
      await deleteSectorMutation.mutateAsync(sector.id);
      navigate(getUrl('/routes'));
    } catch (error) {
      console.error('Failed to delete sector:', error);
      setHeaderError(error instanceof Error ? error.message : 'Failed to delete sector');
    }
  };

  const openEdit = () => {
    if (!sector) return;
    if (!canEditCrag(crag)) {
      setHeaderError(PERMISSION_MESSAGE);
      return;
    }
    if (!sector.id) {
      setHeaderError(EDIT_MISSING_ID_MESSAGE);
      return;
    }
    if (typeof sector.version !== 'number') {
      setHeaderError(EDIT_MISSING_VERSION_MESSAGE);
      return;
    }
    setHeaderError(null);
    setEditError(null);
    setEditingSector(sector);
  };

  const handleSave = async (patch: SectorDetailsPatch) => {
    if (!editingSector?.id || typeof editingSector.version !== 'number' || patchSectorMutation.isPending) return;
    if (!canEditCrag(crag)) {
      setEditError(PERMISSION_MESSAGE);
      return;
    }
    setEditError(null);
    try {
      const saved = await patchSectorMutation.mutateAsync({
        sectorId: editingSector.id,
        version: editingSector.version,
        patch,
      });
      setEditingSector(null);
      if (saved.name.toLowerCase() !== (sectorName || '').toLowerCase()) {
        navigate(
          getUrl(`/sector/${encodeURIComponent(saved.name.toLowerCase())}`),
          { replace: true },
        );
      }
    } catch (error) {
      console.error('Failed to save sector:', error);
      setEditError(error instanceof Error ? error.message : 'Failed to save sector');
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
            <SectorOptionsMenu
              disabled={deleteSectorMutation.isPending || patchSectorMutation.isPending}
              onEdit={openEdit}
              onDelete={() => void handleDelete()}
            />
          ) : undefined
        }
        headerAlert={headerError}
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
      <EditSectorModal
        key={editing ? 'editing' : 'idle'}
        open={editing}
        sector={editingSector ?? sector}
        takenNames={otherSectorNames(sectors, editingSector ?? sector)}
        mapUrl={getUrl('/map')}
        saving={patchSectorMutation.isPending}
        error={editError}
        onClose={() => {
          if (patchSectorMutation.isPending) return;
          setEditingSector(null);
          setEditError(null);
        }}
        onLocationClick={() => {
          if (sector.geo) setMapCenter(crag.cragId, [sector.geo.lat, sector.geo.lon], 17);
        }}
        onSave={(patch) => void handleSave(patch)}
      />
    </div>
  );
};

export default SectorPage;
