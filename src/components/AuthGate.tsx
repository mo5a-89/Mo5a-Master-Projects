import React from 'react';
import { User } from '../types';
import { LoginScreen } from './LoginScreen';

interface AuthGateProps {
  currentUser?: User | null;
  onLoginSuccess: (user: User, token: string) => void;
  children?: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({
  currentUser,
  onLoginSuccess,
  children,
}) => {
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={onLoginSuccess} />;
  }

  return <>{children}</>;
};
