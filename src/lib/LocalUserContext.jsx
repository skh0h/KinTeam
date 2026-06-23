import { createContext, useContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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

  // Refresh localUser from DB on mount to pick up any role/data changes
  useEffect(() => {
    const stored = localStorage.getItem('allhands_local_user');
    if (!stored) return;
    let cached;
    try {
      cached = JSON.parse(stored);
    } catch {
      localStorage.removeItem('allhands_local_user');
      return;
    }
    base44.entities.FamilyMember.list().then(members => {
      const fresh = members.find(m => m.id === cached.id);
      if (fresh) {
        localStorage.setItem('allhands_local_user', JSON.stringify(fresh));
        setLocalUser(fresh);
      }
    }).catch((err) => console.warn('LocalUser member refresh failed:', err));
  }, []);

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