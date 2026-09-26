import React from 'react';
import { LoginScreen } from './LoginScreen';
import { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onLoginSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <LoginScreen onLoginSuccess={onLoginSuccess} />
    </div>
  );
};
