import { useEffect, type ReactNode } from 'react';
import { startAuthListener } from './firebaseAuth';
import { setAuthAccount } from './session';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  useEffect(() => {
    try {
      return startAuthListener();
    } catch (error) {
      console.error('Failed to start Firebase Auth:', error);
      setAuthAccount(null);
    }
  }, []);

  return children;
}
