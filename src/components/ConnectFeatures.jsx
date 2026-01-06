import React, { useEffect, useState, useRef, memo } from 'react';
import { Button, Form } from 'react-bootstrap';
import { Camera, EyeOff, ChevronRight, X, RefreshCw, MapPin, Check, CheckCheck } from 'lucide-react';
import { db, auth } from "../config/firebase";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import { toast } from 'react-toastify';
import { updatePresence } from '../services/vibeService';

export const SOSManager = ({ active, onTrigger }) => {
    useEffect(() => {
      let lastX, lastY, lastZ;
      const threshold = 25;
      const handleShake = (e) => {
        let acc = e.accelerationIncludingGravity;
        if (!acc || !lastX) { lastX = acc?.x; lastY = acc?.y; lastZ = acc?.z; return; }
        let delta = Math.abs(lastX - acc.x) + Math.abs(lastY - acc.y) + Math.abs(lastZ - acc.z);
        if (delta > threshold && active) onTrigger();
        lastX = acc.x; lastY = acc.y; lastZ = acc.z;
      };
      window.addEventListener('devicemotion', handleShake);
      return () => window.removeEventListener('devicemotion', handleShake);
    }, [active, onTrigger]);
    return null;
};


// Inside components/ConnectFeatures.js

// components/ConnectFeatures.js

export const MissionTimer = memo(({ expiresAt, durationMins, sessionStarted, accent }) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    // If the session hasn't started yet (Creator hasn't entered), show static time
    if (!sessionStarted) {
      setTimeLeft(`${durationMins || 15}:00`);
      return;
    }

    // If session started but Timestamp is still null (waiting for server)
    if (!expiresAt) {
      setTimeLeft("LOADING...");
      return;
    }

    const calculateTime = () => {
      // Use seconds * 1000 for the most reliable real-time calculation
      const targetMillis = expiresAt?.seconds 
        ? expiresAt.seconds * 1000 
        : (expiresAt?.toMillis ? expiresAt.toMillis() : Date.now());
        
      const diff = targetMillis - Date.now();

      if (diff <= 0) {
        setTimeLeft("00:00");
        return;
      }

      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
    
    // Watch the actual seconds property to trigger the effect immediately on sync
  }, [expiresAt?.seconds, sessionStarted, durationMins]);

  return (
    <span className="fw-bold" style={{ color: sessionStarted ? accent : '#444' }}>
      {timeLeft}
      {!sessionStarted && <span className="ms-1" style={{fontSize: '0.6rem', opacity: 0.5}}>(PAUSED)</span>}
    </span>
  );
});
export const ScratchBadge = ({ code, accent }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#333639'; ctx.fillRect(0, 0, 110, 40);
      const scratch = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      };
      const handleMove = (e) => { if (e.buttons === 1 || e.touches) scratch(e); };
      canvas.addEventListener('mousemove', handleMove);
      canvas.addEventListener('touchmove', handleMove, { passive: false });
      return () => { canvas.removeEventListener('mousemove', handleMove); canvas.removeEventListener('touchmove', handleMove); };
    }, []); 
    return (
      <div className="position-relative overflow-hidden" style={{ width: '110px', height: '40px', borderRadius: '8px', border: `1px solid ${accent}44`, background: '#000', flexShrink: 0 }}>
        <div className="position-absolute w-100 h-100 d-flex align-items-center justify-content-center bg-black">
           <span className="fw-black" style={{ letterSpacing: '2px', color: accent, fontSize: '0.9rem' }}>{code}</span>
        </div>
        <canvas ref={canvasRef} width={110} height={40} style={{ cursor: 'crosshair', position: 'relative', zIndex: 2, touchAction: 'none' }} />
      </div>
    );
};

