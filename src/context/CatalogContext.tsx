import React, { createContext, useContext, useState } from 'react';
import { defaultCatalog, MockMusicCatalog } from '../services/catalog/MockMusicCatalog';
import { MusicCatalog } from '../services/catalog/MusicCatalog';

interface CatalogContextType {
  catalog: MusicCatalog;
  setCatalog: (catalog: MusicCatalog) => void;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export const CatalogProvider: React.FC<{
  children: React.ReactNode;
  initialCatalog?: MusicCatalog;
}> = ({ children, initialCatalog = defaultCatalog }) => {
  const [catalog, setCatalog] = useState<MusicCatalog>(initialCatalog);

  return (
    <CatalogContext.Provider value={{ catalog, setCatalog }}>
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
