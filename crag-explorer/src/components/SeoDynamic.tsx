import React, { useEffect } from 'react';
import { useLocation } from 'react-router';
import { CragData } from '../types';

interface SeoDynamicProps {
  cragData?: CragData;
  currentRoute?: string;
  currentSector?: string;
}

const SeoDynamic: React.FC<SeoDynamicProps> = ({ cragData, currentRoute, currentSector }) => {
  const location = useLocation();

  useEffect(() => {
    // Only update dynamic content that changes based on routes
    let dynamicTitle = document.title;
    let dynamicDescription = '';
    let canonicalUrl = `https://roshkaclimb.ge${location.pathname}`;

    // Generate dynamic content based on current route
    if (currentSector && cragData) {
      const sector = cragData.sectors.find(s => s.name === currentSector);
      if (sector) {
        const sectorRoutes = sector.routes.length;
        const sectorGrades = sector.routes.map(route => route.grade).filter(Boolean);
        const sectorGradeRange = sectorGrades.length > 0 ? `${sectorGrades[0]} to ${sectorGrades[sectorGrades.length - 1]}` : 'Various';
        
        if (currentRoute) {
          // Route-specific page
          const route = sector.routes.find(r => r.name === currentRoute);
          if (route) {
            dynamicTitle = `${currentRoute} - ${currentSector} | ${cragData.name || 'Crag'} Climbing`;
            dynamicDescription = `${currentRoute} is a ${route.grade} boulder problem at ${currentSector}, ${cragData.name || 'Crag'}. ${route.description || ''} ${route.tags?.length ? `Features: ${route.tags.join(', ')}.` : ''}`;
          }
        } else {
          // Sector-specific page
          dynamicTitle = `${currentSector} Sector - ${cragData.name || 'Crag'} Climbing Guide`;
          dynamicDescription = `${currentSector} sector at ${cragData.name || 'Crag'}. ${sectorRoutes} boulder problems from ${sectorGradeRange} grades. ${sector.altitude ? `Located at ${sector.altitude} altitude.` : ''} ${sector.season ? `Best season: ${sector.season}.` : ''}`;
        }
      }
    }

    // Update document title if it changed
    if (dynamicTitle !== document.title) {
      document.title = dynamicTitle;
    }

    // Update canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute('href', canonicalUrl);
    }

    // Update Open Graph URL
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) {
      ogUrl.setAttribute('content', canonicalUrl);
    }

    // Update Twitter URL
    const twitterUrl = document.querySelector('meta[property="twitter:url"]');
    if (twitterUrl) {
      twitterUrl.setAttribute('content', canonicalUrl);
    }

    // Update dynamic meta description if we have one
    if (dynamicDescription) {
      let metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', dynamicDescription);
      }

      // Update Open Graph description
      let ogDescription = document.querySelector('meta[property="og:description"]');
      if (ogDescription) {
        ogDescription.setAttribute('content', dynamicDescription);
      }

      // Update Twitter description
      let twitterDescription = document.querySelector('meta[property="twitter:description"]');
      if (twitterDescription) {
        twitterDescription.setAttribute('content', dynamicDescription);
      }
    }

  }, [cragData, currentRoute, currentSector, location.pathname]);

  return null; // This component doesn't render anything
};

export default SeoDynamic; 