import React from 'react';
import { useCanEditCrag } from '../auth/useAuthSession';
import CragMembersPanel from '../components/members/CragMembersPanel';
import { useCrag } from '../context/CragContext';
import NotFound from './NotFound';
import './AuthorsPage.scss';

const AuthorsPage: React.FC = () => {
  const { crag } = useCrag();
  const canSee = useCanEditCrag(crag);
  if (!canSee) return <NotFound />;

  return (
    <div className="authors-page page">
      <CragMembersPanel />
    </div>
  );
};

export default AuthorsPage;
