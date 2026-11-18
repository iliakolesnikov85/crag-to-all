import React from 'react';
import { Link } from 'react-router';
import { useCrag } from '../context/CragContext';
import './Footer.scss';

const Footer: React.FC = () => {
  const { crag, getUrl } = useCrag();
  const teamUrl = crag.id ? getUrl('/team') : null;

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          {teamUrl ? (
            <Link to={teamUrl} className="footer-link">
              Created by Roshka Team
            </Link>
          ) : (
            <span className="footer-link">Created by Roshka Team</span>
          )}
          <span className="footer-separator">•</span>
          <a 
            href="https://cursor.sh" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
          >
            Powered by Cursor
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 