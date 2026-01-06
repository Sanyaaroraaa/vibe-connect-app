import { useState, useEffect, useMemo } from 'react';
import { db, auth } from "../config/firebase";
import { collection, query, onSnapshot, orderBy, doc } from "firebase/firestore";
import { getDistance } from "../utils/geoUtils";

export const useVibeFeed = (userLoc, filter) => {
  const [allVibes, setAllVibes] = useState([]);
  const [myTrustScore, setMyTrustScore] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "vibes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vibes = snapshot.docs.map(doc => {
        const data = doc.data();
        const rem = data.expiresAt ? Math.max(0, Math.round((data.expiresAt.toMillis() - Date.now()) / 60000)) : 0;
        return { id: doc.id, ...data, mins: rem };
      }).filter(v => v.mins > 0); 
      setAllVibes(vibes);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!auth.currentUser) return;
    const userRef = doc(db, "users", auth.currentUser.uid);
    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setMyTrustScore(snap.data().trustPoints || 0);
      }
    });
    return () => unsub();
  }, []);

  const filteredFeed = useMemo(() => {
    const uid = auth.currentUser?.uid;
    if (myTrustScore < 0) return [];

    return allVibes.filter(item => {
      const isOwner = item.creatorId === uid;
      const isPartner = item.participants?.includes(uid);
      
      if (isOwner || isPartner) return true;

    
      const score = item.creatorTrustScore !== undefined ? item.creatorTrustScore : 0;
      if (score < 0) return false;

      if (item.participantCount >= 1 || item.status !== "open") return false;
      if (filter !== "All" && item.activityType !== filter) return false;

      if (userLoc && item.coords) {
        const dist = getDistance(userLoc.lat, userLoc.lng, item.coords.lat, item.coords.lng);
        item.distLabel = dist < 1 ? `${Math.round(dist * 1000)}m away` : `${dist.toFixed(1)}km away`;
        return dist <= 1.0; 
      }
      return true;
    });
  }, [allVibes, userLoc, filter, myTrustScore]);

  return { filteredFeed, allVibes, myTrustScore };
};