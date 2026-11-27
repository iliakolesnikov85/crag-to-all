import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { headContent, insertPatchedHead } from '../test/helpers';
import AboutPage from './AboutPage';

function renderAbout() {
  return render(
    <MemoryRouter initialEntries={['/about']}>
      <AboutPage />
    </MemoryRouter>,
  );
}

const open = vi.spyOn(window, 'open').mockImplementation(() => null);

afterEach(() => {
  open.mockClear();
});

afterAll(() => {
  open.mockRestore();
});

describe('AboutPage', () => {
  it('renders the team blurb and member names', () => {
    renderAbout();

    expect(screen.getByRole('heading', { name: 'About Roshka Team' })).toBeInTheDocument();
    expect(screen.getByText('George Manukian')).toBeInTheDocument();
    expect(screen.getByText('Ilia Kolesnikov')).toBeInTheDocument();
    expect(screen.getByText('Reclus')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'roshka.climb' }),
    ).toHaveAttribute('href', 'https://www.instagram.com/roshka.climb/');
  });

  it('sets its own title and description', () => {
    const restoreHead = insertPatchedHead({
      title: 'A Sector - Roshka Climbing Guide',
      description: 'A sector at Roshka.',
    });
    try {
      renderAbout();

      expect(document.title).toBe('About the team - Crag Explorer');
      expect(headContent('meta[name="description"]')).toContain('bouldering');
      expect(headContent('meta[property="og:title"]')).toBe(document.title);
    } finally {
      restoreHead();
    }
  });

  it('opens Instagram ahead of Telegram when a card is clicked', () => {
    renderAbout();

    fireEvent.click(screen.getByText('Reclus').closest('.member-card')!);
    expect(open).toHaveBeenCalledWith(
      'https://www.instagram.com/re.clus',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByText('Ilia Kolesnikov').closest('.member-card')!);
    expect(open).toHaveBeenCalledWith(
      'https://t.me/ikolesnikov',
      '_blank',
      'noopener,noreferrer',
    );

    fireEvent.click(screen.getByText('George Manukian').closest('.member-card')!);
    expect(open).toHaveBeenCalledTimes(2);
  });
});
