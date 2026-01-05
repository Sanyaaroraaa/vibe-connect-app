import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, Timestamp } from 'firebase/firestore';
import { auth, db } from './config/firebase'; 
import { onMessageListener } from "./services/pushNotification"; 
import { getDistance } from "./utils/geoUtils";
import { useLocation } from "./hooks/useLocation"; 
import Home from './pages/Home';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel'; 
import { toast, ToastContainer } from 'react-toastify';
import { Button } from 'react-bootstrap'; 
import { AlertTriangle } from 'lucide-react'; 

const App = () => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('new'); 
  const [loading, setLoading] = useState(true);
  const [accent, setAccent] = useState('#C1FF72');
  const [emergencyAlert, setEmergencyAlert] = useState(null); 

  const userLoc = useLocation(); 
  const MY_ADMIN_UID = import.meta.env.VITE_FIREBASE_UID || "PASTE_YOUR_UID_HERE";

  // 1. Service Worker Registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .catch(err => console.log("SW Register Error:", err));
    }
  }, []);

  // 2. Real-time Notification Listener (Gated by Approval Status)
  useEffect(() => {
    // 🔥 FIX: Prevent listener if not approved to avoid Permission Denied error
    if (!user || status !== 'approved') return;

    const q = query(
      collection(db, "notifications"),
      where("recipientId", "==", user.uid),
      where("status", "==", "unread")
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            toast.info(`🔔 ${data.title}: ${data.body}`, {
              position: "top-center",
              theme: "dark",
              icon: "🚀",
              style: { border: `1px solid ${accent}`, background: '#000' }
            });
          }
        });
      },
      error: (err) => console.warn("Notification listener blocked (Normal during login):", err.message)
    });

    return () => unsubscribe();
  }, [user, status, accent]); // 🔥 Added status as dependency

  // 3. Global SOS Emergency Listener (Gated by Approval Status)
  useEffect(() => {
    // 🔥 FIX: Prevent SOS listener if not approved
    if (!user || !userLoc || status !== 'approved') return;

    const q = query(
      collection(db, "safety_alerts"),
      where("expiresAt", ">", Timestamp.now())
    );

    const unsubscribe = onSnapshot(q, {
      next: (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const dist = getDistance(userLoc.lat, userLoc.lng, data.coords.lat, data.coords.lng);

            if (dist <= 0.5 && data.senderId !== user.uid) {
              setEmergencyAlert({
                id: change.doc.id,
                ...data,
                distance: Math.round(dist * 1000)
              });
              if ('vibrate' in navigator) navigator.vibrate([500, 200, 500]);
            }
          }
        });
      },
      error: (err) => console.warn("SOS listener blocked:", err.message)
    });

    return () => unsubscribe();
  }, [user, userLoc, status]); // 🔥 Added status as dependency

  // 4. FCM Push Listener
  useEffect(() => {
    const unsubscribe = onMessageListener((payload) => {
      toast.info(`${payload.notification.title}: ${payload.notification.body}`, {
        theme: "dark",
        style: { border: `1px solid ${accent}`, background: '#000' }
      });
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [accent]);

  // 5. Auth & Permission Status
  useEffect(() => {
    let unsubStatus = () => {};
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Listen to the user's specific doc to update status (Approved/Pending/New)
        unsubStatus = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setStatus(docSnap.data().status || 'new');
          }
          setLoading(false);
        }, (err) => {
          console.error("Status listener error:", err);
          setLoading(false);
        });
      } else {
        setUser(null);
        setStatus('new');
        setLoading(false);
      }
    });
    return () => { unsubAuth(); unsubStatus(); };
  }, []);

  const isAccessGranted = () => {
    if (!user) return false;
    return status === 'approved' || user.uid === MY_ADMIN_UID;
  };

  if (loading) return (
    <div style={{ backgroundColor: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, fontFamily: 'monospace' }}>
      INITIALIZING NODE...
    </div>
  );

  return (
    <>
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar theme="dark" /> 

      {emergencyAlert && (
        <SOSOverlay 
          alert={emergencyAlert} 
          accent={accent} 
          onDismiss={() => setEmergencyAlert(null)} 
        />
      )}

      <Router>
        <Routes>
          <Route path="/login" element={isAccessGranted() ? <Navigate to="/" /> : <Login accent={accent} />} />
          <Route path="/" element={isAccessGranted() ? <Home accent={accent} setAccent={setAccent} onLogout={() => auth.signOut()} /> : <Navigate to="/login" />} />
          <Route path="/admin-control" element={user?.uid === MY_ADMIN_UID ? <AdminPanel accent={accent} /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </>
  );
};

const SOSOverlay = ({ alert, onDismiss, accent }) => (
  <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
       style={{ zIndex: 9999, background: 'rgba(255,0,0,0.2)', backdropFilter: 'blur(10px)' }}>
    <div className="p-4 text-center bg-black border border-danger rounded-5 shadow-lg mx-3" style={{ maxWidth: '400px' }}>
      <AlertTriangle size={64} color="#ff4444" className="mb-3 animate__animated animate__pulse animate__infinite" />
      <h2 className="fw-black text-white">SAFETY ALERT</h2>
      <p className="text-white mb-4">A peer needs help <strong>{alert.distance}m</strong> from your location.</p>
      
      <div className="d-grid gap-2">
        <Button 
          href={`https://www.google.com/maps/search/?api=1&query=${alert.coords.lat},${alert.coords.lng}`}
          target="_blank"
          variant="danger" className="py-3 fw-bold rounded-4"
        >
          OPEN LOCATION ON MAP
        </Button>
        <Button variant="outline-light" onClick={onDismiss} className="py-2 border-0 opacity-50">
          DISMISS
        </Button>
      </div>
    </div>
  </div>
);

export default App;