export const ChatRoom = ({ vibeId, accent }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [burningId, setBurningId] = useState(null);
  const [showCam, setShowCam] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false); 
  const [viewedIds, setViewedIds] = useState(new Set());
  const [facingMode, setFacingMode] = useState('user');
  const videoRef = useRef(null);
  const chatEndRef = useRef(null);
  const BURN_TIME = 5000;

  useEffect(() => {
    if (!vibeId || !auth.currentUser) return;
    updatePresence(vibeId, auth.currentUser.uid, true);
    return () => { updatePresence(vibeId, auth.currentUser.uid, false); };
  }, [vibeId]);

  useEffect(() => {
    if (!vibeId) return;
    return onSnapshot(doc(db, "vibes", vibeId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const uid = auth.currentUser.uid;
        setMessages(data.messages || []);
        const otherUid = Object.keys(data.typing || {}).find(id => id !== uid);
        setIsOtherTyping(data.typing?.[otherUid] || false);
      }
    });
  }, [vibeId]);

  
useEffect(() => {
  const markAsRead = async () => {
    if (!vibeId || messages.length === 0) return;

    const uid = auth.currentUser.uid;
    let needsUpdate = false;
    
    
    const updatedMessages = messages.map(msg => {
    
      if (msg.senderId !== uid && !msg.seenBy?.includes(uid)) {
        needsUpdate = true;
        return {
          ...msg,
          seenBy: [...(msg.seenBy || []), uid]
        };
      }
      return msg;
    });

    if (needsUpdate) {
      try {
        await updateDoc(doc(db, "vibes", vibeId), {
          messages: updatedMessages
        });
      } catch (err) {
        console.error("Failed to update read receipts", err);
      }
    }
  };

  markAsRead();
}, [messages, vibeId]); 

  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => scrollToBottom(), [messages, isOtherTyping]);

  const sendMsg = async (e, isBurn = false, imgData = null, mapUrl = null) => {
    if (e) e.preventDefault();
    if (!input.trim() && !isBurn && !mapUrl) return;
    const msg = {
      id: "m_" + Date.now(),
      senderId: auth.currentUser.uid,
      text: mapUrl ? `📍 Shared Location` : (isBurn ? "📸 PHOTO" : input),
      image: imgData,
      mapUrl: mapUrl || null,
      isBurn,
      seenBy: [auth.currentUser.uid],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    await updateDoc(doc(db, "vibes", vibeId), { messages: arrayUnion(msg) });
    setInput("");
  };

 
  const sendLocation = () => {
    if (!navigator.geolocation) return toast.error("GPS Disabled");
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const url = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      await sendMsg(null, false, null, url);
    }, () => toast.error("Location denied"));
  };

  const openCam = async () => {
    setShowCam(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { setShowCam(false); }
  };

  const stopCam = () => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    setShowCam(false);
    setIsCapturing(false);
  };

  const capturePhoto = async () => {
    if (isCapturing) return;
    setIsCapturing(true); 
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(videoRef.current, 0, 0);
      const imgData = canvas.toDataURL('image/jpeg', 0.6);
      
      await sendMsg(null, true, imgData);
      setTimeout(() => stopCam(), 800);
    } catch (err) {
      setIsCapturing(false);
      toast.error("Capture failed");
    }
  };

  return (
    <div className="d-flex flex-column h-100 bg-black position-relative">
      <div className="flex-grow-1 p-3 overflow-auto no-scrollbar d-flex flex-column gap-3">
        {messages.map((m) => {
          const isMe = m.senderId === auth.currentUser.uid;
          const isExpired = viewedIds.has(m.id);
          return (
            <div key={m.id} className={`d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'}`}>
              <div className="d-flex align-items-center gap-1 mb-1" style={{ fontSize: '10px', color: '#666' }}>
                  <span>{isMe ? "YOU" : "PEER"} // {m.time}</span>
                  {isMe && (m.seenBy?.length > 1 ? <CheckCheck size={12} color={accent} /> : <Check size={12} />)}
              </div>
              {m.mapUrl ? (
                <Button href={m.mapUrl} target="_blank" className="p-2 px-3 border-0 d-flex align-items-center gap-2 active-click" style={{ background: `${accent}22`, color: accent, borderRadius: '12px' }}>
                    <MapPin size={16} /> <span className="fw-bold small">VIEW LOCATION</span>
                </Button>
              ) : m.isBurn ? (
                <Button disabled={isExpired || isMe} onClick={() => { setBurningId(m.id); setTimeout(() => { setBurningId(null); setViewedIds(v => new Set(v).add(m.id)); }, BURN_TIME); }} className="p-3 border-0 d-flex align-items-center gap-2 active-click burn-btn" style={{ background: isMe ? `${accent}11` : (isExpired ? '#111' : `${accent}22`), borderRadius: '12px' }}>
                    <EyeOff size={16} color={isExpired ? '#444' : accent} />
                    <span className="fw-bold small">{isMe ? "BURNING PHOTO" : (isExpired ? "EXPIRED" : "VIEW PHOTO")}</span>
                </Button>
              ) : (
                <div className="p-2 px-3 text-white" style={{ backgroundColor: isMe ? `${accent}15` : '#111', borderLeft: !isMe ? `2px solid ${accent}` : 'none', borderRight: isMe ? `2px solid ${accent}` : 'none', borderRadius: '12px', fontSize: '0.9rem' }}>{m.text}</div>
              )}
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      
      <Form onSubmit={sendMsg} className="p-2 p-md-3 bg-black border-top border-dark d-flex gap-2">
        <Button onClick={openCam} variant="dark" className="rounded-circle chat-btn"><Camera size={18} color={accent}/></Button>
        <Button onClick={sendLocation} variant="dark" className="rounded-circle chat-btn"><MapPin size={18} color={accent}/></Button>
        <Form.Control value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message..." className="bg-black border-0 text-white shadow-none" />
        <Button type="submit" style={{ background: accent, border: 'none', color: '#000', borderRadius: '10px' }}><ChevronRight /></Button>
      </Form>

      
      {burningId && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center" style={{ zIndex: 2000, background: '#000' }}>
          <div className="position-absolute top-0 end-0 m-4" style={{ transform: 'rotate(-90deg)' }}>
            <svg width="40" height="40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
              <circle cx="20" cy="20" r="18" fill="none" stroke={accent} strokeWidth="4" strokeDasharray="113" strokeDashoffset="113" className="snap-view-loader" />
            </svg>
          </div>
          <img src={messages.find(m => m.id === burningId)?.image} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="burn" />
        </div>
      )}

      {/* CAMERA UI WITH SNAPCHAT LOADER */}
      {showCam && (
        <div className="position-absolute top-0 start-0 w-100 h-100 bg-black" style={{ zIndex: 3000 }}>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
          <div className="position-absolute bottom-0 w-100 p-5 d-flex justify-content-center align-items-center gap-5">
             <div onClick={stopCam} className="p-3 rounded-circle active-click" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}><X color="white" size={24}/></div>
             
             <div className="position-relative d-flex align-items-center justify-content-center" style={{ width: '85px', height: '85px' }}>
                {isCapturing && (
                  <svg width="85" height="85" className="position-absolute" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="42.5" cy="42.5" r="38" fill="none" stroke={accent} strokeWidth="6" strokeDasharray="238" strokeDashoffset="238" className="snap-capture-loader" />
                  </svg>
                )}
                <div onClick={capturePhoto} className={`camera-trigger active-click ${isCapturing ? 'processing' : ''}`} style={{ '--accent': accent }} />
             </div>

             <div onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} className="p-3 rounded-circle active-click" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}><RefreshCw color="white" size={24}/></div>
          </div>
        </div>
      )}

      <style>{`
        .snap-capture-loader { animation: snapFill 800ms ease-in-out forwards; }
        @keyframes snapFill { from { stroke-dashoffset: 238; } to { stroke-dashoffset: 0; } }
        .snap-view-loader { animation: snapViewRun ${BURN_TIME}ms linear forwards; }
        @keyframes snapViewRun { from { stroke-dashoffset: 113; } to { stroke-dashoffset: 0; } }
        .camera-trigger { width: 70px; height: 70px; border-radius: 50%; border: 6px solid #fff; background: transparent; position: relative; cursor: pointer; transition: 0.2s; }
        .camera-trigger.processing { transform: scale(0.8); border-color: rgba(255,255,255,0.5); }
        .camera-trigger:after { content: ''; position: absolute; top: 4px; left: 4px; right: 4px; bottom: 4px; border-radius: 50%; background: #fff; opacity: 0.2; }
        .chat-btn { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; }
        .active-click:active { transform: scale(0.95); opacity: 0.8; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};