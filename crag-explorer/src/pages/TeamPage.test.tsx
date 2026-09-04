import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import TeamPage from './TeamPage';

const open = vi.spyOn(window, 'open').mockImplementation(() => null);

afterEach(() => {
  open.mockClear();
});

afterAll(() => {
  open.mockRestore();
});

describe('TeamPage', () => {
  it('renders the team blurb and member names', () => {
    render(<TeamPage />);

    expect(screen.getByRole('heading', { name: 'About Roshka Team' })).toBeInTheDocument();
    expect(screen.getByText('George Manukian')).toBeInTheDocument();
    expect(screen.getByText('Ilia Kolesnikov')).toBeInTheDocument();
    expect(screen.getByText('Reclus')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'roshka.climb' }),
    ).toHaveAttribute('href', 'https://www.instagram.com/roshka.climb/');
  });

  it('opens Instagram ahead of Telegram when a card is clicked', () => {
    render(<TeamPage />);

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
