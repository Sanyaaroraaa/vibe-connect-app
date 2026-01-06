import React, { useState, useEffect, useRef } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { Shield, Activity, MapPin, Clock, CheckCircle, XCircle, AlertTriangle, UserX } from 'lucide-react';
import { auth } from "../config/firebase";
import { ChatRoom, ScratchBadge, MissionTimer } from '../components/ConnectFeatures'; 
import { toast } from 'react-toastify';
import { useActiveVibe } from '../hooks/useActiveVibe';
import { logArrival, abortSession, reportGhosting, blockUser, leaveSession } from '../services/vibeService';
import ConfirmModal from '../components/ConfirmModal'; 
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';



const ActiveMeetup = ({ item,onEnd }) => {
  const { accent } = useTheme();          
  const { user } = useAuth();              
  const currentUid = user?.uid;
  const { vibeData, loading } = useActiveVibe(item?.id);
  const [isRevealed, setIsRevealed] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState({ show: false, type: null });
  const [isExiting, setIsExiting] = useState(false); 
  
  const [cachedPartnerName, setCachedPartnerName] = useState("");
  const wasSessionSuccessful = useRef(false);

 
  const partnerId = vibeData?.participants?.find(id => id !== currentUid) || vibeData?.creatorId;
  const iArrived = vibeData?.[`arrived_${currentUid}`];
  const partnerArrived = vibeData?.[`arrived_${partnerId}`];
  
  // Calculate expiry based on the document's state
  const isExpired = vibeData?.expiresAt?.toMillis() < Date.now();

  useEffect(() => {
    if (vibeData?.status === "completed" || vibeData?.status === "reported") {
      wasSessionSuccessful.current = true;
      
      const name = currentUid === vibeData.creatorId 
        ? (vibeData.participantsNames?.[0] || "PEER") 
        : (vibeData.creatorName || "HOST");
      
      if (name !== "PEER" && name !== "HOST") {
        setCachedPartnerName(name);
      }
    }
  }, [vibeData, currentUid]);

  useEffect(() => {
    if (loading || isExiting) return; 

    if (!vibeData) { 
      if (wasSessionSuccessful.current) return; 
      toast.warn("Connection dissolved."); 
      onEnd(); 
      return; 
    }

    if (vibeData.status === "aborted") onEnd();
  }, [vibeData, loading, onEnd, isExiting]);

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '60vh' }}>
        <Spinner animation="border" style={{ color: accent }} />
        <p className="mt-3 text-white-50 fw-bold animate__animated animate__pulse animate__infinite">SECURING CHANNEL...</p>
      </div>
    );
  }

  const handleExecuteAction = async () => {
    const type = confirmConfig.type;
    setConfirmConfig({ show: false, type: null });
    try {
      if (type === 'block') { 
        if (partnerId) await blockUser(partnerId); 
        await abortSession(item.id); 
      }
      else if (type === 'abort') await abortSession(item.id);
      else if (type === 'report') { 
        await reportGhosting(item.id, partnerId); 
        toast.error("Reported."); 
      }
      onEnd();
    } catch (err) { toast.error("Action failed."); }
  };

  const handleReturnToFeed = async () => {
    setIsExiting(true); 
    try {
      await leaveSession(item.id, currentUid);
      onEnd();
    } catch (e) {
      onEnd();
    }
  };

  const isSessionClosed = wasSessionSuccessful.current || vibeData?.status === "completed" || vibeData?.status === "reported";

  if (isSessionClosed) {
    return (
      <div className="d-flex align-items-center justify-content-center animate__animated animate__fadeIn" style={{ minHeight: '70vh' }}>
        <div className="text-center p-5 mx-3" style={{ maxWidth: '450px', backgroundColor: '#0a0a0b', border: '1px solid #1d1f23', borderRadius: '32px' }}>
          <Shield size={56} color={accent} className="mb-4" />
          <h1 className="fw-black mb-1 text-white">
            {(!vibeData || vibeData.status === "completed") ? "MISSION SUCCESS" : "SESSION PURGED"}
          </h1>
          <p className="text-white-50 small mb-4">
            Identity reveal active. Peer has disconnected, but your access remains.
          </p>
          
          <div className="d-flex flex-column gap-3 mt-4">
              {isRevealed ? (
                <div className="p-4 rounded-4 mb-2 animate__animated animate__zoomIn" style={{ background: `${accent}10`, border: `1.5px dashed ${accent}` }}>
                    <div className="text-white-50 small text-uppercase mb-1">Identity Revealed</div>
                    <span className="fw-black fs-3" style={{ color: accent }}>
                        {(cachedPartnerName || "PEER").toUpperCase()}
                    </span>
                </div>
              ) : (
                (!vibeData || vibeData.status === "completed") && (
                  <Button onClick={() => setIsRevealed(true)} className="py-3 fw-bold border-0 active-click" style={{ backgroundColor: accent, color: '#000', borderRadius: '16px' }}>REVEAL IDENTITY</Button>
                )
              )}
              
              <Button onClick={handleReturnToFeed} variant="outline-secondary" className="py-3 fw-bold border-dark text-white active-click" style={{ borderRadius: '16px' }}>
                RETURN TO FEED
              </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate__animated animate__fadeIn d-flex flex-column mx-auto active-meetup-panel shadow-lg" style={{ height: '88vh', backgroundColor: '#000', border: '1px solid #1d1f23', borderRadius: '28px', overflow: 'hidden', width: '100%' }}>
      <div className="p-2 p-md-3 d-flex align-items-center justify-content-between px-3 px-md-4 meetup-header" style={{ backgroundColor: '#080808', borderBottom: '1px solid #1d1f23' }}>
        <div className="d-flex align-items-center gap-2 gap-md-3 flex-grow-1 overflow-hidden">
            <ScratchBadge code={vibeData?.secureKey || "...."} accent={accent} />
            <div className="d-flex flex-column overflow-hidden">
  <div className="d-flex align-items-center gap-1 text-white-50" style={{ fontSize: '11px' }}>
    <MapPin size={12} color={accent} />
    <span className="text-truncate fw-bold">{(vibeData?.locationName || "CAMPUS").toUpperCase()}</span>
  </div>
  <div className="d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
    <Clock size={12} color={vibeData?.sessionStarted ? accent : '#444'} />
    
    
    {!vibeData?.sessionStarted && !loading && (
      <span className="text-white-50 fw-bold me-1" style={{fontSize: '9px'}}>WAITING FOR PEER...</span>
    )}

   

<MissionTimer 
    expiresAt={vibeData?.expiresAt} 
    durationMins={vibeData?.durationMins} 
    sessionStarted={vibeData?.sessionStarted} 
    accent={accent} 
/>
                </div>
            </div>
        </div>

        <div className="d-flex gap-1 gap-md-2 align-items-center ms-2">
            <Button size="sm" onClick={() => setConfirmConfig({show: true, type: 'block'})} className="p-2 border-0 bg-transparent text-danger shadow-none"><UserX size={18} /></Button>
            {!iArrived ? (
               <Button size="sm" onClick={() => { logArrival(item.id); toast.success("+1 Trust Point!"); }} className="fw-bold px-2 px-md-3 border-0 active-click" style={{ backgroundColor: `${accent}22`, color: accent, borderRadius: '10px', fontSize: '10px' }}>ARRIVED</Button>
            ) : !partnerArrived && isExpired ? (
              <Button size="sm" onClick={() => setConfirmConfig({show: true, type: 'report'})} className="fw-bold px-2 px-md-3 border-0 active-click" style={{ backgroundColor: '#ff444422', color: '#ff4444', borderRadius: '10px', fontSize: '10px' }}>REPORT GHOST</Button>
            ) : ( 
              <div className="px-2 text-white-50 fw-bold d-flex align-items-center gap-1" style={{ fontSize: '9px' }}>
                <CheckCircle size={10} color={accent} /> PENDING
              </div> 
            )}
            <Button size="sm" onClick={() => setConfirmConfig({show: true, type: 'abort'})} className="p-2 border-0 active-click shadow-none" style={{ backgroundColor: '#ff444411', color: '#ff4444', borderRadius: '10px' }}><XCircle size={18} /></Button>
        </div>
      </div>
      <div className="flex-grow-1 overflow-hidden chat-container">
        <ChatRoom vibeId={item.id} accent={accent} />
      </div>
      <ConfirmModal 
        show={confirmConfig.show} 
        onHide={() => setConfirmConfig({show: false, type: null})} 
        onConfirm={handleExecuteAction} 
        title={confirmConfig.type === 'block' ? "Block Peer?" : confirmConfig.type === 'report' ? "Report No-Show?" : "End Session?"} 
        message="Action will terminate the node connection." 
        accent={accent} 
      />

      <style>{`
        @media (max-width: 576px) {
          .active-meetup-panel { height: 92vh !important; border-radius: 0 !important; }
        }
        .active-click:active { transform: scale(0.95); opacity: 0.8; }
      `}</style>
    </div>
  );
};

export default ActiveMeetup;