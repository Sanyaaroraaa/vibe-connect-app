import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

// Standard Geohash Alphabet
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

// Helper to encode Geohash without needing an external npm package
const encodeGeohash = (lat, lon, precision = 9) => {
  let latInterval = [-90, 90];
  let lonInterval = [-180, 180];
  let geohash = '';
  let bits = 0;
  let combinedBits = 0;
  let evenBit = true;

  while (geohash.length < precision) {
    let mid;
    if (evenBit) {
      mid = (lonInterval[0] + lonInterval[1]) / 2;
      if (lon > mid) {
        combinedBits = (combinedBits << 1) | 1;
        lonInterval[0] = mid;
      } else {
        combinedBits = (combinedBits << 1) | 0;
        lonInterval[1] = mid;
      }
    } else {
      mid = (latInterval[0] + latInterval[1]) / 2;
      if (lat > mid) {
        combinedBits = (combinedBits << 1) | 1;
        latInterval[0] = mid;
      } else {
        combinedBits = (combinedBits << 1) | 0;
        latInterval[1] = mid;
      }
    }

    evenBit = !evenBit;
    bits++;

    if (bits === 5) {
      geohash += BASE32[combinedBits];
      bits = 0;
      combinedBits = 0;
    }
  }
  return geohash;
};

export const useLocation = () => {
  const [userLoc, setUserLoc] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watcher = navigator.geolocation.watchPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const coords = { lat: latitude, lng: longitude };
      setUserLoc(coords);

      // Generate a 9-character precision geohash (roughly 4m x 4m accuracy)
      const hash = encodeGeohash(latitude, longitude, 9);

      if (auth.currentUser) {
        try {
          const userRef = doc(db, "users", auth.currentUser.uid);
          await updateDoc(userRef, {
            lastCoords: coords,
            geohash: hash, // 🚀 This allows for lightning-fast Radar queries
            lastSeen: serverTimestamp()
          });
        } catch (err) {
          console.error("Location/Geohash sync failed:", err);
        }
      }
    }, (err) => console.error(err), {
      enableHighAccuracy: true,
      maximumAge: 10000, // Update every 10 seconds to save battery
      timeout: 5000
    });

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return userLoc;
};