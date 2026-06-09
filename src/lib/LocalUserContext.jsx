import { createContext, useContext, useState, useEffect } from 'react';

const LocalUserContext = createContext(null);

export function LocalUserProvider({ children }) {
  const [localUser, setLocalUser] = useState(() => {
    try {
      const stored = localStorage.getItem('allhands_local_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const signIn = (member) => {
    localStorage.setItem('allhands_local_user', JSON.stringify(member));
    setLocalUser(member);
  };

  const signOut = () => {
    localStorage.removeItem('allhands_local_user');
    setLocalUser(null);
  };

  return (
    <LocalUserContext.Provider value={{ localUser, signIn, signOut }}>
      {children}
    </LocalUserContext.Provider>
  );
}

export function useLocalUser() {
  return useContext(LocalUserContext);
}