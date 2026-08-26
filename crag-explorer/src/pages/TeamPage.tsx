import React, { useState, useEffect } from 'react';
import { FaInstagram, FaTelegram } from 'react-icons/fa';
import { shuffle } from '../utils/shuffle';
import './TeamPage.scss';

interface TeamMember {
  name: string;
  instagram?: string;
  telegram?: string;
}

const TeamPage: React.FC = () => {
  const teamMembers: TeamMember[] = [
    { name: 'George Manukian' },
    { name: 'Anton Solovev' },
    { name: 'Yenka Patlukh' },
    { name: 'Konstantin Amelin' },
    { name: 'Denis Borisov' },
    { name: 'Artem Karavaev' },
    { name: 'Ilia Kolesnikov', telegram: 'https://t.me/ikolesnikov' },
    { name: 'Reclus', instagram: 'https://www.instagram.com/re.clus' },
    { name: 'Egor Shirmakov' },
    { name: 'Andrey Ivanchenko' },
    { name: 'Ryabinin Evgenii', instagram: 'https://www.instagram.com/ryabinin_evgenii91' },
    { name: 'Olga Kharamanyan' },
    { name: 'Maxim Morozov' }
  ];

  const [shuffledTeam, setShuffledTeam] = useState<TeamMember[]>(teamMembers);

  useEffect(() => {
    setShuffledTeam(shuffle(teamMembers));
  }, []);

  const getSocialLink = (member: TeamMember) => {
    // Instagram takes priority over Telegram
    return member.instagram || member.telegram;
  };

  const getSocialIcon = (member: TeamMember) => {
    if (member.instagram) {
      return <FaInstagram className="social-icon social-icon--instagram" aria-hidden="true" />;
    }
    if (member.telegram) {
      return <FaTelegram className="social-icon social-icon--telegram" aria-hidden="true" />;
    }
    return null;
  };

  return (
    <div className="team-page page">
      <div className="team-content">
        <div className="team-description">
          <h3>About Roshka Team</h3>
          <p>
            We are the group of friends united by bouldering passion. Our shared love for climbing 
            has brought us together, creating a community that supports and inspires each other 
            to push our limits and explore new heights. Whether we're tackling challenging routes 
            or sharing beta, our team spirit and camaraderie make every climbing session an adventure.
            Follow us on Instagram <a href="https://www.instagram.com/roshka.climb/" target="_blank" rel="noopener noreferrer">roshka.climb</a>
          </p>
        </div>
        
        <div className="team-members">
          <div className="members-grid">
            {shuffledTeam.map((member, index) => {
              const socialLink = getSocialLink(member);
              const socialIcon = getSocialIcon(member);
              
              return (
                <div 
                  key={index} 
                  className={`member-card ${socialLink ? 'clickable' : ''}`}
                  onClick={socialLink ? () => window.open(socialLink, '_blank', 'noopener,noreferrer') : undefined}
                >
                  <div className="member-name">
                    {member.name}
                    {socialIcon}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamPage;
