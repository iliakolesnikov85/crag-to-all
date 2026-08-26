import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { Link } from 'react-router';
import { Sector } from '../types';
import { CragContext, CragContextType, useCrag } from '../context/CragContext';
import { getCragImageUrl } from '../utils/firebaseStorage';
import './SectorMapInfo.scss';

export const SECTOR_MAP_INFO_MAX_ROUTES = 5;

export interface SectorMapInfoProps {
  sector: Sector;
  maxRoutes?: number;
  /** When set (e.g. Leaflet popup outside the router tree), links call this instead of <Link>. */
  navigate?: (to: string) => void;
}

function SectorNavLink({
  to,
  className,
  children,
  navigate,
}: {
  to: string;
  className?: string;
  children: React.ReactNode;
  navigate?: (to: string) => void;
}) {
  if (navigate) {
    return (
      <a
        href={to}
        className={className}
        rel="noopener noreferrer"
        onClick={(e) => {
          if (e.defaultPrevented) return;
          if (e.button !== 0) return;
          if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return;
          e.preventDefault();
          navigate(to);
        }}
      >
        {children}
      </a>
    );
  }

  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

const SectorMapInfo: React.FC<SectorMapInfoProps> = ({
  sector,
  maxRoutes = SECTOR_MAP_INFO_MAX_ROUTES,
  navigate,
}) => {
  const { crag, getUrl } = useCrag();
  const sectorPath = getUrl(
    `sector/${encodeURIComponent(sector.name.toLowerCase())}`,
  );
  const firstImage = sector.images?.[0];
  const imageUrl = firstImage
    ? getCragImageUrl(crag.cragId, firstImage.imageFile)
    : null;
  const routes = sector.routes ?? [];
  const visible = routes.slice(0, maxRoutes);
  const remaining = routes.length - visible.length;

  return (
    <div className="sector-map-info">
      <SectorNavLink
        to={sectorPath}
        className="sector-map-info__name"
        navigate={navigate}
      >
        {sector.name}
      </SectorNavLink>
      <div className="sector-map-info__body">
        {imageUrl && (
          <SectorNavLink
            to={sectorPath}
            className="sector-map-info__image-link"
            navigate={navigate}
          >
            <img className="sector-map-info__image" src={imageUrl} alt="" />
          </SectorNavLink>
        )}
        <div className="sector-map-info__routes">
          {visible.map((route) => (
            <div key={`${route.name}-${route.grade}`} className="sector-map-info__route">
              {route.name}, {route.grade}
            </div>
          ))}
          {remaining > 0 && (
            <SectorNavLink
              to={sectorPath}
              className="sector-map-info__more"
              navigate={navigate}
            >
              and {remaining} more...
            </SectorNavLink>
          )}
        </div>
      </div>
    </div>
  );
};

/** Mount SectorMapInfo into a DOM node (Leaflet popup). Returns unmount. */
export function mountSectorMapInfo(
  container: HTMLElement,
  props: SectorMapInfoProps,
  cragContext: CragContextType,
): () => void {
  const root: Root = createRoot(container);
  root.render(
    <CragContext.Provider value={cragContext}>
      <SectorMapInfo {...props} />
    </CragContext.Provider>,
  );
  return () => {
    // Leaflet may tear down popups while React is rendering (e.g. clearLayers
    // during an update). Defer unmount past the current task to avoid a sync root race.
    setTimeout(() => {
      root.unmount();
    }, 0);
  };
}

export default SectorMapInfo;
