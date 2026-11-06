import React, { useEffect, useState } from 'react';
import {
  MdCalendarMonth,
  MdDirectionsWalk,
  MdExplore,
  MdLocationOn,
  MdTerrain,
  MdVideocam,
  MdWbSunny,
} from 'react-icons/md';
import { lowestLinePoint, pointsToBezierPath, type LinePoint } from '@crag-to-all/shared-crag';
import RouteOptionsMenu from './RouteOptionsMenu';
import RouteRating from './RouteRating';
import TopoOptionsMenu from './TopoOptionsMenu';
import { Route, Sector } from '../types';
import './SectorView.scss';

export interface SectorViewProps {
  cragId: string;
  sector: Sector;
  route?: Route;
  imagesPaths?: string[];
  getImageUrl?: (cragId: string, imageFile: string) => string;
  printMode?: boolean;
  createLink?: (to: string, children: React.ReactNode, title?: string) => React.ReactNode;
  headerActions?: React.ReactNode;
  headerAlert?: string | null;
  /** Index into `sector.routes`. Present only when the viewer can edit routes. */
  onEditRoute?: (index: number) => void;
  /** Visual index of a route on one topo image. Present only when the viewer can reorder routes. */
  onMoveRoute?: (imageFile: string, index: number, direction: -1 | 1) => void;
  routeMenuDisabled?: boolean;
  /** Index into `sector.images`. Present only when the viewer can edit topo images. */
  onDeleteTopo?: (index: number) => void;
  onMoveTopo?: (index: number, direction: -1 | 1) => void;
  topoMenuDisabled?: boolean;
}

