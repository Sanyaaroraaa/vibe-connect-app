import { db, auth } from "../config/firebase";
import { 
  collection, addDoc, doc, updateDoc, arrayUnion, increment, 
  getDoc, Timestamp, deleteDoc, serverTimestamp, getDocs, limit,
  writeBatch, query, where, runTransaction, arrayRemove
} from "firebase/firestore";
import { getDistance } from "../utils/geoUtils";
import geohash from 'ngeohash';
import { toast } from 'react-toastify';
import { analytics } from "../config/firebase";
import { logEvent } from "firebase/analytics";

/**
 * OPTIMIZATION: Distributed Cleanup
 * Only cleans the CURRENT user's expired data to save on Firestore reads/writes.
 */
const runUserCleanup = async (uid) => {
  try {
    const now = Timestamp.fromDate(new Date());
    const batch = writeBatch(db);

    const qNotif = query(
      collection(db, "notifications"), 
      where("recipientId", "==", uid), 
      where("expiresAt", "<", now)
    );
    
    const qVibes = query(
      collection(db, "vibes"), 
      where("creatorId", "==", uid), 
      where("expiresAt", "<", now)
    );

    const [notifSnap, vibeSnap] = await Promise.all([getDocs(qNotif), getDocs(qVibes)]);

    notifSnap.docs.forEach(d => batch.delete(d.ref));
    vibeSnap.docs.forEach(d => batch.delete(d.ref));

    if (!notifSnap.empty || !vibeSnap.empty) {
      await batch.commit();
      console.log("✅ Self-cleanup complete.");
    }
  } catch (err) { 
    console.error("❌ Local Janitor failed:", err); 
  }
};

const triggerNotification = async (recipientId, title, body, type, vibeId = null) => {
  if (!recipientId || recipientId === auth.currentUser?.uid) return;
  try {
    const payload = {
      recipientId, title, body, type, status: 'unread',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
    };
    if (vibeId) payload.vibeId = vibeId;
    await addDoc(collection(db, "notifications"), payload);
  } catch (err) { console.error("❌ Notification failed:", err); }
};

/**
 * FEATURE: Create Vibe with Neighbor Discovery
 * Uses 9-block geohash searching to ensure no one is missed at boundaries.
 */
export const createVibe = async (vibeData, userLoc) => {
  if (!auth.currentUser) throw new Error("Unauthorized");
  if (!userLoc) throw new Error("Location required");
  
  const uid = auth.currentUser.uid;
  const userRef = doc(db, "users", uid);
  
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error("User profile not found");
    const userData = userSnap.data();
    
    if (!userData.blockedUsers) {
      await updateDoc(userRef, { blockedUsers: [] });
    }

    const currentTrust = userData.trustPoints || 0;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let generatedKey = "";
    for (let i = 0; i < 4; i++) generatedKey += chars.charAt(Math.floor(Math.random() * chars.length));
    
    const durationMins = vibeData.mins || 15;
    
    const vibePayload = {
      creatorName: auth.currentUser.displayName || "Node",
      creatorId: uid, 
      creatorTrustScore: currentTrust, 
      text: vibeData.text,
      locationName: vibeData.loc || "Campus Spot", 
      activityType: vibeData.type || "Other",
      secureKey: generatedKey,
      coords: { lat: userLoc.lat, lng: userLoc.lng },
      createdAt: serverTimestamp(),
      durationMins: durationMins,
      expiresAt: Timestamp.fromDate(new Date(Date.now() + durationMins * 60000)),
      participants: [],
      participantsNames: [], 
      participantCount: 0,
      activeParticipants: [], 
      sessionStarted: false,
      status: "open",
      messages: []
    };

    const docRef = await addDoc(collection(db, "vibes"), vibePayload);
    analytics.then(instance => {
    if (instance) {
      logEvent(instance, 'vibe_created', {
        activity_type: vibeData.type,
        duration: vibeData.mins,
        location: vibeData.loc
      });
    }
  });

    await updateDoc(userRef, { 
      lastSeen: serverTimestamp(), 
      lastCoords: userLoc 
    });

    // Run the optimized cleanup
    runUserCleanup(uid);
    
    // NEIGHBOR LOGIC: Center + 8 neighbors
    const centerHash = geohash.encode(userLoc.lat, userLoc.lng, 6);
    const neighbors = geohash.neighbors(centerHash);
    const searchBlocks = [centerHash, ...neighbors];

    searchBlocks.forEach(async (block) => {
      const qNearby = query(
        collection(db, "users"), 
        where("searchHash", "==", block), 
        limit(20)
      );
      
      const usersSnap = await getDocs(qNearby);
      usersSnap.docs.forEach(uDoc => {
        const uData = uDoc.data();
        if (uDoc.id !== uid && !uData.isIncognito) {
          const peerCoords = uData.lastCoords || uData.coords;
          const blockedList = uData.blockedUsers || [];
          const isNotBlocked = !blockedList.includes(uid);
          
          if (isNotBlocked && peerCoords && getDistance(userLoc.lat, userLoc.lng, peerCoords.lat, peerCoords.lng) <= 0.5) {
            triggerNotification(uDoc.id, "NEARBY SIGNAL", `Buddy needed for ${vibeData.type}!`, "radar", docRef.id);
          }
        }
      });
    });

    return docRef;
  } catch (err) { 
    console.error("Vibe Creation Error:", err);
    throw new Error("Creation Denied."); 
  }
};

