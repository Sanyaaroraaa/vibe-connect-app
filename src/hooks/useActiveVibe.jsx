import { useState, useEffect } from 'react';
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";


  export const useActiveVibe = (itemId) => {
  const [vibeData, setVibeData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!itemId) { setLoading(false); return; }
    const vibeRef = doc(db, "vibes", itemId);

    const unsubscribe = onSnapshot(vibeRef, (snap) => {
      if (snap.exists()) {
        setVibeData({ id: snap.id, ...snap.data() });
      } else {
        setVibeData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [itemId]);

  return { vibeData, loading };
};