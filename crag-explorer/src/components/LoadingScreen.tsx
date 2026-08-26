import React from 'react';
import './LoadingScreen.scss';

interface LoadingScreenProps {
  message: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message }) => (
  <div className="loading-screen" role="status" aria-live="polite">
    <div className="loading-screen__spinner" aria-hidden="true" />
    <p className="loading-screen__message">{message}</p>
  </div>
);

export default LoadingScreen;
