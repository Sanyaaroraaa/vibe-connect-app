import { useState, useEffect } from 'react';
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { updatePresence } from '../services/vibeService'; 

export const useActiveVibe = (itemId) => {
  const [vibeData, setVibeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!itemId || !currentUid) { setLoading(false); return; }
    
   
    updatePresence(itemId, currentUid, true);

    const vibeRef = doc(db, "vibes", itemId);
    const unsubscribe = onSnapshot(vibeRef, (snap) => {
      if (snap.exists()) {
        setVibeData({ id: snap.id, ...snap.data() });
      } else {
        setVibeData(null);
      }
      setLoading(false);
    });

    
    return () => {
      unsubscribe();
      updatePresence(itemId, currentUid, false);
    };
  }, [itemId, currentUid]);

  return { vibeData, loading };
};