import React from 'react';
import { Link } from 'react-router';
import { DescriptionSection, Sector, Image } from '../types';
import GradeHistogram from '../components/GradeHistogram';
import './OverviewPage.scss';
import { useCrag } from '../context/CragContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { getCragImageUrl } from '../utils/firebaseStorage';
import { createPieChartSVG, getGradeCounts, getSectorGradeCounts } from '../utils/grades';
import { getEmbedKind, EmbedKind } from '../utils/getEmbedKind';
import { shuffle } from '../utils/shuffle';
import { pickBestImage } from '../utils/pickBestImage';

interface OverviewPageProps {
  description: DescriptionSection[];
  sectors: Sector[];
}

interface FeaturedSector {
  sector: Sector;
  image: Image;
}

interface FeaturedVideo {
  url: string;
  routeName: string;
  embedKind: EmbedKind;
}

const FEATURED_COUNT = 6;
const FEATURED_VIDEO_COUNT = 3;

const OverviewPage: React.FC<OverviewPageProps> = ({ description, sectors }) => {
  const { crag, getUrl } = useCrag();
  const online = useOnlineStatus();

  const gradeData = getGradeCounts(sectors.flatMap((sector) => sector.routes));

  // Create a short version of the description (first section, first paragraph only)
  const getShortDescription = () => {
    if (!description || description.length === 0) {
      return null;
    }

    const firstSection = description[0];
    const shortSection = {
      subheader: firstSection.subheader,
      paragraphs: firstSection.paragraphs.slice(0, 1) // Only first paragraph
    };

    return [shortSection];
  };

  const shortDescription = getShortDescription();

  const featuredSectors = React.useMemo<FeaturedSector[]>(() => {
    const candidates: FeaturedSector[] = [];
    for (const sector of sectors) {
      if (sector.routes.length === 0) continue;
      const best = pickBestImage(sector);
      if (!best) continue;
      candidates.push({ sector, image: best.image });
    }
    return shuffle(candidates).slice(0, FEATURED_COUNT);
  }, [sectors]);

  const featuredVideos = React.useMemo<FeaturedVideo[]>(() => {
    if (!online) return [];
    const candidates: FeaturedVideo[] = [];
    for (const sector of sectors) {
      for (const route of sector.routes) {
        for (const video of route.videos ?? []) {
          candidates.push({
            url: video.url,
            routeName: route.name,
            embedKind: getEmbedKind(video.url),
          });
        }
      }
    }
    return shuffle(candidates).slice(0, FEATURED_VIDEO_COUNT);
  }, [sectors, online]);

  return (
    <div className="overview-page page">
      
      {shortDescription && (
        <div className="overview-description">
          <h3>About {crag?.cragName || 'Crag'}</h3>
          {shortDescription.map((section, index) => (
            <div key={index} className="description-section">
              <h4>{section.subheader}</h4>
              {section.paragraphs.map((paragraph, pIndex) => (
                <div 
                  key={pIndex} 
                  className="description-paragraph"
                  dangerouslySetInnerHTML={{ __html: paragraph }}
                />
              ))}
              <span className="read-more-inline">
                {' '}<Link to={getUrl('description')}>Read more...</Link>
              </span>
            </div>
          ))}
        </div>
      )}

      {featuredSectors.length > 0 && (
        <div className="overview-sectors">
          <div className="overview-sectors-grid">
            {featuredSectors.map(({ sector, image }) => {
              const routeCount = sector.routes.length;
              const gradeCounts = getSectorGradeCounts(sector);
              const pieHtml = createPieChartSVG(gradeCounts, 44);
              const routeLabel = `${routeCount} ${routeCount === 1 ? 'route' : 'routes'}`;
              return (
                <Link
                  key={sector.name}
                  to={getUrl(`/sector/${encodeURIComponent(sector.name.toLowerCase())}`)}
                  className="sector-card"
                >
                  <div className="sector-card-image">
                    <img
                      src={getCragImageUrl(crag.cragId, image.imageFile)}
                      alt={sector.name}
                      loading="lazy"
                    />
                  </div>
                  <div className="sector-card-body">
                    <div className="sector-card-text">
                      <div className="sector-card-title">{sector.name}</div>
                      <div className="sector-card-meta">{routeLabel}</div>
                    </div>
                    <div
                      className="sector-card-pie"
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{ __html: pieHtml }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <GradeHistogram gradeData={gradeData} />

      {featuredVideos.length > 0 && (
        <div className="overview-videos">
          <p className="overview-videos-caution">
            Caution! Don't watch the video if you don't want to know the beta 🙂
          </p>
          <div className="overview-videos-grid">
            {featuredVideos.map((video, index) => (
              <div key={index} className="overview-video-card">
                <iframe
                  className={`overview-video-iframe overview-video-iframe--${video.embedKind}`}
                  src={video.url}
                  title={`${video.routeName} beta video`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  scrolling="no"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewPage; 