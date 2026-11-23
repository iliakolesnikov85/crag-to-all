import React from 'react';
import './UnpublishedBadge.scss';

interface UnpublishedBadgeProps {
  variant: 'header' | 'card';
}

const UnpublishedBadge: React.FC<UnpublishedBadgeProps> = ({ variant }) => (
  <span
    className={`unpublished-badge unpublished-badge--${variant}`}
    title="This crag is not published"
  >
    Unpublished
  </span>
);

export default UnpublishedBadge;
