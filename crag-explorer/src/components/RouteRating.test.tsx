import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RouteRating from './RouteRating';

describe('RouteRating', () => {
  it('renders a display-only rating and hides a missing rating', () => {
    const { rerender } = render(<RouteRating rating={2} ratingVotes="4 votes" />);

    expect(screen.getByRole('img', { name: '4 votes' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    rerender(<RouteRating />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('sets a whole-star rating and clears it when that star is clicked again', () => {
    const onChange = vi.fn();
    render(<RouteRating rating={2.5} onChange={onChange} />);

    expect(screen.getByRole('group', { name: 'Rating' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2 stars' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: '3 stars' }));
    fireEvent.click(screen.getByRole('button', { name: '2 stars' }));

    expect(onChange).toHaveBeenNthCalledWith(1, 3);
    expect(onChange).toHaveBeenNthCalledWith(2, 2);

    onChange.mockClear();
    render(<RouteRating rating={2} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: '2 stars' })[1]);

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it('shows empty stars when a rating can be chosen and none is set', () => {
    render(<RouteRating onChange={() => {}} />);

    expect(screen.getByRole('button', { name: '1 star' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: '3 stars' })).toHaveAttribute('aria-pressed', 'false');
  });
});
