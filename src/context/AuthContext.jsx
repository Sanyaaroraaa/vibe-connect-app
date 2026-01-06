import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth'; 
import { doc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('new');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubStatus = () => {};

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        unsubStatus = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setStatus(docSnap.data().status || 'new');
          }
          setLoading(false);
        });
      } else {
        setUser(null);
        setStatus('new');
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      unsubStatus();
    };
  }, []);


  const logout = async () => {
    try {
      await signOut(auth);
      
     
      localStorage.removeItem('activeVibeId');
      localStorage.removeItem('isMeetupActive');
      
      
      window.location.replace('/'); 
      
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  const isAccessGranted = (adminUid) => {
    if (!user) return false;
    return status === 'approved' || user.uid === adminUid;
  };

  return (
    <AuthContext.Provider value={{ user, status, loading, isAccessGranted, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};