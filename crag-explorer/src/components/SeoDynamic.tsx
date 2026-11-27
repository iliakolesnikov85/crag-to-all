import React from 'react';
import {
  buildCragSeo,
  buildRouteSeo,
  buildSectorSeo,
  type PageSeoText,
} from '@crag-to-all/shared-crag';
import { usePageHead } from '../hooks/usePageHead';
import type { Crag, CragData } from '../types';

interface SeoDynamicProps {
  /** The catalog entry. It names every page of the crag before its data loads. */
  crag: Crag;
  cragData?: CragData;
  currentRoute?: string;
  currentSector?: string;
}

/** Links store the name in lower case. The title uses the stored spelling. */
function sameName(stored: string, requested: string): boolean {
  return stored.toLowerCase() === requested.toLowerCase();
}

/**
 * Text for a sector or route page. Every other page, and a sector or route
 * that is not found, gets the crag's own text.
 */
function pageText(
  crag: Crag,
  cragData: CragData | undefined,
  sectorName: string | undefined,
  routeName: string | undefined,
): PageSeoText {
  const sector = sectorName
    ? cragData?.sectors.find((item) => sameName(item.name, sectorName))
    : undefined;
  if (sector && routeName) {
    const route = sector.routes.find((item) => sameName(item.name, routeName));
    if (route) return buildRouteSeo(crag.cragName, sector, route);
  } else if (sector) {
    return buildSectorSeo(crag.cragName, sector);
  }
  return buildCragSeo(crag);
}

const SeoDynamic: React.FC<SeoDynamicProps> = ({ crag, cragData, currentRoute, currentSector }) => {
  usePageHead(pageText(crag, cragData, currentSector, currentRoute));
  return null;
};

export default SeoDynamic;
