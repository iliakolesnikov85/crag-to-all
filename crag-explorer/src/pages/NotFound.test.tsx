import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CragContext } from '../context/CragContext';
import { SAMPLE_CRAG_ID } from '../test/fixtures/cragData';
import NotFound from './NotFound';

describe('NotFound', () => {
  it('explains the 404 and links back to overview via getUrl', () => {
    render(
      <MemoryRouter>
        <CragContext.Provider
          value={{
            crag: { cragId: SAMPLE_CRAG_ID, cragName: 'Test Crag' },
            getUrl: (url: string) => `/test-crag${url}`,
          }}
        >
          <NotFound />
        </CragContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Page Not Found' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Go to Overview' }),
    ).toHaveAttribute('href', '/test-crag/overview');
  });
});