export const joinVibe = async (vibeId, userLoc) => {
  if (!userLoc) throw new Error("Location required.");
  const uid = auth.currentUser.uid;
  const vibeRef = doc(db, "vibes", vibeId);
  const userRef = doc(db, "users", uid);
  try {
    await runTransaction(db, async (transaction) => {
      const freshSnap = await transaction.get(vibeRef);
      if (!freshSnap.exists()) throw "Vibe no longer exists.";
      const data = freshSnap.data();
      if (data.participants?.includes(uid)) return true; 
      if (getDistance(userLoc.lat, userLoc.lng, data.coords.lat, data.coords.lng) > 0.5) throw "Too far away (500m limit).";
      if (data.status !== "open" || data.participantCount >= 1) throw "This vibe has already been filled.";
      if (data.creatorId === uid) throw "You cannot join your own vibe.";

      transaction.update(userRef, { lastSeen: serverTimestamp(), lastCoords: userLoc });
      transaction.update(vibeRef, { 
        participants: [uid], 
        participantsNames: [auth.currentUser.displayName || "Peer"], 
        participantCount: 1,
        status: "matched" 
      });
      triggerNotification(data.creatorId, "CONNECTION MADE", "A peer has joined your vibe!", "match", vibeId);
    });
    return true;
  } catch (err) { throw err; }
};

// Replace updatePresence in vibeService.js
export const updatePresence = async (vibeId, uid, isPresent) => {
  const vibeRef = doc(db, "vibes", vibeId);
  const uid_str = String(uid);

  try {
    if (isPresent) {
      await updateDoc(vibeRef, {
        activeParticipants: arrayUnion(uid_str)
      });
      
      // Handle the session start logic separately to avoid contention
      const snap = await getDoc(vibeRef);
      const data = snap.data();
      if (data && data.creatorId === uid && !data.sessionStarted) {
        await updateDoc(vibeRef, {
          sessionStarted: true,
          startedAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + (data.durationMins || 15) * 60000))
        });
      }
    } else {
      await updateDoc(vibeRef, {
        activeParticipants: arrayRemove(uid_str)
      });
    }
  } catch (err) {
    console.error("Presence update failed:", err);
  }
};

export const abortSession = async (vibeId) => {
  if (!vibeId) return;
  try { await deleteDoc(doc(db, "vibes", vibeId)); return true; } 
  catch (err) { console.error("❌ Abort failed:", err); throw err; }
};

export const leaveSession = async (vibeId, uid) => {
  if (!vibeId) return;
  const vibeRef = doc(db, "vibes", vibeId);
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(vibeRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const currentActive = data.activeParticipants || [];
      const updatedActive = currentActive.filter(id => id !== uid);
      if (updatedActive.length === 0) {
        transaction.delete(vibeRef);
      } else {
        transaction.update(vibeRef, { activeParticipants: updatedActive });
      }
    });
  } catch (err) { console.error("Leave session error:", err); }
};

export const logArrival = async (vibeId) => {
  const vibeRef = doc(db, "vibes", vibeId);
  const userRef = doc(db, "users", auth.currentUser.uid);
  const uid = auth.currentUser.uid;
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(vibeRef);
    if (!snap.exists()) return;
    const data = snap.data();
    transaction.update(userRef, { trustPoints: increment(1) });
    transaction.update(vibeRef, { [`arrived_${uid}`]: true });
    const partnerId = data.participants.find(id => id !== uid) || data.creatorId;
    if (data[`arrived_${partnerId}`]) {
      transaction.update(vibeRef, { status: "completed" });
    }
  });
};

export const reportGhosting = async (vibeId, ghostId) => {
  await updateDoc(doc(db, "users", ghostId), { trustPoints: increment(-2) });
  await updateDoc(doc(db, "vibes", vibeId), { status: "reported" });
};

export const deleteVibe = async (vibeId) => {
  if (!vibeId) return;
  try {
    const batch = writeBatch(db);
    const notifQuery = query(collection(db, "notifications"), where("vibeId", "==", vibeId));
    const notifSnap = await getDocs(notifQuery);
    notifSnap.docs.forEach((notifDoc) => batch.delete(notifDoc.ref));
    batch.delete(doc(db, "vibes", vibeId));
    await batch.commit();
  } catch (err) {
    console.error("❌ Vibe cleanup failed:", err);
    await deleteDoc(doc(db, "vibes", vibeId)).catch(() => {});
  }
};

/**
 * FEATURE: Boundary-safe SOS
 * Notifies all users in the 9-block radius for maximum safety.
 */
export const triggerSOS = async (userLoc) => {
  if (!userLoc) throw new Error("Location required");
  const uid = auth.currentUser.uid;
  const sosPayload = {
    senderId: uid, senderName: auth.currentUser.displayName || "A Peer",
    coords: userLoc, type: 'emergency', createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60000))
  };
  const docRef = await addDoc(collection(db, "safety_alerts"), sosPayload);

  const centerHash = geohash.encode(userLoc.lat, userLoc.lng, 6);
  const neighbors = geohash.neighbors(centerHash);
  const searchBlocks = [centerHash, ...neighbors];

  searchBlocks.forEach(async (block) => {
    const qNearby = query(collection(db, "users"), where("searchHash", "==", block), limit(50));
    const usersSnap = await getDocs(qNearby);
    usersSnap.docs.forEach(uDoc => {
      if (uDoc.id !== uid) triggerNotification(uDoc.id, "🚨 SOS", "A peer nearby needs help.", "safety");
    });
  });
  
  return docRef.id;
};

export const blockUser = async (targetId) => {
  if (!auth.currentUser || !targetId) return;
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { blockedUsers: arrayUnion(targetId) });
  } catch (err) { console.error("Block failed:", err); }
};