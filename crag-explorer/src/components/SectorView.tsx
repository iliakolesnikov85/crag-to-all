import React, { useEffect, useState } from 'react';
import {
  MdArrowForward,
  MdCalendarMonth,
  MdDirectionsWalk,
  MdExplore,
  MdLocationOn,
  MdTerrain,
  MdVideocam,
  MdWbSunny,
} from 'react-icons/md';
import { pointsToBezierPath } from '@crag-to-all/shared-crag';
import RouteRating from './RouteRating';
import { Route, Sector } from '../types';
import './SectorView.scss';

export interface SectorViewProps {
  cragId: string;
  sector: Sector;
  route?: Route;
  imagesPaths?: string[];
  getImageUrl?: (cragId: string, imageFile: string) => string;
  printMode?: boolean;
  createLink?: (to: string, children: React.ReactNode) => React.ReactNode;
}

const SectorView: React.FC<SectorViewProps> = ({ cragId, sector, route, imagesPaths, getImageUrl, printMode, createLink }) => {

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
    })};

  if (!sector || !Array.isArray(sector.images)) return null;

  // Default link renderer that just returns text
  const defaultLink = (_to: string, children: React.ReactNode) => <span>{children}</span>;
  const renderLink = createLink || defaultLink;

  const renderTagChip = (tag: string, routeForLink: Route) => {
    if (tag === 'Video beta' && !printMode) {
      const betaVideosPath = `/beta-videos/${encodeURIComponent(sector.name.toLowerCase())}/${encodeURIComponent(routeForLink.name.toLowerCase())}`;
      return renderLink(
        betaVideosPath,
        <span className="tag-chip tag-chip--video-beta" title="Watch beta videos">
          <MdVideocam className="beta-video-icon" aria-hidden="true" />
          {tag}
          <span className="tag-chip__arrow" aria-hidden="true"><MdArrowForward /></span>
        </span>
      );
    }
    return <span className="tag-chip">{tag}</span>;
  };

  return (
    <div className={`sector-view ${printMode ? 'print-mode' : ''} ${route ? 'route-view' : ''}`}>
      <h2>{route?.name || sector.name}</h2>
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
          {route.tags && route.tags.length > 0 && (
            <div className="route-tags">
              {route.tags.map((tag, index) => (
                <React.Fragment key={index}>{renderTagChip(tag, route)}</React.Fragment>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="topos-list">
        {sector.images.filter(image => !route || route.images.some(img => img.imageFile === image.imageFile)).map((image, imageIdx) => {
          // Find all routes that reference this image
          const routesForImage: (Route & { routeIndex?: number })[] = sector.routes
            .map(route => {
              const imgRef = route.images.find(img => img.imageFile === image.imageFile);
              return { ...route, routeIndex: imgRef?.routeIndex };
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
                    {image.lines && (
                      <svg
                        className="topo-svg-overlay"
                        viewBox="0 0 1 1"
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                      >
                        {routesForImage.map((rt, rtIdx) => {
                          const points = image.lines && image.lines[rt.routeIndex!];
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
                      {image.labelPositions && routesForImage.map((rt, routeIdx) => {
                        const labelPosition = image.labelPositions
                          ? image.labelPositions[rt.routeIndex!]
                          : null;
                        if (labelPosition) {
                          // Parse "left:X%; top:Y%" format
                          const leftMatch = labelPosition.match(/left:([\d.]+)%/);
                          const topMatch = labelPosition.match(/top:([\d.]+)%/);
                          
                          if (leftMatch && topMatch) {
                            const left = parseFloat(leftMatch[1]);
                            const top = parseFloat(topMatch[1]);
                            
                            return (
                              <div
                                key={`route-${routeIdx}`}
                                className="route-number-overlay"
                                onClick={() => onRouteClick(imageIdx, routeIdx)}
                                style={{
                                  left: `${left}%`,
                                  top: `${top}%`,
                                }}
                              >
                                {routeIdx + 1}
                              </div>
                            );
                          }
                        }
                        return null;
                      })}
                    </div>}
                  </div>
                </div>
                {!route && <div className="topo-routes">
                  
                  {routesForImage.length > 0 ? (
                    <>
                    <h4>Routes</h4>
                    <ul className="routes-list">
                      {routesForImage.map((route, routeIdx) => (
                        <li
                          key={routeIdx}
                          className={`route-item${highlighted[imageIdx] === routeIdx ? ' highlighted' : ''}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => onRouteClick(imageIdx, routeIdx)}
                        >
                          <div className="route-content">
                            <span className="route-number">{routeIdx + 1}. </span>
                            <span className="route-name">{renderLink(`/sector/${encodeURIComponent(sector.name.toLowerCase())}/${encodeURIComponent(route!.name.toLowerCase())}`, route!.name)}{(route!.grade ? `,` : '')}</span>
                            {route!.grade && <span className="route-grade"> {route!.grade}</span>}
                            <RouteRating rating={route!.rating} ratingVotes={route!.ratingVotes} />
                            {route!.description && <div className="route-desc">{route!.description}</div>}
                          </div>
                          {route!.tags && route!.tags.length > 0 && (
                            <div className="route-tags">
                              {route!.tags.map((tag, tagIndex) => (
                                <React.Fragment key={tagIndex}>{renderTagChip(tag, route!)}</React.Fragment>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                    </>
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