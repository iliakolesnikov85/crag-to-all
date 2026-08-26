import React, { useState } from 'react';
import { MdExpandMore, MdChevronRight } from 'react-icons/md';
import './OfflineInstructions.scss';
import { isAndroidDevice, isIosDevice } from '../utils/deviceUtils';
import Button from './Button';

const OfflineInstructions: React.FC = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="offline-instructions">
      <Button
        variant="ghost"
        fullWidth
        className="offline-instructions__toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="offline-instructions__toggle-label">How to use offline</span>
        <span className="offline-instructions__chevron" aria-hidden="true">
          {expanded ? <MdExpandMore /> : <MdChevronRight />}
        </span>
      </Button>

      {expanded && (
        <div className="offline-instructions__body">
          <h3 className="offline-instructions__heading">Before you leave (while you have internet)</h3>
          <ol>
            <li>Open this site in your browser and wait for the page to load fully (installs the app for offline use).</li>
            <li>Open the crag you need → <strong>Download</strong> tab → tap <strong>Download for offline</strong> and wait until finished.</li>
            {isIosDevice() && (
              <li>Tap Share → <strong>Add to Home Screen</strong> — recommended so the app opens reliably without signal.</li>
            )}
            <li>When back online after guide updates, tap <strong>Update offline data</strong> (browsing online shows the latest guide, but your phone&apos;s offline copy updates only after this step).</li>
          </ol>

          <h3 className="offline-instructions__heading">At the crag (no internet)</h3>
          <ol>
            <li>Open the same site (or your home-screen icon). Use Wi‑Fi or mobile data once before the trip if this is your first visit.</li>
            <li>On the home screen, choose a crag marked as downloaded (✓ on mobile).</li>
            <li>Browse routes, sector photos, and descriptions as usual.</li>
            <li>GPX is included in the offline pack; use <strong>Download GPX</strong> only if you need a file in another app.</li>
          </ol>

          <h3 className="offline-instructions__heading">What works offline</h3>
          <ul>
            <li>Downloaded crag: routes, grades, descriptions, sector/route photos, cached GPX for that crag.</li>
            <li>Outdoor / Topo map background for that crag (included in the offline pack).</li>
          </ul>

          <h3 className="offline-instructions__heading">What does not work offline</h3>
          <ul>
            <li>Crags you did not download</li>
            <li>Satellite and maps.gov.ge layers (Outdoor / Topo only when offline)</li>
            <li>PDF guide (download separately if needed)</li>
            <li>Full list of all crags (only downloaded ones appear when offline)</li>
          </ul>

          <h3 className="offline-instructions__heading">Tips</h3>
          <ul>
            <li>Download before you lose signal; large crags can take several minutes.</li>
            <li>Free up phone storage if download fails.</li>
            <li>Bookmark or use a home-screen shortcut to your crag&apos;s overview page for fastest access.</li>
          </ul>

          {isIosDevice() && (
            <p className="offline-instructions__platform">
              <strong>iOS:</strong> Add to Home Screen; avoid Private Browsing for the first install; storage limits are stricter.
            </p>
          )}
          {isAndroidDevice() && (
            <p className="offline-instructions__platform">
              <strong>Android:</strong> You can use Add to Home Screen or Install app; generally more storage headroom than iOS.
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default OfflineInstructions;
