import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { X, Bell, Zap, MapPin, ShieldAlert, Trash2, Radio, CheckCircle2 } from 'lucide-react';
import gsap from 'gsap';
import { db, auth } from "../config/firebase"; 
import { 
  collection, query, onSnapshot, orderBy, 
  where, doc, writeBatch, getDoc 
} from "firebase/firestore";
import { useTheme } from '../context/ThemeContext';

const NotificationPanel = ({ isOpen, onClose }) => {
  const { accent } = useTheme();
  const [notifications, setNotifications] = useState([]);
  const panelRef = useRef(null);
  const overlayRef = useRef(null);

  // --- AUDIO: THE "SHUSH" PURGE SOUND ---
  const playPurgeSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const bufferSize = audioCtx.sampleRate * 0.3;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
      noise.start();
      setTimeout(() => audioCtx.close(), 500);
    } catch (e) { console.warn("Audio blocked"); }
  };

  // 1. NOTIFICATION LISTENER + ROOM INTEGRITY CHECK


// 1. Listen to notifications (JUST listening, no deleting here)
useEffect(() => {
  if (!auth.currentUser || !isOpen) return;

  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", auth.currentUser.uid),
    orderBy("createdAt", "desc")
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const fetchedNotifs = snapshot.docs.map(d => ({ 
      id: d.id, 
      ...d.data(),
      displayTime: d.data().createdAt?.toDate ? 
        d.data().createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
        'Just now'
    }));
    setNotifications(fetchedNotifs);
  });

  return () => unsubscribe();
}, [isOpen]);

// 2. SELF-CLEARING LOGIC: Run this when the panel opens or notifications change
// EFFECT 1: Mark as READ when panel opens
useEffect(() => {
  const markAsRead = async () => {
    if (isOpen && notifications.length > 0) {
      const batch = writeBatch(db);
      let needsUpdate = false;

      notifications.forEach(n => {
        if (n.status === 'unread') {
          batch.update(doc(db, "notifications", n.id), { status: 'read' });
          needsUpdate = true;
        }
      });

      if (needsUpdate) await batch.commit();
    }
  };
  markAsRead();
}, [isOpen, notifications.length]);

// EFFECT 2: DELETE when panel closes
useEffect(() => {
 
  if (!isOpen && notifications.length > 0) {
    const purgeOnClose = async () => {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(doc(db, "notifications", n.id));
      });
      await batch.commit();
      setNotifications([]); 
      playPurgeSound(); 
    };

    purgeOnClose();
  }
}, [isOpen]); 

  // 2. ANIMATIONS + PURGE ON CLOSE / 3s TIMER
  useEffect(() => {
    if (isOpen) {
      gsap.to(overlayRef.current, { opacity: 1, visibility: 'visible', duration: 0.3 });
      gsap.to(panelRef.current, { x: 0, duration: 0.5, ease: 'power3.out' });

     

    } else {
     
      if (notifications.length > 0) handlePurgeAll();
      
      gsap.to(overlayRef.current, { opacity: 0, visibility: 'hidden', duration: 0.3 });
      gsap.to(panelRef.current, { x: '100%', duration: 0.5, ease: 'power3.in' });
    }
  }, [isOpen]);

  const handlePurgeAll = async () => {
    if (!auth.currentUser || notifications.length === 0) return;
    playPurgeSound();
    const batch = writeBatch(db);
    notifications.forEach(n => batch.delete(doc(db, "notifications", n.id)));
    await batch.commit();
    setNotifications([]);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'match': return <Zap size={16} />;
      case 'radar': return <Radio size={16} />; 
      case 'safety': return <ShieldAlert size={16} />;
      default: return <Bell size={16} />;
    }
  };

  return (
    <>
      <style>{`
        .notif-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; visibility: hidden; opacity: 0; }
        .notif-panel { position: fixed; top: 0; right: 0; width: min(400px, 100%); height: 100vh; background: #0a0a0b; border-left: 1px solid #1d1f23; z-index: 2001; transform: translateX(100%); padding: 2rem; display: flex; flex-direction: column; }
        .notif-item { background: #111; border-radius: 16px; padding: 1.2rem; margin-bottom: 1rem; border: 1px solid #1d1f23; }
        .protocol-clear { opacity: 0.2; animation: pulse 2s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.3; } }
      `}</style>

      <div ref={overlayRef} onClick={onClose} className="notif-overlay" />
      <div ref={panelRef} className="notif-panel">
        <div className="d-flex justify-content-between align-items-center mb-5">
          <div className="d-flex align-items-center gap-2">
            <Bell size={20} color={accent} />
            <h4 className="fw-black m-0 text-white">ALERTS</h4>
          </div>
          <X size={24} color="#555" onClick={onClose} style={{ cursor: 'pointer' }} />
        </div>

        <div className="flex-grow-1 overflow-auto no-scrollbar">
          {notifications.length === 0 ? (
            <div className="text-center mt-5 text-white-50 small animate__animated animate__fadeIn">
              <CheckCircle2 size={48} color={accent} className="protocol-clear mb-3" />
              <p className="fw-bold">PROTOCOL CLEAR</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className="notif-item" style={{ borderLeft: n.vibeId ? `4px solid ${accent}` : '1px solid #1d1f23' }}>
                <div className="d-flex justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2" style={{ color: accent }}>
                    {getIcon(n.type)}
                    <span className="fw-bold small text-uppercase">{n.title}</span>
                  </div>
                  <span className="text-white-50 small">{n.displayTime}</span>
                </div>
                <p className="text-white small m-0 opacity-75">{n.body}</p>
              </div>
            ))
          )}
        </div>

        <Button variant="outline-danger" onClick={handlePurgeAll} disabled={notifications.length === 0} className="w-100 py-3 mt-4 border-dark fw-bold">
          <Trash2 size={18} className="me-2" /> PURGE LOGS
        </Button>
      </div>
    </>
  );
};

export default NotificationPanel;