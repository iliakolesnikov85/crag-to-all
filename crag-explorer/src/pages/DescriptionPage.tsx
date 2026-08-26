import React from 'react';
import { DescriptionSection } from '../types';
import './DescriptionPage.scss';

interface DescriptionPageProps {
  description: DescriptionSection[];
}

const DescriptionPage: React.FC<DescriptionPageProps> = ({ description }) => (
  <div className="page">
    <div className="description-content">
      {description.length > 0 ? (
        description.map((section, index) => (
          <div key={index} className="description-section">
            <h3>{section.subheader}</h3>
            {section.paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} dangerouslySetInnerHTML={{ __html: paragraph }} />
            ))}
          </div>
        ))
      ) : (
        <p>Loading description...</p>
      )}
    </div>
  </div>
);

export default DescriptionPage; 