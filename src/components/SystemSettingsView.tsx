import React from 'react';
import { SettingsHub } from './SettingsHub';
import { User } from '../types';
import { NavigationLabels } from '../utils/navigationConfig';

interface SystemSettingsViewProps {
  currentUser: User | null;
  onOpenAuditTrail: () => void;
  onOpenBackupModal: () => void;
  onOpenGoogleDriveSync: () => void;
  onOpenPreFlight?: () => void;
  onOpenUserManagement?: () => void;
  onLabelsUpdated?: (newLabels: NavigationLabels) => void;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = (props) => {
  return <SettingsHub {...props} />;
};

export { SettingsHub };
