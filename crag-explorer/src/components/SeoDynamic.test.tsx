import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { headContent, insertPatchedHead } from '../test/helpers';
import { CRAG_DATA_PROTOCOL, type Crag, type CragData } from '../types';
import SeoDynamic from './SeoDynamic';

const crag: Crag = {
  id: 'roshka',
  cragName: 'Roshka',
  published: true,
  country: 'GE',
  description: 'Granite in the Caucasus.',
  routeStats: { routeCount: 1, typeCounts: { Boulder: 1 } },
};

const cragData: CragData = {
  protocolVersion: CRAG_DATA_PROTOCOL,
  name: 'Roshka',
  description: [],
  sectors: [
    {
      name: 'Boulders',
      geo: null,
      images: [],
      routes: [
        {
          id: 'one',
          name: 'One',
          grade: '6A',
          type: 'Boulder',
          sectorName: 'Boulders',
          description: '',
          tags: [],
          images: [],
        },
      ],
    },
  ],
};

const CRAG_TITLE = 'Roshka Climbing Guide';

function canonical(): string | null | undefined {
  return document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
}

describe('SeoDynamic', () => {
  let restoreHead: () => void;

  beforeEach(() => {
    restoreHead = insertPatchedHead({
      title: 'Crag Explorer',
      description: 'Free climbing guidebooks.',
    });
  });

  afterEach(() => {
    restoreHead();
    vi.unstubAllEnvs();
  });

  it('writes the sector title and description into every tag the patched page has', () => {
    render(
      <MemoryRouter initialEntries={['/roshka/sector/Boulders']}>
        <SeoDynamic crag={crag} cragData={cragData} currentSector="Boulders" />
      </MemoryRouter>,
    );

    expect(document.title).toBe('Boulders Sector - Roshka Climbing Guide');
    expect(headContent('meta[property="og:title"]')).toBe(document.title);
    const description = headContent('meta[name="description"]');
    expect(description).toContain('Boulders sector at Roshka');
    expect(headContent('meta[property="og:description"]')).toBe(description);
  });

  it('uses the stored names when the link is lower case', () => {
    render(
      <MemoryRouter initialEntries={['/roshka/sector/boulders/one']}>
        <SeoDynamic crag={crag} cragData={cragData} currentSector="boulders" currentRoute="one" />
      </MemoryRouter>,
    );

    expect(document.title).toBe('One - Boulders | Roshka Climbing');
    expect(headContent('meta[name="description"]')).toContain(
      'One is a 6A boulder problem at Boulders, Roshka.',
    );
  });

  it('describes the crag on a page that is not a sector or route', () => {
    render(
      <MemoryRouter initialEntries={['/roshka/overview']}>
        <SeoDynamic crag={crag} cragData={cragData} />
      </MemoryRouter>,
    );

    expect(document.title).toBe(CRAG_TITLE);
    expect(headContent('meta[name="description"]')).toBe(
      'Roshka is a free bouldering guidebook in Georgia. 1 boulder problem. Granite in the Caucasus.',
    );
  });

  it('describes the crag before its data has loaded', () => {
    render(
      <MemoryRouter initialEntries={['/roshka/sector/Boulders']}>
        <SeoDynamic crag={crag} currentSector="Boulders" />
      </MemoryRouter>,
    );

    expect(document.title).toBe(CRAG_TITLE);
  });

  it('describes the crag when the sector or route is not found', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/roshka/sector/Nowhere']}>
        <SeoDynamic crag={crag} cragData={cragData} currentSector="Nowhere" />
      </MemoryRouter>,
    );
    expect(document.title).toBe(CRAG_TITLE);

    rerender(
      <MemoryRouter initialEntries={['/roshka/sector/Boulders/Missing']}>
        <SeoDynamic crag={crag} cragData={cragData} currentSector="Boulders" currentRoute="Missing" />
      </MemoryRouter>,
    );
    expect(document.title).toBe(CRAG_TITLE);
  });

  it('puts the crag title back after a sector page', () => {
    const { rerender } = render(
      <MemoryRouter>
        <SeoDynamic crag={crag} cragData={cragData} currentSector="Boulders" />
      </MemoryRouter>,
    );
    expect(document.title).toContain('Boulders Sector');

    rerender(
      <MemoryRouter>
        <SeoDynamic crag={crag} cragData={cragData} />
      </MemoryRouter>,
    );
    expect(document.title).toBe(CRAG_TITLE);
    expect(headContent('meta[property="og:title"]')).toBe(CRAG_TITLE);
  });

  it('adds one canonical link for the current path and keeps it in step', () => {
    expect(canonical()).toBeUndefined();

    const { unmount } = render(
      <MemoryRouter initialEntries={['/roshka/overview']}>
        <SeoDynamic crag={crag} cragData={cragData} />
      </MemoryRouter>,
    );
    expect(canonical()).toBe(`${window.location.origin}/roshka/overview`);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    unmount();

    render(
      <MemoryRouter initialEntries={['/roshka/routes']}>
        <SeoDynamic crag={crag} cragData={cragData} />
      </MemoryRouter>,
    );
    expect(canonical()).toBe(`${window.location.origin}/roshka/routes`);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
  });

  it('names the configured site in the canonical link, not the visited host', () => {
    vi.stubEnv('VITE_SITE_URL', 'https://crags-for-all.web.app/');
    render(
      <MemoryRouter initialEntries={['/roshka/overview']}>
        <SeoDynamic crag={crag} cragData={cragData} />
      </MemoryRouter>,
    );

    expect(canonical()).toBe('https://crags-for-all.web.app/roshka/overview');
  });

  it('writes no URL tag the shell does not have', () => {
    render(
      <MemoryRouter initialEntries={['/roshka/overview']}>
        <SeoDynamic crag={crag} cragData={cragData} />
      </MemoryRouter>,
    );

    expect(document.head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(document.head.querySelector('meta[name="twitter:url"]')).toBeNull();
  });
});
