import React from 'react';
import './RouteRating.scss';

const STAR_COUNT = 3;

export interface RouteRatingProps {
  rating?: number;
  ratingVotes?: string;
  className?: string;
  disabled?: boolean;
  /** When set, the stars are buttons. Clicking the current whole-star value clears the rating. */
  onChange?: (rating: number) => void;
}

function getStarState(starIndex: number, rating: number): 'full' | 'half' | 'empty' {
  const value = rating - starIndex;
  if (value >= 1) return 'full';
  if (value >= 0.5) return 'half';
  return 'empty';
}

const RouteRating: React.FC<RouteRatingProps> = ({
  rating,
  ratingVotes,
  className,
  disabled = false,
  onChange,
}) => {
  if (onChange === undefined && rating === undefined) return null;

  const value = rating ?? 0;
  const classNames = ['route-rating', className].filter(Boolean).join(' ');

  if (onChange) {
    return (
      <span className={classNames}>
        <span className="route-rating__stars" role="group" aria-label="Rating">
          {Array.from({ length: STAR_COUNT }, (_, index) => {
            const starValue = index + 1;
            return (
              <button
                key={index}
                type="button"
                className={`route-rating__star route-rating__star--${getStarState(index, value)}`}
                aria-label={starValue === 1 ? '1 star' : `${starValue} stars`}
                aria-pressed={value === starValue}
                disabled={disabled}
                onClick={() => onChange(value === starValue ? 0 : starValue)}
              />
            );
          })}
        </span>
      </span>
    );
  }

  return (
    <span className={classNames} title={ratingVotes}>
      <span
        className="route-rating__stars"
        role="img"
        aria-label={ratingVotes || `Rating ${value} out of 3`}
      >
        {Array.from({ length: STAR_COUNT }, (_, index) => (
          <span
            key={index}
            className={`route-rating__star route-rating__star--${getStarState(index, value)}`}
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
