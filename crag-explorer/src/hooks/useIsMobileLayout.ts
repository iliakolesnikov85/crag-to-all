import { useEffect, useState } from 'react';

const QUERY = '(max-width: 768px)';

export function useIsMobileLayout(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    media.addEventListener('change', handler);
    setIsMobile(media.matches);
    return () => media.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
