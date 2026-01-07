import { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { getDistance } from '../utils/geoUtils';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

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
  const lastSyncLoc = useRef(null); 

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watcher = navigator.geolocation.watchPosition((pos) => { 
      const { latitude, longitude } = pos.coords;
      const coords = { lat: latitude, lng: longitude };
      
     
      setUserLoc(coords);

      
      let shouldSync = false;
      if (!lastSyncLoc.current) {
        shouldSync = true;
      } else {
        const distMoved = getDistance(
          lastSyncLoc.current.lat, 
          lastSyncLoc.current.lng, 
          latitude, 
          longitude
        );
        if (distMoved > 0.015) shouldSync = true; 
      }

      if (shouldSync && auth.currentUser) {
        const hash = encodeGeohash(latitude, longitude, 9);
        const areaHash = hash.substring(0, 6);
        lastSyncLoc.current = coords; 

        const userRef = doc(db, "users", auth.currentUser.uid);
        
        
        updateDoc(userRef, {
          lastCoords: coords,
          geohash: hash, 
          searchHash: areaHash,
          lastSeen: serverTimestamp()
        }).catch(err => console.error("Sync failed", err));
      }
    }, (err) => console.error(err), {
      enableHighAccuracy: false,
      maximumAge: 10000, 
      timeout: 15000
    });

    return () => navigator.geolocation.clearWatch(watcher);
  }, []);

  return userLoc;
};