const SectorView: React.FC<SectorViewProps> = ({
  cragId,
  sector,
  route,
  imagesPaths,
  getImageUrl,
  printMode,
  createLink,
  headerActions,
  headerAlert,
  onEditRoute,
  onMoveRoute,
  routeMenuDisabled = false,
  onDeleteTopo,
  onMoveTopo,
  topoMenuDisabled = false,
}) => {

  const [highlighted, setHighlighted] = useState<number[]>([]);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const onRouteClick = (imageIdx: number, routeIdx: number) => {
    setHighlighted(h => {
      const newH = Array.isArray(h) ? [...h] : [];
      newH[imageIdx] = h[imageIdx] === routeIdx ? -1 : routeIdx;
      return newH;
    })
  };

  if (!sector || !Array.isArray(sector.images)) return null;

  // Default link renderer that just returns text
  const defaultLink = (_to: string, children: React.ReactNode, _title?: string) => <span>{children}</span>;
  const renderLink = createLink || defaultLink;

  const renderTagChip = (tag: string) => <span className="tag-chip">{tag}</span>;

  const renderVideoLink = (routeForLink: Route) => {
    if (printMode || (routeForLink.videos?.length ?? 0) === 0) return null;
    const betaVideosPath = `/beta-videos/${encodeURIComponent(sector.name.toLowerCase())}/${encodeURIComponent(routeForLink.name.toLowerCase())}`;
    return (
      <span className="beta-video-link" onClick={(event) => event.stopPropagation()}>
        {renderLink(
          betaVideosPath,
          <MdVideocam className="beta-video-icon" aria-hidden="true" />,
          'Watch beta videos',
        )}
      </span>
    );
  };

  const title = route?.name || sector.name;
  const titleVideoLink = route ? renderVideoLink(route) : null;

  const renderRouteHeight = (height: number | undefined) => (
    typeof height === 'number' ? <div className="route-height">Height: {height} m</div> : null
  );

  return (
    <div className={`sector-view ${printMode ? 'print-mode' : ''} ${route ? 'route-view' : ''}`}>
      {headerActions || headerAlert ? (
        <div className="sector-view-header">
          <h2>{title}{titleVideoLink}</h2>
          {headerActions}
          {headerAlert ? (
            <p className="sector-view-header__alert" role="alert">
              {headerAlert}
            </p>
          ) : null}
        </div>
      ) : (
        <h2>{title}{titleVideoLink}</h2>
      )}
      {route ? <div className="sector-link-container">Sector: {renderLink(`/sector/${encodeURIComponent(sector.name.toLowerCase())}`, sector.name)}</div> : null}
      <div className="sector-info">
        <div className="sector-properties">
          {sector.geo && (
            <div className="sector-property" title="Coordinates">
              <span className="icon"><MdLocationOn aria-hidden="true" /></span>
              <span className="value">
                {printMode
                  ? `${sector.geo.lat}, ${sector.geo.lon}`
                  : renderLink('/map', `${sector.geo.lat}, ${sector.geo.lon}`)}
              </span>
            </div>
          )}
          {sector.season && (
            <div className="sector-property" title="Best season">
              <span className="icon"><MdCalendarMonth aria-hidden="true" /></span>
              <span className="value">{sector.season}</span>
            </div>
          )}
          {sector.approachTime && (
            <div className="sector-property" title="Approach time">
              <span className="icon"><MdDirectionsWalk aria-hidden="true" /></span>
              <span className="value">{sector.approachTime}</span>
            </div>
          )}
          {sector.altitude && (
            <div className="sector-property" title="Altitude">
              <span className="icon"><MdTerrain aria-hidden="true" /></span>
              <span className="value">{sector.altitude}</span>
            </div>
          )}
          {sector.orientation && (
            <div className="sector-property" title="Orientation">
              <span className="icon"><MdExplore aria-hidden="true" /></span>
              <span className="value">{sector.orientation}</span>
            </div>
          )}
          {sector.timeInSun && (
            <div className="sector-property" title="Time in sun">
              <span className="icon"><MdWbSunny aria-hidden="true" /></span>
              <span className="value">{sector.timeInSun}</span>
            </div>
          )}
        </div>
      </div>
      {route && (
        <div className="route-info">
          <div className="route-info-header">
            {route.grade && <div className="route-grade">Grade: {route.grade}</div>}
            <RouteRating rating={route.rating} ratingVotes={route.ratingVotes} />
          </div>
          {route.description && <div className="route-desc">{route.description}</div>}
          {renderRouteHeight(route.height)}
          {route.tags && route.tags.length > 0 && (
            <div className="route-tags">
              {route.tags.map((tag, index) => (
                <React.Fragment key={index}>{renderTagChip(tag)}</React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="topos-list">
        {sector.images.filter(image => !route || route.images.some(img => img.imageFile === image.imageFile)).map((image, imageIdx) => {
          // Find all routes that reference this image
          const routesForImage: (Route & { routeIndex?: number; line?: LinePoint[]; sourceIndex: number })[] = sector.routes
            .map((route, sourceIndex) => {
              const imgRef = route.images.find(img => img.imageFile === image.imageFile);
              return { ...route, routeIndex: imgRef?.routeIndex, line: imgRef?.line, sourceIndex };
            })
            .filter(x => x.routeIndex !== undefined)
            .sort((a, b) => (a!.routeIndex as number) - (b!.routeIndex as number));
          return (
            <React.Fragment key={imageIdx}>
              <div className="topo-block">
                <div className="topo-image-container">
                  <div className="topo-image-wrapper">
                    <img
                      className="topo-image"
                      src={imagesPaths ? imagesPaths[imageIdx] : (getImageUrl ? getImageUrl(cragId, image.imageFile) : '')}
                      alt={`Topo ${imageIdx + 1}`}
                    />
                    {/* SVG overlay for route lines */}
                    {routesForImage.some((rt) => (rt.line?.length ?? 0) >= 2) && (
                      <svg
                        className="topo-svg-overlay"
                        viewBox="0 0 1 1"
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                      >
                        {routesForImage.map((rt, rtIdx) => {
                          const points = rt.line;
                          if (!points || points.length < 2) return null;
                          const isHighlighted = highlighted[imageIdx] === rtIdx || (route && route.name === rt.name);
                          return (
                            <path
                              key={`line-${rtIdx}`}
                              className={`route-line${isHighlighted ? ' route-line--highlighted' : ''}`}
                              d={pointsToBezierPath(points)}
                            />
                          );
                        })}
                      </svg>
                    )}
                    {/* Route numbers container */}
                    {!route && <div className="route-numbers-container">
                      {routesForImage.map((rt, routeIdx) => {
                        const label = rt.line ? lowestLinePoint(rt.line) : undefined;
                        if (!label) return null;
                        return (
                          <div
                            key={`route-${routeIdx}`}
                            className="route-number-overlay"
                            onClick={() => onRouteClick(imageIdx, routeIdx)}
                            style={{
                              left: `${label.x * 100}%`,
                              top: `${label.y * 100}%`,
                            }}
                          >
                            {routeIdx + 1}
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                </div>
                {!route && <div className="topo-routes">
                  <div className="topo-routes-header">
                    <h4>{imageIdx + 1}/{sector.images.length}</h4>
                    {onDeleteTopo && onMoveTopo && !printMode ? (
                      <TopoOptionsMenu
                        index={imageIdx}
                        count={sector.images.length}
                        disabled={topoMenuDisabled}
                        onDelete={() => onDeleteTopo(imageIdx)}
                        onMoveUp={() => onMoveTopo(imageIdx, -1)}
                        onMoveDown={() => onMoveTopo(imageIdx, 1)}
                      />
                    ) : null}
                  </div>
                  {routesForImage.length > 0 ? (
                    <ul className="routes-list">
                        {routesForImage.map((route, routeIdx) => (
                          <li
                            key={routeIdx}
                            className={`route-item${highlighted[imageIdx] === routeIdx ? ' highlighted' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => onRouteClick(imageIdx, routeIdx)}
                          >
                            <div className="route-content">
                              <div className="route-title-row">
                                <div className="route-title-main">
                                  <span className="route-number">{routeIdx + 1}. </span>
                                  <span className="route-name">{renderLink(`/sector/${encodeURIComponent(sector.name.toLowerCase())}/${encodeURIComponent(route!.name.toLowerCase())}`, route!.name)}</span>
                                  {renderVideoLink(route!)}
                                  {route!.grade ? <span className="route-name">,</span> : null}
                                  {route!.grade && <span className="route-grade"> {route!.grade}</span>}
                                  <RouteRating rating={route!.rating} ratingVotes={route!.ratingVotes} />
                                </div>
                                {onEditRoute && !printMode ? (
                                  <RouteOptionsMenu
                                    routeName={route!.name}
                                    index={routeIdx}
                                    count={routesForImage.length}
                                    disabled={routeMenuDisabled}
                                    onEditDetails={() => onEditRoute(route!.sourceIndex)}
                                    onMoveUp={
                                      onMoveRoute
                                        ? () => onMoveRoute(image.imageFile, routeIdx, -1)
                                        : undefined
                                    }
                                    onMoveDown={
                                      onMoveRoute
                                        ? () => onMoveRoute(image.imageFile, routeIdx, 1)
                                        : undefined
                                    }
                                  />
                                ) : null}
                              </div>
                              {route!.description && <div className="route-desc">{route!.description}</div>}
                              {renderRouteHeight(route!.height)}
                            </div>
                            {route!.tags && route!.tags.length > 0 && (
                              <div className="route-tags">
                                {route!.tags.map((tag, tagIndex) => (
                                  <React.Fragment key={tagIndex}>{renderTagChip(tag)}</React.Fragment>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                  ) : (
                    <div className="no-routes-message">
                      No routes yet :)
                    </div>
                  )}
                </div>}
              </div>
              {printMode && imageIdx !== sector.images.length - 1 && <div style={{ pageBreakAfter: 'always' }}></div>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default SectorView; 