import React, { useCallback } from 'react';
import { Link } from 'react-router';
import { MdCloudOff } from 'react-icons/md';
import { Crag } from '../types';
import './CragSelector.scss';
import { getDefaultCragForHost } from '../utils/defaultCrag';
import { useIsMobileLayout } from '../hooks/useIsMobileLayout';
import { useOfflineCrags } from '../hooks/useOfflineCrags';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import OfflineStatusBadge, {
  OfflineBadgeState,
} from '../components/OfflineStatusBadge';
import { siteConfig, cragConfigs } from '../../scripts/seo-config.js';

interface CragSelectorProps {
  crags: Crag[];
}

// Per-crag SEO highlights surfaced as visible copy on the homepage. Lookup is
// keyed by cragId; missing entries simply fall back to no blurb.
type CragHighlight = {
  homepageBlurb?: string;
  nearby?: string[];
  climbingType?: string;
};

const cragHighlights: Record<string, CragHighlight> = cragConfigs as Record<string, CragHighlight>;

const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`.replace(/\/{2,}/g, '/');

function resolveBadgeState(
  isDownloaded: boolean,
  needsUpdate: boolean,
): OfflineBadgeState {
  if (!isDownloaded) return 'not-saved';
  if (needsUpdate) return 'update';
  return 'saved';
}

function handleTitleImageError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallbackApplied === 'true') return;
  img.dataset.fallbackApplied = 'true';
  img.src = assetUrl('icon.svg');
}

const CragSelector: React.FC<CragSelectorProps> = ({ crags }) => {
  const isMobile = useIsMobileLayout();
  const online = useOnlineStatus();
  const { downloadedIds, updateStatusMap } = useOfflineCrags();

  const cragPath = useCallback(
    (cragId: string, tab: string) =>
      getDefaultCragForHost(crags)?.cragId === cragId
        ? `/${tab}`
        : `/${cragId}/${tab}`,
    [crags],
  );

  return (
    <div className="page crag-selector">
      <div className="crag-selector-header">
        <h1 className="crag-selector-header__title">
          {siteConfig.name}
          <img
            className="crag-selector-header__flag"
            src={assetUrl('images/georgia-flag.png')}
            alt=""
            width={36}
            height={24}
            decoding="async"
          />
        </h1>
        <p className="crag-selector-header__tagline">{siteConfig.visibleTagline}</p>
      </div>

      <div className="crags-grid">
        {crags.map((crag) => {
          const isDownloaded = downloadedIds.has(crag.cragId);
          const disabled = !online && !isDownloaded;
          const badgeState = resolveBadgeState(
            isDownloaded,
            updateStatusMap.get(crag.cragId) ?? false,
          );
          const showBadge = isMobile && (online || isDownloaded);
          const blurb = cragHighlights[crag.cragId]?.homepageBlurb;
          const overviewPath = cragPath(crag.cragId, 'overview');
          const downloadPath = cragPath(crag.cragId, 'download');
          const badgeTo =
            badgeState === 'update' || badgeState === 'not-saved'
              ? downloadPath
              : undefined;

          const cardContent = (
            <>
              <div className="crag-card__media">
                <img
                  className="crag-card__bg"
                  src={assetUrl(`images/titles/${crag.cragId}.jpg`)}
                  alt=""
                  decoding="async"
                  onError={handleTitleImageError}
                />
                <div className="crag-card__overlay" aria-hidden="true" />
                <h3 className="crag-name">{crag.cragName}</h3>
              </div>
              <div className="crag-card__body">
                {blurb && <p className="crag-card__blurb">{blurb}</p>}
              </div>
            </>
          );

          return (
            <div
              key={crag.cragId}
              className={`crag-card${disabled ? ' crag-card--disabled' : ''}`}
            >
              {showBadge && (
                <OfflineStatusBadge
                  state={badgeState}
                  variant="card"
                  to={badgeTo}
                />
              )}
              {disabled ? (
                <div className="crag-card__link" aria-disabled="true">
                  {cardContent}
                </div>
              ) : (
                <Link to={overviewPath} className="crag-card__link">
                  {cardContent}
                </Link>
              )}
            </div>
          );
        })}
      </div>

      {!online && (
        <p className="crag-selector-offline-hint crag-selector-offline-hint--warn" role="note">
          <span className="crag-selector-offline-hint__title">
            <span className="crag-selector-offline-hint__icon" aria-hidden="true">
              <MdCloudOff focusable="false" />
            </span>
            You are offline
          </span>
          Dimmed crags are not saved on this device — open them after you reconnect.
        </p>
      )}
      {isMobile && online && (
        <p className="crag-selector-offline-hint" role="note">
          Crags can be downloaded for offline use — open a crag and use the Download tab.
        </p>
      )}
    </div>
  );
};

export default CragSelector;
