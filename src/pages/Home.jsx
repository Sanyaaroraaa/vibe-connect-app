import React, { useEffect, useState, useRef, memo, useMemo } from "react";
import { Container, Row, Col, Button, Form, Modal } from "react-bootstrap";
import {
  MapPin,
  Settings as SettingsIcon,
  Zap,
  BookOpen,
  Clock,
  ChevronDown,
  ShieldCheck,
  Trash2,
  Lock,
  AlertTriangle,
  LogIn,
  Star,
  ArrowRight,
  Bell,
  Plus,
  X,
  UserX,
} from "lucide-react";
import gsap from "gsap";
import { toast, ToastContainer } from "react-toastify";
import { auth, db } from "../config/firebase";
import {
  getDoc,
  doc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { getDistance } from "../utils/geoUtils";
import VibeHeatmap from "../components/VibeHeatmap";
import OnboardingTour from "../components/OnboardingTour";

// Context & Navigation
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

// Custom Hooks & Services
import { useLocation } from "../hooks/useLocation";
import { useVibeFeed } from "../hooks/useVibeFeed";
import { createVibe, joinVibe, deleteVibe } from "../services/vibeService";

// Sub-components
import ActiveMeetup from "./ActiveMeetup";
import Settings from "../components/Settings";
import NotificationPanel from "../components/NotificationPanel";

const TrustBadge = ({ userId }) => {
  const { accent } = useTheme();
  const [score, setScore] = useState(0);
  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, "users", userId)).then((snap) => {
      if (snap.exists()) setScore(snap.data().trustPoints || 0);
    });
  }, [userId]);
  if (score < 5) return null;
  return (
    <div className="ms-2 animate__animated animate__fadeIn">
      <Star size={14} color={accent} fill={accent} />
    </div>
  );
};

const MissionTimer = memo(({ mins, sessionStarted, startedAt, vibeId }) => {
  const { accent } = useTheme();
  const [seconds, setSeconds] = useState(mins * 60);
  const isInRoom = typeof sessionStarted === "boolean";

  useEffect(() => {
    if (isInRoom && !sessionStarted) {
      setSeconds(mins * 60);
      return;
    }

    const startTime = startedAt?.seconds
      ? startedAt.seconds * 1000
      : Date.now();
    const endTime = startTime + mins * 60000;

    const timer = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000));
      setSeconds(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        if (!isInRoom && vibeId) {
          deleteDoc(doc(db, "vibes", vibeId)).catch(() => {});
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [mins, sessionStarted, startedAt, isInRoom, vibeId]);

  return (
    <span
      className="fw-bold"
      style={{
        fontSize: "0.85rem",
        color:
          seconds < 60 && (sessionStarted || !isInRoom)
            ? "#ff4444"
            : isInRoom && !sessionStarted
            ? "#444"
            : accent,
      }}
    >
      {Math.floor(seconds / 60)}m {seconds % 60}s
      {isInRoom && !sessionStarted && (
        <span className="ms-1" style={{ fontSize: "0.6rem", opacity: 0.5 }}>
          (PAUSED)
        </span>
      )}
    </span>
  );
});

const SwipeSlider = ({ onComplete, onCancel }) => {
  const { accent } = useTheme();
  const [sliderValue, setSliderValue] = useState(0);
  const isDragging = useRef(false);
  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const track = document.getElementById("swipe-track");
    const rect = track.getBoundingClientRect();
    let clientX = e.touches ? e.touches[0].clientX : e.clientX;
    let x = clientX - rect.left;
    let progress = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setSliderValue(progress);
    if (progress > 95) {
      isDragging.current = false;
      onComplete();
    }
  };
  return (
    <div className="text-center py-2 animate__animated animate__fadeIn">
      <div
        className="mb-3 d-inline-block p-2 rounded-circle"
        style={{ backgroundColor: `${accent}11` }}
      >
        <ShieldCheck size={24} color={accent} />
      </div>
      <h6
        className="fw-black text-uppercase mb-3 small"
        style={{ letterSpacing: "1px" }}
      >
        Slide to Handshake
      </h6>
      <div
        id="swipe-track"
        className="position-relative overflow-hidden mb-3"
        style={{
          height: "54px",
          background: "#000",
          border: "1px solid #2f3336",
          borderRadius: "27px",
          width: "100%",
          cursor: "pointer",
          touchAction: "none",
        }}
        onMouseMove={handleMouseMove}
        onTouchMove={handleMouseMove}
        onMouseUp={() => setSliderValue(0)}
        onTouchEnd={() => setSliderValue(0)}
      >
        <div
          className="position-absolute h-100 start-0"
          style={{ width: `${sliderValue}%`, background: accent, opacity: 0.3 }}
        />
        <div className="h-100 d-flex align-items-center justify-content-center text-white-50 small fw-bold">
          JOIN ROOM {">>>"}
        </div>
        <div
          onMouseDown={() => {
            isDragging.current = true;
          }}
          onTouchStart={() => {
            isDragging.current = true;
          }}
          className="position-absolute d-flex align-items-center justify-content-center shadow-lg"
          style={{
            left: `calc(${sliderValue}% - ${
              sliderValue > 80 ? "48px" : "2px"
            })`,
            width: "48px",
            height: "48px",
            background: accent,
            borderRadius: "50%",
            top: "2px",
            color: "#000",
          }}
        >
          <ArrowRight size={22} strokeWidth={3} />
        </div>
      </div>
      <Button
        onClick={onCancel}
        variant="link"
        className="text-white-50 small text-decoration-none p-0 fw-bold"
      >
        ABORT CONNECTION
      </Button>
    </div>
  );
};

