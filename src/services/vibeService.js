import { db, auth } from "../config/firebase";
import { 
  collection, addDoc, doc, updateDoc, arrayUnion, increment, 
  getDoc, Timestamp, deleteDoc, serverTimestamp, getDocs, limit,
  writeBatch, query, where, runTransaction, arrayRemove
} from "firebase/firestore";
import { getDistance } from "../utils/geoUtils";
import geohash from 'ngeohash';
import { toast } from 'react-toastify';

const runGlobalCleanup = async () => {
  try {
    const now = Timestamp.fromDate(new Date());
    const batch = writeBatch(db);
    const qNotif = query(collection(db, "notifications"), where("expiresAt", "<", now));
    const notifSnap = await getDocs(qNotif);
    notifSnap.docs.forEach(d => batch.delete(d.ref));
    const qVibes = query(collection(db, "vibes"), where("expiresAt", "<", now));
    const vibeSnap = await getDocs(qVibes);
    vibeSnap.docs.forEach(d => batch.delete(d.ref));
    if (!notifSnap.empty || !vibeSnap.empty) await batch.commit();
  } catch (err) { console.error("❌ Janitor failed:", err); }
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

    await updateDoc(userRef, { 
      lastSeen: serverTimestamp(), 
      lastCoords: userLoc 
    });

    runGlobalCleanup();
    
    const searchHash = geohash.encode(userLoc.lat, userLoc.lng, 6);
    const qNearby = query(collection(db, "users"), where("geohash", ">=", searchHash), where("geohash", "<=", searchHash + "\uf8ff"), limit(50));
    const usersSnap = await getDocs(qNearby);
    
    
    usersSnap.docs.forEach(uDoc => {
      const uData = uDoc.data();
      if (uDoc.id !== uid && !uData.isIncognito) {
        const peerCoords = uData.lastCoords || uData.coords;
        const isNotBlocked = !(uid in (uData.blockedUsers || []));
        
        if (isNotBlocked && peerCoords && getDistance(userLoc.lat, userLoc.lng, peerCoords.lat, peerCoords.lng) <= 0.5) {
         
          triggerNotification(uDoc.id, "NEARBY SIGNAL", `Buddy needed for ${vibeData.type}!`, "radar", docRef.id);
        }
      }
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



// services/vibeService.js

export const updatePresence = async (vibeId, uid, isPresent) => {
    const vibeRef = doc(db, "vibes", vibeId);
    
    await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(vibeRef);
        if (!snap.exists()) return;
        const data = snap.data();
        
        let activeList = data.activeParticipants || [];
        if (isPresent && !activeList.includes(uid)) {
            activeList.push(uid);
        } else if (!isPresent) {
            activeList = activeList.filter(id => id !== uid);
        }

        const updates = { activeParticipants: activeList };

        // NEW LOGIC: Start timer if the Creator enters the room
        const isCreator = data.creatorId === uid;
        
        if (isPresent && isCreator && !data.sessionStarted) {
            updates.sessionStarted = true;
            updates.startedAt = serverTimestamp();
            // Calculate expiry based on the intended duration
            const duration = data.durationMins || 15;
            updates.expiresAt = Timestamp.fromDate(new Date(Date.now() + duration * 60000));
        }
        
        transaction.update(vibeRef, updates);
    });
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
      // Remove current user from the active participants list
      const currentActive = data.activeParticipants || [];
      const updatedActive = currentActive.filter(id => id !== uid);
      
      if (updatedActive.length === 0) {
        // I am the last person here, kill the vibe
        transaction.delete(vibeRef);
      } else {
        // Peer is still looking at the reveal screen, just update the list
        transaction.update(vibeRef, { activeParticipants: updatedActive });
      }
    });
  } catch (err) {
    console.error("Leave session error:", err);
    // If transaction fails (e.g. doc already gone), just exit locally
  }
};

export const logArrival = async (vibeId) => {
  const vibeRef = doc(db, "vibes", vibeId);
  const userRef = doc(db, "users", auth.currentUser.uid);
  const uid = auth.currentUser.uid;
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(vibeRef);
    if (!snap.exists()) return;
    const data = snap.data();
    
    // Increment points and log arrival
    transaction.update(userRef, { trustPoints: increment(1) });
    transaction.update(vibeRef, { [`arrived_${uid}`]: true });
    
    const partnerId = data.participants.find(id => id !== uid) || data.creatorId;
    // Check if partner already arrived
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

    // 1. Find all notifications linked to this specific vibe
    const notifQuery = query(
      collection(db, "notifications"), 
      where("vibeId", "==", vibeId)
    );
    const notifSnap = await getDocs(notifQuery);

    // 2. Add notification deletions to the batch
    notifSnap.docs.forEach((notifDoc) => {
      batch.delete(notifDoc.ref);
    });

    // 3. Delete the vibe document itself
    batch.delete(doc(db, "vibes", vibeId));

    // 4. Execute all at once
    await batch.commit();
    console.log(`✅ Cleaned up Vibe ${vibeId} and ${notifSnap.size} notifications.`);
  } catch (err) {
    console.error("❌ Vibe cleanup failed:", err);
    // Fallback: Try to at least delete the vibe if the notification query failed
    await deleteDoc(doc(db, "vibes", vibeId)).catch(() => {});
  }
};

export const triggerSOS = async (userLoc) => {
  if (!userLoc) throw new Error("Location required");
  const uid = auth.currentUser.uid;
  const sosPayload = {
    senderId: uid, senderName: auth.currentUser.displayName || "A Peer",
    coords: userLoc, type: 'emergency', createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 30 * 60000))
  };
  const docRef = await addDoc(collection(db, "safety_alerts"), sosPayload);
  const searchHash = geohash.encode(userLoc.lat, userLoc.lng, 6);
  const qNearby = query(collection(db, "users"), where("geohash", ">=", searchHash), where("geohash", "<=", searchHash + "\uf8ff"), limit(100));
  const usersSnap = await getDocs(qNearby);
  usersSnap.docs.forEach(uDoc => {
    if (uDoc.id !== uid) triggerNotification(uDoc.id, "🚨 SOS", "A peer nearby needs help.", "safety");
  });
  return docRef.id;
};

export const blockUser = async (targetId) => {
  if (!auth.currentUser || !targetId) return;
  try {
    await updateDoc(doc(db, "users", auth.currentUser.uid), { blockedUsers: arrayUnion(targetId) });
  } catch (err) { console.error("Block failed:", err); }
};