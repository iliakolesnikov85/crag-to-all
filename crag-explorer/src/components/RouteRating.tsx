import React from 'react';
import './RouteRating.scss';

const STAR_COUNT = 3;

export interface RouteRatingProps {
  rating?: number;
  ratingVotes?: string;
  className?: string;
}

function getStarState(starIndex: number, rating: number): 'full' | 'half' | 'empty' {
  const value = rating - starIndex;
  if (value >= 1) return 'full';
  if (value >= 0.5) return 'half';
  return 'empty';
}

const RouteRating: React.FC<RouteRatingProps> = ({ rating, ratingVotes, className }) => {
  if (rating === undefined) return null;

  const classNames = ['route-rating', className].filter(Boolean).join(' ');

  return (
    <span className={classNames} title={ratingVotes}>
      <span
        className="route-rating__stars"
        role="img"
        aria-label={ratingVotes || `Rating ${rating} out of 3`}
      >
        {Array.from({ length: STAR_COUNT }, (_, index) => (
          <span
            key={index}
            className={`route-rating__star route-rating__star--${getStarState(index, rating)}`}
            aria-hidden="true"
          />
        ))}
      </span>
    </span>
  );
};

export function renderRouteRating(route: Pick<RouteRatingProps, 'rating' | 'ratingVotes'>) {
  return <RouteRating rating={route.rating} ratingVotes={route.ratingVotes} />;
}

export default RouteRating;