const CreateVibeForm = memo(
  ({ onSignal, hasActiveVibe, onMobileClose, isModal }) => {
    const { accent } = useTheme();
    const [text, setText] = useState("");
    const [loc, setLoc] = useState("");
    const [mins, setMins] = useState(15);
    const [selectedCat, setSelectedCat] = useState("Walk");
    const [isTimerOpen, setIsTimerOpen] = useState(false);
    const timerOptions = [
      { label: "5 Mins", value: 5 },
      { label: "15 Mins", value: 15 },
      { label: "30 Mins", value: 30 },
      { label: "1 Hour", value: 60 },
    ];
    const handleTextChange = (e) => {
      const textarea = e.target;
      setText(textarea.value);
      textarea.style.height = "55px";
      textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
    };
    return (
      <div
        className={`p-4 ${!isModal ? "mb-4 shadow-lg" : ""}`}
        style={{
          backgroundColor: "#16181c",
          border: isModal ? "none" : "1px solid #2f3336",
          borderLeft: isModal
            ? "none"
            : `6px solid ${hasActiveVibe ? "#333" : accent}`,
          borderRadius: isModal ? "28px" : "24px",
        }}
      >
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h6 className="fw-bold m-0 text-white-50 small text-uppercase d-flex align-items-center gap-2">
            {hasActiveVibe ? (
              <>
                <Lock size={14} /> Node Busy
              </>
            ) : (
              "Start a Vibe"
            )}
          </h6>
          {isModal && (
            <div
              onClick={onMobileClose}
              className="p-2 rounded-circle bg-black active-click"
              style={{ cursor: "pointer" }}
            >
              <X size={20} className="text-white" />
            </div>
          )}
        </div>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {["Walk", "Study", "Coffee", "Gym", "Other"].map((c) => (
            <Button
              key={c}
              disabled={hasActiveVibe}
              onClick={() => setSelectedCat(c)}
              style={{
                backgroundColor: selectedCat === c ? accent : "#000",
                color: selectedCat === c ? "#000" : "#fff",
                border: "1px solid #2f3336",
                borderRadius: 12,
                fontSize: "0.75rem",
                padding: "6px 12px",
              }}
              className="fw-bold shadow-none active-click"
            >
              {c}
            </Button>
          ))}
        </div>
        <Form.Control
          disabled={hasActiveVibe}
          as="textarea"
          rows={1}
          value={text}
          onChange={handleTextChange}
          placeholder="What's the plan?"
          className="mb-2 shadow-none bg-black border-dark text-white p-3 rounded-4 custom-scrollbar"
          style={{ resize: "none", height: "55px", colorScheme: "dark" }}
        />
        <div
          className="d-flex align-items-center gap-2 mb-2 p-2"
          style={{
            backgroundColor: "#000",
            borderRadius: "12px",
            border: "1px solid #2f3336",
          }}
        >
          <MapPin size={16} color="#888" />
          <Form.Control
            disabled={hasActiveVibe}
            type="text"
            placeholder="Where?"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            className="p-0 border-0 shadow-none text-white bg-transparent custom-placeholder"
          />
        </div>
        <div className="position-relative mb-4">
          <div
            className="d-flex align-items-center gap-2 p-2"
            onClick={() => !hasActiveVibe && setIsTimerOpen(!isTimerOpen)}
            style={{
              backgroundColor: "#000",
              borderRadius: "12px",
              border: "1px solid #2f3336",
              cursor: "pointer",
            }}
          >
            <Clock size={16} style={{ color: "#888" }} />
            <span style={{ fontSize: "0.9rem", color: "#888" }}>
              Active for {timerOptions.find((o) => o.value === mins)?.label}
            </span>
            <ChevronDown size={14} className="ms-auto" />
          </div>
          {isTimerOpen && (
            <div
              className="timer-dropdown animate__animated animate__fadeIn"
              style={{
                position: "absolute",
                width: "100%",
                top: "100%",
                marginTop: "5px",
                background: "#1c1f24",
                borderRadius: "16px",
                border: "1px solid #3a3f44",
                zIndex: 9999,
                overflow: "hidden",
              }}
            >
              {timerOptions.map((o) => (
                <div
                  key={o.value}
                  className="p-3 text-white dropdown-item-custom active-click"
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setMins(o.value);
                    setIsTimerOpen(false);
                  }}
                >
                  {o.label}
                </div>
              ))}
            </div>
          )}
        </div>
        <Button
          onClick={() => {
            onSignal({ text, loc, mins, type: selectedCat });
            if (onMobileClose) onMobileClose();
            setText("");
            setLoc("");
          }}
          disabled={hasActiveVibe || !text}
          className="w-100 py-3 fw-bold border-0 shadow-none active-click"
          style={{
            backgroundColor: hasActiveVibe || !text ? "#222" : accent,
            color: "#000",
            borderRadius: "15px",
          }}
        >
          Signal Vibe
        </Button>
      </div>
    );
  }
);

