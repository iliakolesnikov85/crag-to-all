import React, { useCallback, useEffect, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

interface PendingConfirm {
  id: number;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  settled: boolean;
  resolve: (confirmed: boolean) => void;
}

let nextConfirmId = 0;
let askConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

function registerConfirm(ask: ((options: ConfirmOptions) => Promise<boolean>) | null): void {
  askConfirm = ask;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Cancel takes focus, and the confirm button is not the default action. */
  destructive?: boolean;
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (!askConfirm) {
    throw new Error('confirm() requires ConfirmProvider');
  }
  return askConfirm(options);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;

  const ask = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      nextConfirmId += 1;
      const entry: PendingConfirm = {
        id: nextConfirmId,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'OK',
        cancelLabel: options.cancelLabel ?? 'Cancel',
        destructive: options.destructive === true,
        settled: false,
        resolve,
      };
      setQueue((current) => [...current, entry]);
    });
  }, []);

  useEffect(() => {
    registerConfirm(ask);
    return () => {
      registerConfirm(null);
      queueRef.current.forEach((entry) => {
        if (entry.settled) return;
        entry.settled = true;
        entry.resolve(false);
      });
    };
  }, [ask]);

  const settle = (confirmed: boolean) => {
    const head = queueRef.current[0];
    if (!head || head.settled) return;
    head.settled = true;
    head.resolve(confirmed);
    setQueue((items) => items.filter((item) => item !== head));
  };

  const current = queue[0] ?? null;

  return (
    <>
      {children}
      {current ? (
        <ConfirmDialog
          key={current.id}
          title={current.title}
          message={current.message}
          confirmLabel={current.confirmLabel}
          cancelLabel={current.cancelLabel}
          destructive={current.destructive}
          onResult={settle}
        />
      ) : null}
    </>
  );
}
