import React, { createContext, useContext, useEffect, useState } from 'react';
import { defaultCatalog } from '../services/catalog/MockMusicCatalog';
import { MusicCatalog } from '../services/catalog/MusicCatalog';
import { youtubeMusicCatalog } from '../services/catalog/YouTubeMusicCatalog';

export type CatalogSource = 'ytmusic' | 'demo';

interface CatalogContextType {
  catalog: MusicCatalog;
  source: CatalogSource;
  setSource: (source: CatalogSource) => void;
  isLive: boolean;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [source, setSourceState] = useState<CatalogSource>(() => {
    try {
      return (localStorage.getItem('musicrip_catalog_source') as CatalogSource) || 'ytmusic';
    } catch {
      return 'ytmusic';
    }
  });

  const setSource = (newSource: CatalogSource) => {
    setSourceState(newSource);
    try {
      localStorage.setItem('musicrip_catalog_source', newSource);
    } catch {
      // ignore
    }
  };

  const catalog = source === 'ytmusic' ? youtubeMusicCatalog : defaultCatalog;

  return (
    <CatalogContext.Provider
      value={{
        catalog,
        source,
        setSource,
        isLive: source === 'ytmusic'
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
};

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return context;
}
