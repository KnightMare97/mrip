import { WifiOff } from 'lucide-react';
import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed top-14 left-0 right-0 z-40 bg-amber-500/90 text-zinc-950 px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 shadow-md backdrop-blur-sm"
    >
      <WifiOff className="h-4 w-4" />
      <span>{t.offlineBanner}</span>
    </div>
  );
};
