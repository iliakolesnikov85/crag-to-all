import { CRAG_DATA_PROTOCOL, type CragData } from './types';

export function isCurrentCragDataProtocol(data: unknown): data is CragData {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { protocolVersion?: unknown }).protocolVersion === CRAG_DATA_PROTOCOL
  );
}
