import { getToken, onMessage } from "firebase/messaging";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { messaging, db, auth } from "../config/firebase";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

/**
 * Requests notification permission and retrieves the FCM token.
 * Syncs the token to Firestore if the user is logged in.
 */
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

/**
 * Saves the FCM token to the user's document in Firestore.
 * Avoids unnecessary writes if the token hasn't changed.
 */
const syncTokenToUser = async (userId, token) => {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    // Only update if the token is actually different to save Firestore reads/writes
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
 * @param {Function} callback - Function to execute when a message is received.
 * @returns {Unsubscribe} - Function to stop listening.
 */
export const onMessageListener = (callback) => {
  return onMessage(messaging, (payload) => {
    console.log("[Foreground] Message received: ", payload);
    if (callback) callback(payload);
  });
};