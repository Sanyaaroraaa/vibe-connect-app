import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // 1. Initial State: Always start with LocalStorage for instant loading
  const [accent, setAccentState] = useState(() => {
    const savedColor = localStorage.getItem('user-accent-color');
    return savedColor || '#C1FF72'; 
  });

  // 2. Custom setter that updates local state and browser memory
  const setAccent = (newColor) => {
    setAccentState(newColor);
    localStorage.setItem('user-accent-color', newColor);
    
  
    if (auth.currentUser) {
      updateDoc(doc(db, "users", auth.currentUser.uid), {
        themeColor: newColor
      }).catch(err => console.error("Cloud sync failed", err));
    }
  };

  // 3. Effect: Sync with Cloud on Login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists() && userSnap.data().themeColor) {
          const cloudColor = userSnap.data().themeColor;
          setAccentState(cloudColor);
          localStorage.setItem('user-accent-color', cloudColor);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <ThemeContext.Provider value={{ accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};