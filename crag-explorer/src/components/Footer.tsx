import React from 'react';
import { Link } from 'react-router';
import './Footer.scss';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-links">
          <Link to="/about" className="footer-link">
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