import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, Timestamp } from 'firebase/firestore';
import { auth, db } from './config/firebase'; 
import { onMessageListener } from "./services/pushNotification"; 
import { getDistance } from "./utils/geoUtils";
import { useLocation } from "./hooks/useLocation"; 
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Lenis from '@studio-freight/lenis';
import {useAuth} from './context/AuthContext'


// Page Imports
import Home from './pages/Home';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel'; 
import Landing from './pages/Landing';

// UI Components
import { toast, ToastContainer } from 'react-toastify';
import { Button } from 'react-bootstrap'; 
import { AlertTriangle } from 'lucide-react'; 
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  const { user, status, loading, isAccessGranted } = useAuth();
  const { accent } = useTheme();
  const navigate = useNavigate();
  const [emergencyAlert, setEmergencyAlert] = useState(null); 
  const userLoc = useLocation(); 
  const MY_ADMIN_UID = import.meta.env.VITE_FIREBASE_UID || "PASTE_YOUR_UID_HERE";


  useEffect(() => {
    const lenis = new Lenis();
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, []);

  

  // 1. Service Worker & FCM Registration
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .catch(err => console.log("SW Register Error:", err));
    }
  }, []);


  // 2. Real-time Notification Listener (Gated by Approval)
useEffect(() => {
  if (!user || status !== 'approved') return;

  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", user.uid),
    where("status", "==", "unread")
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added") {
        const data = change.doc.data();
        const now = Date.now();
        const msgTime = data.createdAt?.toMillis ? data.createdAt.toMillis() : now;
        const isFresh = (now - msgTime) < 10000; // Only toast if within last 10 seconds

        if (isFresh) {
          toast.info(`🔔 ${data.title}: ${data.body}`, {
            position: "top-center",
            theme: "dark",
            style: { border: `1px solid ${accent}`, background: '#000' }
          });
        }
      }
    });
  });

  return () => unsubscribe();
}, [user, status, accent]);

  // 3. Global SOS Emergency Listener
  useEffect(() => {
    if (!user || !userLoc || status !== 'approved') return;

    const q = query(
      collection(db, "safety_alerts"),
      where("expiresAt", ">", Timestamp.now())
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
    });

    return () => unsubscribe();
  }, [user, userLoc, status]);

 

  if (loading) return (
    <div style={{ backgroundColor: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace',color: accent }}>
      <div className="animate__animated animate__pulse animate__infinite">
        INITIALIZING CONNECT_PROTOCOL...
      </div>
    </div>
  );

 

  return (
    <>
      <ToastContainer position="top-center" autoClose={3000} hideProgressBar theme="dark" /> 

      {emergencyAlert && (
        <SOSOverlay 
          alert={emergencyAlert} 
          onDismiss={() => setEmergencyAlert(null)} 
        />
      )}

    
        <Routes>
          <Route path="/" element={<Landing/>} />

          {/* Login: Redirects to /home if authorized */}
         <Route  path="/login" element={ isAccessGranted(MY_ADMIN_UID) ? <Navigate to="/home" /> : <Login /> } />
      
 
          {/* Protected Route: Home Dashboard */}
         <Route 
    path="/home" 
    element={<ProtectedRoute isAllowed={isAccessGranted(MY_ADMIN_UID)}><Home /></ProtectedRoute>}
  />

          {/* Admin Panel: UID Gated */}
         <Route 
    path="/admin-control" 
    element={
      <ProtectedRoute isAllowed={user?.uid === MY_ADMIN_UID} redirectTo="/home">
        <AdminPanel />
      </ProtectedRoute>
    } 
  />

  <Route path="*" element={<Navigate to="/" />} />
</Routes>
        
      
    </>
  );
};

// Safety Overlay Component
const SOSOverlay = ({ alert, onDismiss}) => {
  const { accent } = useTheme();
  return(
  <div className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" 
       style={{ zIndex: 9999, background: 'rgba(255,0,0,0.4)', backdropFilter: 'blur(15px)' }}>
    <div className="p-4 text-center bg-black border border-danger rounded-5 shadow-lg mx-3" 
           style={{ maxWidth: '400px', boxShadow: `0 0 30px ${accent}22` }}>
      <AlertTriangle size={64} color="#ff4444" className="mb-3 animate__animated animate__pulse animate__infinite" />
      <h2 className="fw-black text-white">SAFETY ALERT</h2>
      <p className="text-white mb-4">A peer needs help <strong>{alert.distance}m</strong> from your location.</p>
      
      <div className="d-grid gap-2">
       <Button 
  href={`https://www.google.com/maps?q=${alert.coords.lat},${alert.coords.lng}`}
  target="_blank"
  rel="noopener noreferrer"
  variant="danger" 
  className="py-3 fw-bold rounded-4 shadow"
>
  VIEW LOCATION
</Button>
        <Button variant="outline-light" onClick={onDismiss} className="py-2 border-0 opacity-50">
          DISMISS
        </Button>
      </div>
    </div>
  </div>
);
};

export default App;