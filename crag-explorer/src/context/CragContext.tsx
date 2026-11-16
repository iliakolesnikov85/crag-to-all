import { createContext, useContext } from 'react';
import { Crag } from '../types';

export interface CragContextType {
  crag: Crag;
  getUrl: (url: string) => string;
}

export const CragContext = createContext<CragContextType>({
  crag: { id: '', cragName: '' },
  getUrl: () => {
    throw new Error('getUrl not implemented');
  },
});

export const useCrag = () => useContext(CragContext);
