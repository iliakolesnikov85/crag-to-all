import React, { useMemo } from 'react';
import { Link } from 'react-router';
import { MdCloudOff } from 'react-icons/md';
import { countryByCode } from '@crag-to-all/shared-crag';
import { Crag } from '../types';
import './Homepage.scss';
import { useIsMobileLayout } from '../hooks/useIsMobileLayout';
import { useOfflineCrags } from '../hooks/useOfflineCrags';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import OfflineStatusBadge, {
  OfflineBadgeState,
} from '../components/OfflineStatusBadge';
import UnpublishedBadge from '../components/UnpublishedBadge';
import { countryFlagUrl } from '../components/editors/countryFlags';
import { cragConfigs } from '../../scripts/seo-config.js';

const HOMEPAGE_TITLE = 'Free climbing guidebooks';

// Per-crag SEO highlights surfaced as visible copy on the homepage. Lookup is
// keyed by cragId; missing entries fall back to the crag description.
type CragHighlight = {
  homepageBlurb?: string;
};

const cragHighlights: Record<string, CragHighlight> = cragConfigs as Record<string, CragHighlight>;

interface HomepageProps {
  crags: Crag[];
}

interface CountryGroup {
  key: string;
  name: string;
  flagUrl?: string;
  matchesSite: boolean;
  known: boolean;
  crags: Crag[];
}

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

/** Last label of a hostname, such as "ge" from "roshkaclimb.ge". */
function hostnameTld(hostname: string): string {
  const host = hostname.trim().toLowerCase().replace(/\.+$/, '');
  if (!host || host === 'localhost' || host.includes(':')) return '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return '';
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return '';
  return labels[labels.length - 1];
}

function groupCragsByCountry(crags: readonly Crag[], hostname: string): CountryGroup[] {
  const tld = hostnameTld(hostname);
  const groups = new Map<string, CountryGroup>();

  for (const crag of crags) {
    const country = crag.country ? countryByCode(crag.country) : undefined;
    const key = country?.code ?? '';
    let group = groups.get(key);
    if (!group) {
      group = {
        key: country?.code ?? 'other',
        name: country?.name ?? 'Other',
        flagUrl: country ? countryFlagUrl(country.code) : undefined,
        matchesSite: country != null && country.tld.toLowerCase() === tld,
        known: country != null,
        crags: [],
      };
      groups.set(key, group);
    }
    group.crags.push(crag);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.matchesSite !== b.matchesSite) return a.matchesSite ? -1 : 1;
    if (a.known !== b.known) return a.known ? -1 : 1;
    return a.name.localeCompare(b.name, 'en');
  });
}

const Homepage: React.FC<HomepageProps> = ({ crags }) => {
  const isMobile = useIsMobileLayout();
  const online = useOnlineStatus();
  const { downloadedIds, updateStatusMap } = useOfflineCrags();
  const groups = useMemo(
    () => groupCragsByCountry(crags, window.location.hostname),
    [crags],
  );

  return (
    <div className="page crag-selector">
      <div className="crag-selector-header">
        <h1 className="crag-selector-header__title">{HOMEPAGE_TITLE}</h1>
      </div>

      {groups.map((group) => (
        <section key={group.key} className="crag-country" aria-labelledby={`country-${group.key}`}>
          <h2 id={`country-${group.key}`} className="crag-country__title">
            <span>{group.name}</span>
            {group.flagUrl && (
              <img
                className="crag-country__flag"
                src={group.flagUrl}
                alt=""
                width={36}
                height={24}
                decoding="async"
              />
            )}
          </h2>
          <div className="crags-grid">
            {group.crags.map((crag) => {
              const isDownloaded = downloadedIds.has(crag.id);
              const disabled = !online && !isDownloaded;
              const badgeState = resolveBadgeState(
                isDownloaded,
                updateStatusMap.get(crag.id) ?? false,
              );
              const showBadge = isMobile && (online || isDownloaded);
              const blurb = cragHighlights[crag.id]?.homepageBlurb?.trim()
                || crag.description?.trim()
                || '';
              const overviewPath = `/${crag.id}/overview`;
              const downloadPath = `/${crag.id}/download`;
              const badgeTo =
                badgeState === 'update' || badgeState === 'not-saved'
                  ? downloadPath
                  : undefined;

              const cardContent = (
                <>
                  <div className="crag-card__media">
                    <img
                      className="crag-card__bg"
                      src={assetUrl(`images/titles/${crag.id}.jpg`)}
                      alt=""
                      decoding="async"
                      onError={handleTitleImageError}
                    />
                    <div className="crag-card__overlay" aria-hidden="true" />
                    <h3 className="crag-name">{crag.cragName}</h3>
                  </div>
                  {blurb && (
                    <div className="crag-card__body">
                      <p className="crag-card__blurb">{blurb}</p>
                    </div>
                  )}
                </>
              );

              return (
                <div
                  key={crag.id}
                  className={`crag-card${disabled ? ' crag-card--disabled' : ''}`}
                >
                  {crag.published === false && <UnpublishedBadge variant="card" />}
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
        </section>
      ))}

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

export { groupCragsByCountry };

export default Homepage;
