import React from 'react';
import { Link } from 'react-router';
import { useCrag } from '../context/CragContext';
import Button from '../components/Button';
import './NotFound.scss';

const NotFound: React.FC = () => {
  const { crag, getUrl } = useCrag();
  const hasCrag = Boolean(crag.id);

  return (
    <div className="page not-found-page">
      <div className="not-found-content">
        <h1>404</h1>
        <h2>Page Not Found</h2>
        <p>The page you're looking for doesn't exist.</p>
        <div className="not-found-actions">
          <Button
            as={Link}
            to={hasCrag ? getUrl('/overview') : '/'}
            variant="primary"
            size="lg"
          >
            {hasCrag ? 'Go to Overview' : 'Choose a crag'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
