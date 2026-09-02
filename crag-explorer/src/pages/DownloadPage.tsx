import React, { useCallback, useEffect, useState } from 'react';
import { MdPictureAsPdf } from 'react-icons/md';
import './DownloadPage.scss';
import { useCrag } from '../context/CragContext';
import Button from '../components/Button';
import GpxDownloadButton from '../components/GpxDownloadButton';
import OfflineInstructions from '../components/OfflineInstructions';
import { getCragGuideUrl } from '../utils/firebaseStorage';
import { CragData } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineUpdateStatus } from '../hooks/useOfflineUpdateStatus';
import {
  estimateCragOfflineSize,
  estimateStorage,
  getOfflineManifest,
  isCragOffline,
  type OfflineCragManifest,
  type OfflineProgress,
  removeCragOffline,
  syncCragOffline,
} from '../utils/offline';
import { formatBytes } from '../utils/formatBytes';

interface DownloadPageProps {
  cragData: CragData;
}

type OpStatus =
  | { phase: 'idle' }
  | { phase: 'running'; progress: OfflineProgress | null }
  | { phase: 'success'; message: string }
  | { phase: 'error'; message: string };

function formatDate(ts?: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString();
}

const DownloadPage: React.FC<DownloadPageProps> = ({ cragData }) => {
  const { crag } = useCrag();
  const cragId = crag?.cragId || '';
  const online = useOnlineStatus();
  const [downloaded, setDownloaded] = useState(false);
  const [manifest, setManifest] = useState<OfflineCragManifest | null>(null);
  const [op, setOp] = useState<OpStatus>({ phase: 'idle' });
  const [packSize, setPackSize] = useState<number | undefined>(undefined);
  const [deviceFree, setDeviceFree] = useState<number | undefined>(undefined);

  const busy = op.phase === 'running';
  const progress = op.phase === 'running' ? op.progress : null;

  const { needsUpdate, checking, refresh: refreshUpdateStatus } =
    useOfflineUpdateStatus(downloaded ? cragId : undefined);

  const refreshState = useCallback(async () => {
    const offline = await isCragOffline(cragId);
    setDownloaded(offline);
    if (offline) {
      const m = await getOfflineManifest(cragId);
      setManifest(m ?? null);
      const size = await estimateCragOfflineSize(cragId);
      setPackSize(size);
    } else {
      setManifest(null);
      setPackSize(undefined);
    }
    const est = await estimateStorage();
    setDeviceFree(
      est.quota !== undefined && est.usage !== undefined
        ? Math.max(0, est.quota - est.usage)
        : undefined,
    );
    refreshUpdateStatus();
  }, [cragId, refreshUpdateStatus]);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Re-check outdated when live crag data may have changed (user is on this tab online)
  useEffect(() => {
    if (online && downloaded) {
      refreshUpdateStatus();
    }
  }, [cragData, online, downloaded, refreshUpdateStatus]);

  const runSyncOp = async (
    successMessage: string,
    logAction: string,
    fallbackError: string,
  ) => {
    setOp({ phase: 'running', progress: null });
    try {
      await syncCragOffline(cragId, (next) => {
        setOp({ phase: 'running', progress: next });
      });
      setOp({ phase: 'success', message: successMessage });
      await refreshState();
    } catch (e) {
      console.error(`Failed to ${logAction} crag "${cragId}":`, e);
      setOp({
        phase: 'error',
        message: e instanceof Error ? e.message : fallbackError,
      });
    }
  };

  const handleDownload = () =>
    runSyncOp(
      'This crag is ready for offline use.',
      'download',
      'Download failed',
    );

  const handleSync = () =>
    runSyncOp('Offline data updated.', 'sync offline', 'Update failed');

  const handleRemove = async () => {
    if (!online) return;
    const confirmed = window.confirm(
      `Remove all offline data for ${cragData.name} from this device?\n\nYou will need internet to download it again.`,
    );
    if (!confirmed) return;
    setOp({ phase: 'running', progress: null });
    try {
      await removeCragOffline(cragId);
      setOp({ phase: 'idle' });
      await refreshState();
    } catch (e) {
      console.error(`Failed to remove offline crag "${cragId}":`, e);
      setOp({
        phase: 'error',
        message: e instanceof Error ? e.message : 'Remove failed',
      });
    }
  };

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.done / progress.total) * 100)
      : 0;

  const showUpdateButton = downloaded && online && !checking && needsUpdate;

  return (
    <div className="download-tab">
      <h2>Download {cragData.name}</h2>

      <section className="download-tab__offline-section">
        <h3 className="download-tab__section-title">Use in the app without internet</h3>

        {op.phase === 'success' && (
          <p className="download-tab__success">{op.message}</p>
        )}
        {op.phase === 'error' && (
          <p className="download-tab__error">{op.message}</p>
        )}

        {busy && progress && (
          <div className="download-tab__progress">
            <div className="download-tab__progress-bar">
              <div
                className="download-tab__progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="download-tab__progress-text">
              {progress.done} / {progress.total} — {progress.label}
            </p>
          </div>
        )}

        {!downloaded ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy}
            onClick={handleDownload}
          >
            Download for offline
          </Button>
        ) : (
          <>
            {showUpdateButton && (
              <Button
                variant="warning"
                size="lg"
                fullWidth
                disabled={busy}
                onClick={handleSync}
              >
                Update offline data
              </Button>
            )}
            {downloaded && online && !checking && !showUpdateButton && (
              <p className="download-tab__up-to-date">
                Saved copy is up to date with the online guide.
              </p>
            )}
            {checking && online && (
              <p className="download-tab__checking">Checking for updates…</p>
            )}
            <Button
              variant="danger"
              size="lg"
              fullWidth
              disabled={busy || !online}
              onClick={handleRemove}
              title={
                !online
                  ? 'Connect to the internet before removing offline data'
                  : undefined
              }
            >
              Remove offline data
            </Button>
            {!online && (
              <p className="download-tab__remove-hint">
                Removal is disabled while offline so you don&apos;t lose your only saved copy.
              </p>
            )}
          </>
        )}

        {downloaded && manifest && (
          <p className="download-tab__meta">
            Last synced: {formatDate(manifest.lastSyncedAt)}
            <br />
            Offline pack size: {formatBytes(packSize)}
            {deviceFree !== undefined && (
              <>
                <br />
                Free on device: {formatBytes(deviceFree)}
              </>
            )}
          </p>
        )}

        <OfflineInstructions />
      </section>

      <section className="download-tab__files-section">
        <h3 className="download-tab__section-title">Files for other apps</h3>
        <p className="download-tab__files-hint">
          {online
            ? 'PDF and GPX files open or save outside this app. In-app offline mode is configured above.'
            : 'GPX files open or save outside this app. In-app offline mode is configured above.'}
        </p>

        <div className="download-tab__files-actions">
          {online && (
            <Button
              as="a"
              href={getCragGuideUrl(cragId)}
              variant="primary"
              size="lg"
              fullWidth
              target="_blank"
              rel="noopener noreferrer"
            >
              <MdPictureAsPdf size={20} aria-hidden="true" />
              Download PDF Guide
            </Button>
          )}

          <GpxDownloadButton />
        </div>
      </section>
    </div>
  );
};

export default DownloadPage;
