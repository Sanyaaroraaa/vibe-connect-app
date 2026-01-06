import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { messaging, db, auth } from "../config/firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export const requestForToken = async () => {
  try {
    if (!("Notification" in window)) {
      console.warn("This browser does not support desktop notification");
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn("Notification permission denied");
      return null;
    }

    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    
    if (currentToken) {
      if (auth.currentUser) {
        await syncTokenToUser(auth.currentUser.uid, currentToken);
      }
      return currentToken;
    } else {
      console.warn("No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (err) {
    console.error("An error occurred while retrieving token: ", err);
    return null;
  }
};


const syncTokenToUser = async (userId, token) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

  
    if (userSnap.exists() && userSnap.data().fcmToken === token) {
      return;
    }

    await updateDoc(userRef, { 
      fcmToken: token,
      lastTokenSync: serverTimestamp() 
    });
  } catch (error) {
    console.error("Error syncing token to Firestore:", error);
  }
};

/**
 * Listens for foreground messages.
 * @param {Function} callback 
 * @returns {Unsubscribe}
 */
export const onMessageListener = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log("[Foreground] Message received: ", payload);
    if (callback) callback(payload);
  });
};