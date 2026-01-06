import { useState, useEffect } from 'react';
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../config/firebase";
import { updatePresence } from '../services/vibeService'; 

export const useActiveVibe = (itemId) => {
  const [vibeData, setVibeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const currentUid = auth.currentUser?.uid;

  useEffect(() => {
    if (!itemId || !currentUid) { 
      setLoading(false); 
      return; 
    }
    
    // 1. Mark presence ASYNCHRONOUSLY 
    // We don't want to block the listener setup
    updatePresence(itemId, currentUid, true).catch(console.error);

    // 2. Setup the Listener
    const vibeRef = doc(db, "vibes", itemId);
    const unsubscribe = onSnapshot(vibeRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // LOGIC CHECK: 
        // If the database says the session is started but we don't have an expiry,
        // it means we are in the middle of a write. 
        setVibeData({ id: snap.id, ...data });
      } else {
        setVibeData(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Vibe Listener Error:", error);
      setLoading(false);
    });

    // 3. Cleanup: Stop listening AND mark presence as false
    return () => {
      unsubscribe();
      // Use a fire-and-forget call for cleanup
      updatePresence(itemId, currentUid, false).catch(console.error);
    };
    
    // NOTE: only itemId is needed here usually, currentUid is stable
  }, [itemId, currentUid]);

  return { vibeData, loading };
};