import { useContext } from 'react';
import { AppOnlineContext } from '../context/AppOnlineContext';

/** True when the app can reach Firebase / the network (not DevTools-offline with onLine stuck true). */
export function useOnlineStatus(): boolean {
  const ctx = useContext(AppOnlineContext);
  if (ctx) return ctx.isOnline;
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
