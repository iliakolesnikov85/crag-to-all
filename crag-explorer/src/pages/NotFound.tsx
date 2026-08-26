import React from 'react';
import { Link } from 'react-router';
import { useCrag } from '../context/CragContext';
import Button from '../components/Button';
import './NotFound.scss';

const NotFound: React.FC = () => {
  const { getUrl } = useCrag();

  return (
    <div className="page not-found-page">
      <div className="not-found-content">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <div className="not-found-actions">
          <Button as={Link} to={getUrl('/overview')} variant="primary" size="lg">
            Go to Overview
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
