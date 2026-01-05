import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { X, Bell, Zap, MapPin, ShieldAlert, Trash2, Radio } from 'lucide-react';
import gsap from 'gsap';
import { db, auth } from "../config/firebase"; 
import { 
  collection, query, onSnapshot, orderBy, 
  where, doc, writeBatch 
} from "firebase/firestore";

const NotificationPanel = ({ isOpen, onClose, accent }) => {
  const [notifications, setNotifications] = useState([]);
  const panelRef = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!auth.currentUser || !isOpen) return;

    const qAll = query(
      collection(db, "notifications"),
      where("recipientId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(qAll, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const item = doc.data();
        return {
          id: doc.id,
          ...item,
          displayTime: item.createdAt?.toDate ? 
            item.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            'Just now'
        };
      });
      setNotifications(data);
    });

    const markAsRead = async () => {
      const unreadIds = notifications.filter(n => n.status === 'unread').map(n => n.id);
      if (unreadIds.length === 0) return;
      const batch = writeBatch(db);
      unreadIds.forEach(id => {
        batch.update(doc(db, "notifications", id), { status: 'read' });
      });
      await batch.commit();
    };

    const timer = setTimeout(markAsRead, 3000); 

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, [isOpen, notifications.length]);

  useEffect(() => {
    if (isOpen) {
      gsap.to(overlayRef.current, { opacity: 1, visibility: 'visible', duration: 0.3 });
      gsap.to(panelRef.current, { x: 0, duration: 0.5, ease: 'power3.out' });
    } else {
      gsap.to(overlayRef.current, { opacity: 0, visibility: 'hidden', duration: 0.3 });
      gsap.to(panelRef.current, { x: '100%', duration: 0.5, ease: 'power3.in' });
    }
  }, [isOpen]);

  const handlePurgeAll = async () => {
    if (!auth.currentUser || notifications.length === 0) return;
    const batch = writeBatch(db);
    notifications.forEach(n => batch.delete(doc(db, "notifications", n.id)));
    await batch.commit();
  };

  const getIcon = (type) => {
    switch (type) {
      case 'match': return <Zap size={16} />;
      case 'radar': return <Radio size={16} />; 
      case 'safety': return <ShieldAlert size={16} />;
      case 'location': return <MapPin size={16} />;
      default: return <Bell size={16} />;
    }
  };

  return (
    <>
      <div ref={overlayRef} onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 2000, visibility: 'hidden', opacity: 0 }} />
      <div ref={panelRef} style={{ position: 'fixed', top: 0, right: 0, width: 'min(400px, 100%)', height: '100vh', backgroundColor: '#0a0a0b', borderLeft: '1px solid #1d1f23', zIndex: 2001, transform: 'translateX(100%)', padding: '2rem', display: 'flex', flexDirection: 'column' }}>
        <div className="d-flex justify-content-between align-items-center mb-5">
          <div className="d-flex align-items-center gap-2">
            <Bell size={20} color={accent} />
            <h4 className="fw-black m-0 text-white">ALERTS</h4>
          </div>
          <X size={24} color="#555" onClick={onClose} style={{ cursor: 'pointer' }} className="active-click" />
        </div>
        <div className="flex-grow-1 overflow-auto no-scrollbar d-flex flex-column gap-3">
          {notifications.length === 0 ? <div className="text-center mt-5 text-white-50 small">No current alerts.</div> : 
            notifications.map((n) => (
              <div key={n.id} style={{ backgroundColor: '#111', borderRadius: '16px', border: n.status === 'unread' ? `1px solid ${accent}44` : '1px solid #1d1f23', padding: '1.2rem' }}>
                <div className="d-flex justify-content-between mb-2">
                  <div className="d-flex align-items-center gap-2" style={{ color: n.status === 'unread' ? accent : '#555' }}>
                    {getIcon(n.type)}
                    <span className="fw-bold small text-uppercase">{n.title}</span>
                  </div>
                  <span className="text-white-50" style={{ fontSize: '10px' }}>{n.displayTime}</span>
                </div>
                <p className={`${n.status === 'unread' ? 'text-white' : 'text-white-50'} small m-0`}>{n.body}</p>
              </div>
            ))
          }
        </div>
        <Button variant="outline-danger" onClick={handlePurgeAll} disabled={notifications.length === 0} className="w-100 py-3 mt-4 border-dark fw-bold d-flex align-items-center justify-content-center gap-2 active-click" style={{ borderRadius: '12px' }}>
          <Trash2 size={18} /> PURGE ALL
        </Button>
      </div>
    </>
  );
};

export default NotificationPanel;