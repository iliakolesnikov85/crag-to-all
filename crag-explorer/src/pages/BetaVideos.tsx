import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { Sector } from '../types';
import { useCrag } from '../context/CragContext';
import { getEmbedKind } from '../utils/getEmbedKind';
import './BetaVideos.scss';

interface BetaVideosProps {
  sectors: Sector[];
}

const BetaVideos: React.FC<BetaVideosProps> = ({ sectors }) => {
  const { sectorName, routeName } = useParams<{ sectorName: string; routeName: string }>();
  const { getUrl } = useCrag();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sector = sectors.find(s => s.name.toLowerCase() === (sectorName || '').toLowerCase());
  if (!sector) return <div className="page">Sector not found.</div>;

  const route = sector.routes.find(r => r.name.toLowerCase() === (routeName || '').toLowerCase());
  if (!route) return <div className="page">Route not found.</div>;

  const videos = route.videos ?? [];
  const routePath = `/sector/${encodeURIComponent(sector.name.toLowerCase())}/${encodeURIComponent(route.name.toLowerCase())}`;

  return (
    <div className="page beta-videos-page">
      <header className="beta-videos-header">
        <h2>Beta Videos</h2>
      </header>
      <div className="beta-videos-meta">
        <span className="beta-videos-route">{route.name}</span>
        {route.grade && <span className="beta-videos-grade">{route.grade}</span>}
        <span className="beta-videos-sector">
          Sector:{' '}
          <Link className="link" to={getUrl(`/sector/${encodeURIComponent(sector.name.toLowerCase())}`)}>
            {sector.name}
          </Link>
        </span>
        <Link className="link beta-videos-back" to={getUrl(routePath)}>
          Back to route
        </Link>
      </div>

      {videos.length === 0 ? (
        <p className="beta-videos-empty">No beta videos available for this route.</p>
      ) : (
        <div className="beta-videos-grid">
          {videos.map((video, index) => (
            <div key={index} className="beta-video-item">
              <iframe
                className={`beta-video-iframe beta-video-iframe--${getEmbedKind(video.url)}`}
                src={video.url}
                title={`${route.name} beta video ${index + 1}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                scrolling="no"
              />
              {video.addedBy && (
                <p className="beta-video-credit">Added by {video.addedBy}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BetaVideos;
