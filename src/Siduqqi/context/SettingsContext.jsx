import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const SettingsContext = createContext(null);

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  // Global Client_id state
  const [clientId, setClientId] = useState(() => {
    return localStorage.getItem("advisorsme_client_id") || "";
  });

  // In-memory cache for API requests
  const [apiCache, setApiCache] = useState({});

  useEffect(() => {
    localStorage.setItem("advisorsme_client_id", clientId);
  }, [clientId]);

  // Provide a method to get cached data for a specific route/key and clientId
  const getCachedData = useCallback((key, currentClientId) => {
    const cached = apiCache[`${key}_${currentClientId}`];
    if (cached) {
      return cached;
    }
    return null;
  }, [apiCache]);

  // Provide a method to set cached data
  const setCachedData = useCallback((key, currentClientId, data) => {
    setApiCache(prev => ({
      ...prev,
      [`${key}_${currentClientId}`]: data
    }));
  }, []);

  // Method to clear cache if needed
  const clearCache = useCallback(() => {
    setApiCache({});
  }, []);

  return (
    <SettingsContext.Provider 
      value={{ 
        clientId, 
        setClientId, 
        getCachedData, 
        setCachedData,
        clearCache
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};
