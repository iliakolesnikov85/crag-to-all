import React from 'react';
import './Footer.scss';
import { useCrag } from '../context/CragContext';
import { Link } from 'react-router';

const Footer: React.FC = () => {
  const { getUrl } = useCrag();

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          <Link 
            to={getUrl('/team')}             
            className="footer-link"
          >
                         Created by Roshka Team
          </Link>
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