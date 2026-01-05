import { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, orderBy, where } from "firebase/firestore";
import { db, auth, getDistance } from "../config/firebase";

export const useVibeFeed = (userLoc, filter) => {
  const [feed, setFeed] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    // 1. Listen for Unread Notifications
    const qNotif = query(
      collection(db, "notifications"),
      where("recipientId", "==", auth.currentUser.uid),
      where("status", "==", "unread")
    );
    const unsubNotif = onSnapshot(qNotif, (snap) => setUnreadCount(snap.size));

    // 2. Listen for Live Vibes
    const qFeed = query(collection(db, "vibes"), orderBy("createdAt", "desc"));
    const unsubFeed = onSnapshot(qFeed, (snapshot) => {
      const vibes = snapshot.docs.map(doc => {
        const data = doc.data();
        // Calculate remaining minutes from Google's timestamp
        const rem = data.expiresAt 
          ? Math.max(0, Math.round((data.expiresAt.toMillis() - Date.now()) / 60000)) 
          : 0;
        return { id: doc.id, ...data, mins: rem };
      }).filter(v => v.mins > 0); // Only show vibes that haven't expired
      
      setFeed(vibes);
    });

    return () => { unsubNotif(); unsubFeed(); };
  }, []);

  // 3. Filter Logic (Distance + Status + Category)
  const filteredFeed = useMemo(() => {
    return feed.filter(item => {
      const isOwner = item.creatorId === auth.currentUser?.uid;
      const isPartner = item.participants?.includes(auth.currentUser?.uid);
      const isFull = item.participantCount >= 1;

      // Logic: If full, only show to the two people involved
      if (isFull && !isOwner && !isPartner) return false;
      
      // Ownership check
      if (isOwner) return true;

      // Distance Check (500m radius for campus safety)
      if (!userLoc || !item.coords) return true;
      const dist = getDistance(userLoc.lat, userLoc.lng, item.coords.lat, item.coords.lng);
      
      // Attach a label for the UI to display
      item.distLabel = dist < 1 ? `${Math.round(dist * 1000)}m away` : `${dist.toFixed(1)}km away`;
      
      return dist <= 0.5; // Radius limit
    }).filter(i => filter === "All" || i.activityType === filter);
  }, [feed, userLoc, filter]);

  return { filteredFeed, allVibes: feed, unreadCount };
};