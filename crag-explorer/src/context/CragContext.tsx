import { createContext, useContext } from 'react';
import { Crag } from '../types';

export interface CragContextType {
  crag: Crag;
  getUrl: (url: string) => string;
}

/** Context value outside a crag: the crag id is empty. */
export const EMPTY_CRAG_CONTEXT: CragContextType = {
  crag: { id: '', cragName: '', published: true },
  getUrl: () => {
    throw new Error('getUrl not implemented');
  },
};

export const CragContext = createContext<CragContextType>(EMPTY_CRAG_CONTEXT);

export const useCrag = () => useContext(CragContext);
