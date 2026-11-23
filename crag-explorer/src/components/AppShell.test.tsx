import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { CragContext } from '../context/CragContext';
import type { Crag } from '../types';
import AppShell from './AppShell';

function renderShell(crag: Crag): void {
  render(
    <MemoryRouter>
      <CragContext.Provider
        value={{
          crag,
          getUrl: (url) => `/${crag.id}${url}`,
        }}
      >
        <AppShell>
          <div>Page body</div>
        </AppShell>
      </CragContext.Provider>
    </MemoryRouter>,
  );
}

describe('AppShell crag header', () => {
  it('shows an Unpublished badge next to an unpublished crag name', () => {
    renderShell({ id: 'roshka', cragName: 'Roshka', published: false });

    expect(screen.getByRole('heading', { name: /Roshka\s*Unpublished/ })).toBeInTheDocument();
    expect(screen.getByText('Unpublished')).toHaveClass('unpublished-badge--header');
  });

  it('hides the Unpublished badge when the crag is published', () => {
    renderShell({ id: 'roshka', cragName: 'Roshka', published: true });

    expect(screen.getByRole('heading', { name: 'Roshka' })).toBeInTheDocument();
    expect(screen.queryByText('Unpublished')).not.toBeInTheDocument();
  });
});
