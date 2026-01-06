import React, { useEffect, useRef, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { X, UserX, Bell, LogOut, Palette, ChevronRight, ArrowLeft, Shield } from 'lucide-react';
import gsap from 'gsap';
import { auth, db } from "../config/firebase";
import { signOut } from "firebase/auth";
import { doc, updateDoc, onSnapshot, arrayRemove } from "firebase/firestore";
import { toast } from 'react-toastify';
import ConfirmModal from '../components/ConfirmModal'; 
import { useTheme } from '../context/ThemeContext';

const colors = ['#C1FF72', '#FFD93D', '#6CB4EE', '#FF6B6B', '#FF8AAE', '#FFB347', '#B39DDB'];

const Settings = ({ isOpen, onClose, onLogout }) => {
  const { accent, setAccent } = useTheme();
  const panelRef = useRef(null);
  const overlayRef = useRef(null);
  const blockedPanelRef = useRef(null);

  const [showBlocked, setShowBlocked] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]); 
  const [pushEnabled, setPushEnabled] = useState(true);
  const [incognito, setIncognito] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIncognito(data.isIncognito || false);
        setPushEnabled(data.pushEnabled !== false); 
        setBlockedUsers(data.blockedUsers || []);
      }
    });
    return () => unsub();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      
      if (panelRef.current) panelRef.current.scrollTop = 0;
      gsap.to(overlayRef.current, { opacity: 1, visibility: 'visible', duration: 0.3 });
      gsap.to(panelRef.current, { x: 0, duration: 0.5, ease: 'power3.out' });
    } else {
      document.body.style.overflow = 'unset';
      gsap.to(overlayRef.current, { opacity: 0, visibility: 'hidden', duration: 0.3 });
      gsap.to(panelRef.current, { x: '101%', duration: 0.5, ease: 'power3.in' });
      setTimeout(() => setShowBlocked(false), 500);
    }
  }, [isOpen]);

  useEffect(() => {
    gsap.to(blockedPanelRef.current, { x: showBlocked ? 0 : '100%', duration: 0.4, ease: 'power2.out' });
  }, [showBlocked]);

  const toggleIncognito = async () => {
    const newState = !incognito;
    setIncognito(newState);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), { isIncognito: newState });
      toast.info(newState ? "Ghost Mode Active" : "Radar Visible", { theme: 'dark' });
    } catch (e) { 
      toast.error("Update failed");
      setIncognito(!newState); 
    }
  };

  const togglePush = async () => {
    const newState = !pushEnabled;
    setPushEnabled(newState);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), { pushEnabled: newState });
      toast.success(newState ? "Notifications ON" : "Notifications OFF");
    } catch (e) { setPushEnabled(!newState); }
  };

  const handleUnblock = async (userName) => {
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), { blockedUsers: arrayRemove(userName) });
      toast.success(`Unblocked ${userName}`);
    } catch (e) { toast.error("Unblock failed"); }
  };

  const handleLogoutAction = async () => {
    setShowLogoutModal(false);
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      localStorage.clear();
      if (onLogout) onLogout();
      onClose();
    } catch (error) {
      toast.error("Disconnection failed");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const SectionHeader = ({ icon: Icon, title }) => (
    <div className="d-flex align-items-center gap-2 mb-3 mt-4">
      <Icon size={16} style={{ color: accent }} />
      <h6 className="fw-black m-0 text-white-50 small text-uppercase" style={{ letterSpacing: '1px' }}>{title}</h6>
    </div>
  );

  return (
    <>
     
      <div ref={overlayRef} onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)', zIndex: 2000, visibility: 'hidden', opacity: 0 }} />

      
      <div ref={panelRef} style={{ position: 'fixed', top: 0, right: 0, width: 'min(400px, 90%)', height: '100dvh', backgroundColor: '#0a0a0b', borderLeft: '1px solid #1d1f23', zIndex: 2001, transform: 'translateX(101%)', padding: '1.5rem', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
        
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="d-flex align-items-center gap-2">
             <Shield size={20} color={accent} />
             <h4 className="fw-black m-0 text-white">SETTINGS</h4>
          </div>
          <div onClick={onClose} className="p-2 rounded-circle active-click" style={{ cursor: 'pointer', backgroundColor: '#16181c' }}><X size={20} color="#fff" /></div>
        </div>

        <div className="flex-grow-1 px-1">
          <SectionHeader icon={Palette} title="Interface" />
          <div className="d-flex flex-wrap gap-2 p-3 rounded-4 mb-2" style={{ backgroundColor: '#111', border: '1px solid #1d1f23' }}>
            {colors.map((color) => (
              <div key={color} onClick={() => setAccent(color)} style={{ width: '34px', height: '34px', backgroundColor: color, borderRadius: '50%', cursor: 'pointer', border: accent === color ? '3px solid #fff' : '2px solid transparent', transition: '0.2s', transform: accent === color ? 'scale(1.1)' : 'scale(1)' }} />
            ))}
          </div>

          <SectionHeader icon={Bell} title="System" />
          <div className="d-flex flex-column gap-2">
            <div className="d-flex justify-content-between align-items-center p-3 rounded-4" style={{ backgroundColor: '#111' }}>
              <span className="small text-white fw-bold">Push Notifications</span>
              <Form.Check type="switch" checked={pushEnabled} onChange={togglePush} className="custom-switch" />
            </div>
            <div className="d-flex justify-content-between align-items-center p-3 rounded-4" style={{ backgroundColor: '#111' }}>
              <span className="small text-white fw-bold">Incognito Mode</span>
              <Form.Check type="switch" checked={incognito} onChange={toggleIncognito} />
            </div>
          </div>

          <SectionHeader icon={UserX} title="Privacy" />
          <div className="d-flex justify-content-between align-items-center p-3 rounded-4 active-click" style={{ backgroundColor: '#111', cursor: 'pointer' }} onClick={() => setShowBlocked(true)}>
            <span className="small text-white fw-bold">Blocked Users</span>
            <div className="d-flex align-items-center gap-2"><span className="badge bg-dark text-white-50">{blockedUsers.length}</span><ChevronRight size={16} color="#444" /></div>
          </div>
        </div>

        <div className="mt-auto pt-4 pb-2">
          <Button variant="outline-danger" disabled={isLoggingOut} className="w-100 py-3 border-dark fw-bold d-flex align-items-center justify-content-center gap-2 mb-3" style={{ borderRadius: '16px' }} onClick={() => setShowLogoutModal(true)}>
            <LogOut size={18} /> {isLoggingOut ? "EXITING..." : "LOGOUT SESSION"}
          </Button>
          <p className="text-center text-white-50 m-0" style={{ fontSize: '9px', letterSpacing: '2px' }}>v1.0.4 // SECURE_NODE</p>
        </div>

        {/* Sub-panel for Blocked Users */}
        <div ref={blockedPanelRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#0a0a0b', zIndex: 110, padding: '1.5rem', transform: 'translateX(100%)', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
          <div className="d-flex align-items-center gap-3 mb-4" onClick={() => setShowBlocked(false)} style={{ cursor: 'pointer' }}>
            <ArrowLeft size={20} color={accent} />
            <h4 className="fw-black m-0 text-white">RESTRICTED</h4>
          </div>
          <div className="overflow-auto no-scrollbar">
            {blockedUsers.length > 0 ? (
              blockedUsers.map(user => (
                <div key={user} className="d-flex justify-content-between align-items-center p-3 mb-2 rounded-4" style={{ border: '1px solid #1d1f23', backgroundColor: '#050505' }}>
                  <span className="text-white small fw-bold text-truncate pe-2">{user}</span>
                  <Button size="sm" variant="dark" className="text-danger border-0 fw-bold flex-shrink-0" style={{ fontSize: '10px' }} onClick={() => handleUnblock(user)}>UNBLOCK</Button>
                </div>
              ))
            ) : (
              <p className="text-center text-white-50 mt-5 small">No restricted users found.</p>
            )}
          </div>
        </div>
      </div>

      
      <ConfirmModal 
        show={showLogoutModal}
        onHide={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutAction}
        title="Disconnect Session?"
        message="You will be signed out of the campus node. Data stream will be severed."
        confirmText="LOGOUT"
        accent={accent}
        isDanger={true}
      />

      <style>{`
        .active-click:active { transform: scale(0.98); opacity: 0.8; } 
        .custom-switch .form-check-input:checked { background-color: ${accent}; border-color: ${accent}; }
        .form-check-input { cursor: pointer; background-color: #333; border-color: #444; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        
        /* Ensure modal sits on top of settings panel */
        .modal { z-index: 4000 !important; }
        .modal-backdrop { z-index: 3999 !important; }
      `}</style>
    </>
  );
};

export default Settings;