const Home = () => {
  const { user, status, logout } = useAuth();
  const { accent, setAccent } = useTheme();
  const navigate = useNavigate();
  const baseCategories = [
    { name: "All" },
    { name: "Walk" },
    { name: "Study" },
    { name: "Coffee" },
    { name: "Gym" },
    { name: "Other" },
  ];
  const userLoc = useLocation();
  const [filter, setFilter] = useState("All");
  const { filteredFeed, allVibes } = useVibeFeed(userLoc, filter);

  const [activeConnection, setActiveConnection] = useState(
    () => localStorage.getItem("activeVibeId") || null
  );
  const [isMeetupActive, setIsMeetupActive] = useState(
    () => localStorage.getItem("isMeetupActive") === "true"
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMobileCreate, setShowMobileCreate] = useState(false);
  const [vibeToDelete, setVibeToDelete] = useState(null);
  const [myBlockedUsers, setMyBlockedUsers] = useState([]);
  const [myTrustPoints, setMyTrustPoints] = useState(0);
  const filterIndicatorRef = useRef(null);
  const buttonsRef = useRef([]);
  const myActiveVibe = useMemo(
    () => allVibes.find((v) => v.creatorId === auth.currentUser?.uid),
    [allVibes]
  );
  const [hasSeenTourInDb, setHasSeenTourInDb] = useState(true);
  const [showMobileRadar, setShowMobileRadar] = useState(false);

  useEffect(() => {
    if (activeConnection) {
      localStorage.setItem("activeVibeId", activeConnection);
      localStorage.setItem("isMeetupActive", "true");
    } else {
      localStorage.removeItem("activeVibeId");
      localStorage.setItem("isMeetupActive", "false");
    }
  }, [activeConnection]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const qUnread = query(
      collection(db, "notifications"),
      where("recipientId", "==", auth.currentUser.uid),
      where("status", "==", "unread")
    );

    const unsubscribe = onSnapshot(qUnread, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      doc(db, "users", auth.currentUser.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();

          setMyBlockedUsers(data.blockedUsers || []);
          setMyTrustPoints(data.trustPoints || 0);
          setHasSeenTourInDb(data.hasSeenTour || false);
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleCreateVibe = async (vibeData) => {
    if (myActiveVibe || !userLoc) return;
    try {
      await createVibe(vibeData, userLoc);
      toast.success("Vibe Signal Sent!");
    } catch (err) {
      toast.error("Failed to signal");
    }
  };

  const handleJoinVibeConfirm = async (item) => {
    if (!userLoc) {
      toast.info("Waiting for GPS...");
      return;
    }
    try {
      const success = await joinVibe(item.id, userLoc);
      if (success) {
        setTimeout(() => {
          setActiveConnection(item.id);
          setIsMeetupActive(true);
        }, 100);
      }
    } catch (err) {
      toast.error(err.message || "Join failed");
    }
  };

  const handleEndMeetup = () => {
    setIsMeetupActive(false);
    setActiveConnection(null);
  };

  const handleTerminateSignal = async () => {
    const targetId = vibeToDelete;
    if (!targetId) return;
    try {
      setVibeToDelete(null);
      await deleteVibe(targetId);
      handleEndMeetup();
      toast.success("Signal Terminated");
    } catch (err) {
      toast.error("Failed to terminate");
      setVibeToDelete(null);
    }
  };

  const activeVibeData = useMemo(() => {
    if (myActiveVibe) return myActiveVibe;

    return allVibes.find((f) => f.id === activeConnection);
  }, [allVibes, activeConnection, myActiveVibe]);

  const feedVisibleToMe = useMemo(() => {
    return filteredFeed.filter((vibe) => {
      if (vibe.creatorId === auth.currentUser?.uid) return true;
      const iBlockedThem = myBlockedUsers.includes(vibe.creatorId);
      const theyBlockedMe = vibe.blockedUsers?.includes(auth.currentUser?.uid);
      if (iBlockedThem || theyBlockedMe) return false;

      if (userLoc && vibe.coords) {
        const distance = getDistance(
          userLoc.lat,
          userLoc.lng,
          vibe.coords.lat,
          vibe.coords.lng
        );

        if (distance > 0.5) return false;
      }

      return true;
    });
  }, [filteredFeed, myBlockedUsers, userLoc]);

  useEffect(() => {
    if (!isMeetupActive) {
      const activeIdx = baseCategories.findIndex((c) => c.name === filter);
      const targetBtn = buttonsRef.current[activeIdx];
      if (targetBtn && filterIndicatorRef.current) {
        gsap.to(filterIndicatorRef.current, {
          x: targetBtn.offsetLeft,
          width: targetBtn.offsetWidth,
          duration: 0.4,
          ease: "expo.out",
        });
      }
    }
  }, [filter, isMeetupActive, allVibes]);

  const handleTourFinish = async () => {
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          hasSeenTour: true,
        });
      } catch (err) {
        console.error("Failed to save tour status:", err);
      }
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#000",
        minHeight: "100vh",
        width: "100%",
        color: "#fff",
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      <OnboardingTour
        ready={!!userLoc}
        hasSeenTourInDb={hasSeenTourInDb}
        onComplete={handleTourFinish}
      />
      <ToastContainer position="bottom-right" theme="dark" hideProgressBar />
      <style>{`
        html, body, #root { background-color: #000 !important; }
        .count-me-in-btn { background-color: transparent; color: ${accent}; border: 1px solid ${accent}44; border-radius: 14px; padding: 14px 20px; font-weight: 800; text-transform: uppercase; transition: all 0.3s ease; position: relative; overflow: hidden; z-index: 1;}
        .count-me-in-btn::before { content: ""; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: ${accent}; transition: all 0.4s ease; z-index: -1; }
        .count-me-in-btn:hover { color: #000; border-color: ${accent}; }
        .count-me-in-btn:hover::before { left: 0; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: ${accent}; animation: pulse-anim 2s infinite; }
        @keyframes pulse-anim { 0% { box-shadow: 0 0 0 0px ${accent}66; } 100% { box-shadow: 0 0 0 10px ${accent}00; } }
        .filter-btn { background: transparent; border: none; padding: 8px 20px; font-size: 0.75rem; font-weight: 700; color: #fff; position: relative; z-index: 2; transition: 0.3s; }
        .filter-btn.active { color: #000; }
        .filter-indicator { position: absolute; height: calc(100% - 8px); top: 4px; left: 0; background: ${accent}; border-radius: 50px; z-index: 1; }
        .active-click:active { transform: scale(0.95); opacity: 0.8; }
        .trust-pill { background: #16181c; border: 1px solid #2f3336; border-radius: 50px; padding: 4px 12px; }
        .fab-btn { position: fixed; bottom: 30px; right: 25px; width: 64px; height: 64px; border-radius: 50%; background: ${accent}; color: #000; border: none; display: flex; align-items: center; justify-content: center; z-index: 1000; box-shadow: 0 8px 32px ${accent}66; }
        @media (min-width: 992px) { .fab-btn { display: none; } }
        @keyframes door-blink { 0% { filter: drop-shadow(0 0 2px ${accent}); opacity: 1; } 50% { filter: drop-shadow(0 0 15px ${accent}); opacity: 0.7; } 100% { filter: drop-shadow(0 0 2px ${accent}); opacity: 1; } }
        .door-active-blink { animation: door-blink 1.5s infinite ease-in-out; }
        .dropdown-item-custom:hover { background-color: ${accent}22 !important; color: ${accent} !important; }
        @media (max-width: 991px) {
        .mobile-radar-overlay {
        position: fixed !important;
        top: 90px;
        left: 15px;
        right: 15px;
        z-index: 2000;
        animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid ${accent} !important;
        box-shadow: 0 0 40px rgba(0,0,0,0.9) !important;
  }
}

@keyframes slideDown {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
      `}</style>

      {/* NAVBAR */}
      <div
        className="p-4 d-flex justify-content-between align-items-center sticky-top"
        style={{
          backgroundColor: "#000",
          borderBottom: "1px solid #2f3336",
          zIndex: 1200,
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <Zap size={28} color={accent} strokeWidth={3} />
          <h3 className="fw-bold m-0 d-none d-sm-block">connect.</h3>
        </div>
        <div className="d-flex align-items-center gap-2 gap-md-4">
          <div className="trust-pill d-flex align-items-center gap-2">
            <Star size={14} color={accent} fill={accent} />
            <span className="fw-black small" style={{ color: accent }}>
              {myTrustPoints}
            </span>
            <span
              className="text-white-50 fw-bold d-none d-md-inline"
              style={{ fontSize: "10px" }}
            >
              PTS
            </span>
          </div>
          <div className="d-flex align-items-center gap-2 d-none d-md-flex">
            <div className="pulse-dot"></div>
            <span className="fw-bold small" style={{ color: accent }}>
              {filteredFeed.length} NEARBY
            </span>
          </div>

          {/* Notification Bell */}
          <div className="position-relative">
            <Bell
              size={22}
              className="active-click text-white-50"
              style={{ cursor: "pointer" }}
              onClick={() => setIsNotificationsOpen(true)}
            />
            {unreadCount > 0 && (
              <div
                className="position-absolute d-flex align-items-center justify-content-center animate__animated animate__zoomIn"
                style={{
                  top: "-6px",
                  right: "-6px",
                  backgroundColor: "#ff4444",
                  color: "#fff",
                  fontSize: "10px",
                  fontWeight: "900",
                  minWidth: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  border: "2px solid #000",
                  pointerEvents: "none",
                  zIndex: 10,
                }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </div>
            )}
          </div>

          <SettingsIcon
            size={22}
            className="active-click text-white-50"
            style={{ cursor: "pointer" }}
            onClick={() => setIsSettingsOpen(true)}
          />
        </div>
      </div>

      <Container className="py-4">
        <Row className="g-4">
          {!isMeetupActive && (
            <Col
              lg={4}
              className={`d-lg-block ${showMobileRadar ? "d-block" : "d-none"}`}
              style={{ position: "sticky", top: "100px", zIndex: 1100 }}
            >
              <div className="d-none d-lg-block">
                <CreateVibeForm
                  onSignal={handleCreateVibe}
                  hasActiveVibe={!!myActiveVibe}
                />
              </div>

              <div
                className={`p-0 rounded-4 mt-lg-4 overflow-hidden shadow-lg ${
                  showMobileRadar ? "mobile-radar-overlay" : ""
                }`}
                style={{
                  backgroundColor: "#111",
                  border: `1px solid ${accent}22`,
                }}
              >
                <div className="p-3 border-bottom border-dark d-flex justify-content-between align-items-center">
                  <h6 className="fw-black small text-white-50 mb-0 text-uppercase d-flex align-items-center gap-2">
                    <div
                      className="pulse-dot-mini"
                      style={{
                        backgroundColor: accent,
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                      }}
                    ></div>
                    Local Node Density
                  </h6>
                  {/* Close button that only appears on Mobile */}
                  <X
                    size={18}
                    className="d-lg-none text-white-50 active-click"
                    onClick={() => setShowMobileRadar(false)}
                    style={{ cursor: "pointer" }}
                  />
                </div>

                <VibeHeatmap
                  vibes={allVibes}
                  center={userLoc ? [userLoc.lat, userLoc.lng] : null}
                />

                <div className="p-3 d-none d-lg-block">
                  <div className="d-flex justify-content-between small text-white-50">
                    <span>Active Signals:</span>
                    <span className="fw-bold" style={{ color: accent }}>
                      {allVibes.length}
                    </span>
                  </div>
                </div>
              </div>
            </Col>
          )}

          <Col lg={isMeetupActive ? 12 : 8} xs={12}>
            {isMeetupActive ? (
              <ActiveMeetup
                item={activeVibeData || { id: activeConnection }}
                onEnd={handleEndMeetup}
                sessionStarted={activeVibeData?.sessionStarted || false}
              />
            ) : (
              <>
                {myActiveVibe && (
                  <div className="mb-4 animate__animated animate__fadeIn">
                    <h6 className="fw-bold small text-white-50 mb-3 text-uppercase d-flex align-items-center justify-content-between px-2 px-md-0">
                      <span className="d-flex align-items-center gap-2">
                        <Zap size={14} color={accent} fill={accent} /> My Active
                        Signal
                      </span>

                      <span style={{ color: accent }} className="fw-bold">
                        {myActiveVibe.participantCount}/1 PARTNERS
                      </span>
                    </h6>
                    <div
                      className="d-flex align-items-center gap-3 p-3 px-4 mx-2 mx-md-0"
                      style={{
                        backgroundColor: "#0d0d0e",
                        border: `1.5 solid ${accent}`,
                        borderRadius: "20px",
                        width: "fit-content",
                      }}
                    >
                      <div
                        className="text-white fw-bold small text-truncate"
                        style={{ maxWidth: "120px" }}
                      >
                        {myActiveVibe.text}
                      </div>
                      <MissionTimer
                        mins={myActiveVibe.mins}
                        vibeId={myActiveVibe.id}
                      />
                      <div className="d-flex gap-3 ms-3">
                        <LogIn
                          size={22}
                          className={`active-click ${
                            myActiveVibe.participantCount > 0
                              ? "door-active-blink"
                              : "opacity-25"
                          }`}
                          style={{ cursor: "pointer", color: accent }}
                          onClick={() => {
                            if (myActiveVibe.participantCount > 0) {
                              setActiveConnection(myActiveVibe.id);
                              setIsMeetupActive(true);
                            }
                          }}
                        />
                        <Trash2
                          size={20}
                          className="text-danger active-click cursor-pointer"
                          onClick={() => setVibeToDelete(myActiveVibe.id)}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* STICKY FILTER BAR */}
                <div
                  className="sticky-top py-3"
                  style={{
                    top: "85px",
                    backgroundColor: "rgba(0,0,0,0.8)",
                    backdropFilter: "blur(10px)",
                    zIndex: 1050,
                  }}
                >
                  <div
                    className="d-flex gap-1 overflow-auto no-scrollbar position-relative mx-auto"
                    style={{
                      backgroundColor: "#111",
                      borderRadius: "50px",
                      border: "1px solid #2f3336",
                      padding: "4px 10px",
                      width: "fit-content",
                      maxWidth: "100%",
                    }}
                  >
                    <div
                      ref={filterIndicatorRef}
                      className="filter-indicator"
                    />
                    {baseCategories.map((cat, i) => (
                      <button
                        key={cat.name}
                        ref={(el) => (buttonsRef.current[i] = el)}
                        onClick={() => setFilter(cat.name)}
                        className={`filter-btn ${
                          filter === cat.name ? "active" : ""
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <Row className="g-3 mt-1 px-2 px-md-0">
                  {!userLoc ? (
                    // 1. Show this while GPS is warming up to prevent 701m glitches
                    <div className="text-center p-5 text-white-50 animate__animated animate__pulse animate__infinite">
                      <MapPin size={32} color={accent} className="mb-3" />
                      <p className="fw-bold">LOCKING GPS SIGNAL...</p>
                    </div>
                  ) : feedVisibleToMe.filter(
                      (v) => v.creatorId !== auth.currentUser?.uid
                    ).length === 0 ? (
                    // 2. Show this if everyone is > 500m away
                    <div className="text-center p-5 text-white-50 animate__animated animate__fadeIn">
                      <Zap size={32} color="#333" className="mb-3" />
                      <p className="fw-bold">NO VIBES IN RADIUS (500m)</p>
                    </div>
                  ) : (
                    // 3. Show only the vibes that passed the distance filter

                    feedVisibleToMe
                      .filter((v) => v.creatorId !== auth.currentUser?.uid)
                      .map((item) => (
                        <Col
                          md={6}
                          xs={12}
                          key={item.id}
                          id={`vibe-card-${item.id}`}
                        >
                          <div
                            className="p-4 h-100 d-flex flex-column justify-content-between shadow-sm animate__animated animate__fadeIn"
                            style={{
                              backgroundColor: "#16181c",
                              border: "1px solid #2f3336",
                              borderLeft:
                                activeConnection === item.id
                                  ? `6px solid ${accent}`
                                  : `6px solid #2f3336`,
                              borderRadius: "24px",
                              minHeight: "220px",
                              transition: "border-color 0.5s ease",
                            }}
                          >
                            {activeConnection === item.id ? (
                              <SwipeSlider
                                onComplete={() => handleJoinVibeConfirm(item)}
                                onCancel={() => setActiveConnection(null)}
                              />
                            ) : (
                              <>
                                <div>
                                  <div className="d-flex justify-content-between mb-3 align-items-center">
                                    <div className="d-flex align-items-center">
                                      <div
                                        style={{
                                          color: accent,
                                          background: "#000",
                                          padding: "10px",
                                          borderRadius: "12px",
                                          border: "1px solid #2f3336",
                                        }}
                                      >
                                        {item.activityType === "Study" ||
                                        item.type === "Study" ? (
                                          <BookOpen size={20} />
                                        ) : (
                                          <Zap size={20} />
                                        )}
                                      </div>
                                      <TrustBadge userId={item.creatorId} />
                                    </div>
                                    <div className="text-end">
                                      <MissionTimer
                                        mins={item.mins}
                                        vibeId={item.id}
                                      />

                                      <div
                                        style={{
                                          fontSize: "0.65rem",
                                          color: accent,
                                        }}
                                        className="fw-bold mt-1 text-uppercase"
                                      >
                                        {Math.round(
                                          getDistance(
                                            userLoc.lat,
                                            userLoc.lng,
                                            item.coords.lat,
                                            item.coords.lng
                                          ) * 1000
                                        )}
                                        m AWAY
                                      </div>
                                    </div>
                                  </div>
                                  <h5
                                    className="fw-bold text-white mb-2"
                                    style={{ fontSize: "1.1rem" }}
                                  >
                                    {item.text}
                                  </h5>
                                  <div className="d-flex align-items-center gap-2 text-white-50 small mb-4">
                                    <MapPin size={14} color={accent} />{" "}
                                    {item.locationName || "Campus Spot"}
                                  </div>
                                </div>
                                <button
                                  onClick={() => setActiveConnection(item.id)}
                                  className="count-me-in-btn"
                                >
                                  Count me in
                                </button>
                              </>
                            )}
                          </div>
                        </Col>
                      ))
                  )}
                </Row>
              </>
            )}
          </Col>
        </Row>
      </Container>

      {!isMeetupActive && (
        <button
          className="d-lg-none active-click shadow-lg d-flex align-items-center justify-content-center"
          onClick={() => setShowMobileRadar(!showMobileRadar)}
          style={{
            position: "fixed",
            bottom: "105px",
            right: "25px",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            backgroundColor: "#000",
            border: `1px solid ${accent}44`,
            color: accent,
            zIndex: 1000,
            boxShadow: `0 8px 32px ${accent}33`,
          }}
        >
          <Zap
            size={28}
            className={showMobileRadar ? "rotate-180" : ""}
            style={{ transition: "0.3s" }}
          />
        </button>
      )}
      {!isMeetupActive && !myActiveVibe && (
        <button
          className="fab-btn active-click"
          onClick={() => setShowMobileCreate(true)}
        >
          <Plus size={32} />
        </button>
      )}
      <Modal
        show={showMobileCreate}
        onHide={() => setShowMobileCreate(false)}
        centered
        contentClassName="bg-transparent border-0"
      >
        <CreateVibeForm
          onSignal={handleCreateVibe}
          hasActiveVibe={!!myActiveVibe}
          onMobileClose={() => setShowMobileCreate(false)}
          isModal={true}
        />
      </Modal>
      <Modal
        show={!!vibeToDelete}
        onHide={() => setVibeToDelete(null)}
        centered
        contentClassName="bg-black border-dark rounded-5"
      >
        <Modal.Body className="text-center p-5">
          <AlertTriangle size={40} color="#ff4444" className="mb-3" />
          <h4 className="fw-black text-white">TERMINATE SIGNAL?</h4>
          <div className="d-grid gap-2 mt-4">
            <Button
              onClick={handleTerminateSignal}
              className="py-3 fw-bold border-0 active-click"
              style={{ backgroundColor: "#ff4444", borderRadius: "15px" }}
            >
              YES, TERMINATE
            </Button>
            <Button
              variant="link"
              onClick={() => setVibeToDelete(null)}
              className="text-white-50 text-decoration-none fw-bold mt-2"
            >
              BACK
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      <Settings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onLogout={logout}
      />
      <NotificationPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />
    </div>
  );
};

export default Home;
