import React, { useEffect, useRef, useState } from 'react';
import { Container, Row, Col, Button, Card, Form } from 'react-bootstrap';
import { gsap } from 'gsap';
import { Zap, ChevronLeft, Eye, EyeOff, ShieldCheck, User, UploadCloud, LogOut } from 'lucide-react';
import { auth, db } from "../config/firebase";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile,
  signOut
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { submitStudentId } from "../services/authService";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { analytics } from "../config/firebase";
import { logEvent } from "firebase/analytics";


const MY_ADMIN_UID = import.meta.env.VITE_FIREBASE_UID; 

const Login = ({ onLogin}) => {
  const { accent } = useTheme();
  const provider = new GoogleAuthProvider();
  const location = useLocation();
  const cardRef = useRef(null);
  const isInitialSignUp = location.state?.initialSignUp || false;
  const [step, setStep] = useState(location.state ? 'auth' : 'landing'); 
  const [isSignUp, setIsSignUp] = useState(isInitialSignUp);
  const [showPassword, setShowPassword] = useState(false);
  const [strength, setStrength] = useState(0);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
 

 
  useEffect(() => {
    gsap.fromTo(cardRef.current, 
      { scale: 0.98, opacity: 0, y: 15 }, 
      { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
    );
  }, [step]);

  const checkStrength = (pass) => {
    let s = 0;
    if (pass.length >= 8) s++;
    if (/[A-Z]/.test(pass)) s++;
    if (/[0-9]/.test(pass)) s++;
    if (/[^A-Za-z0-9]/.test(pass)) s++;
    setStrength(s);
  };


   
  const syncUserToFirestore = async (user, customName = null) => {
    // 1. THE ADMIN FAST-TRACK
    
    if (user && user.uid === MY_ADMIN_UID) {
      console.log("Admin Node Detected. Bypassing Gating.");
      toast.success("Welcome back, Commander", { theme: "dark" });
      
     
      setTimeout(() => {
        onLogin(); 
      }, 800);
      return; 
    }

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const finalName = customName || user.displayName || "Student";

    // 2. FIRST TIME USER: Create document and move to Verify
    if (!userSnap.exists()) {
      await setDoc(userRef, { 
        uid: user.uid, 
        email: user.email, 
        name: finalName, 
        status: "new",
        verified: false, 
        joinedAt: serverTimestamp() 
      });
      analytics.then(instance => {
    if (instance) logEvent(instance, 'sign_up', { method: 'google_or_email' }); //
  });
  setStep("verify");
  return;
      
    }
    
    // 3. EXISTING USER: Check status from Firestore
    const userData = userSnap.data();
    if (userData.status === "approved") { 
      onLogin(); 
    } else { 
      setStep("verify"); 
      if(userData.status === "pending") {
          toast.info("ID currently under review by Admin.", { theme: 'dark' });
      }
    }
  };

  const handleManualAuth = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const name = isSignUp ? e.target.fullName.value : null;

    try {
      let result;
      if (isSignUp) {
        if (password !== e.target.confirmPassword.value) throw new Error("Passwords mismatch");
        result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName: name });
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
      }
      await syncUserToFirestore(result.user, name);
    } catch (err) { 
      toast.error(err.message || "Auth failed", { theme: "dark" });
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, e.target.resetEmail.value);
      toast.success("Recovery link sent! Check your inbox.", { theme: "dark" });
      setStep('auth');
    } catch (err) {
      toast.error("Account not found.", { theme: "dark" });
    }
  };

  const handleIdUpload = async () => {
    if (!file) return toast.error("Please select your ID photo");
    setUploading(true);
    const toastId = toast.loading("AI Scanning ID Card...");

    try {
      await submitStudentId(file); 
      toast.update(toastId, { 
        render: "Upload Success! Admin will verify you soon.", 
        type: "success", isLoading: false, autoClose: 4000 
      });
     
    } catch (err) {
      toast.update(toastId, { render: err.message, type: "error", isLoading: false, autoClose: 3000 });
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = { backgroundColor: '#000', border: '2px solid #333', borderRadius: '12px', color: '#fff', padding: '12px 16px' };

  return (
    <div className="d-flex align-items-center justify-content-center vh-100" style={{ backgroundColor: '#000', color: '#fff', overflow: 'hidden' }}>
      <ToastContainer position="top-center" theme="dark" />
      <Container>
        <Row className="justify-content-center">
          <Col xs={11} sm={9} md={7} lg={6} xl={5}>
            <Card ref={cardRef} className="border-0 shadow-lg" style={{ backgroundColor: '#0a0a0b', borderRadius: '32px', border: '1px solid #222' }}>
              <Card.Body className="p-4 p-md-5">
                
                {/* LANDING STEP */}
                {step === 'landing' && (
                  <div className="text-center py-4">
                    <div className="mb-4 d-inline-block p-4 rounded-circle" style={{ background: `${accent}10`, border: `2px solid ${accent}` }}>
                      <Zap size={56} color={accent} fill={accent} />
                    </div>
                    <h1 className="fw-bold text-white mb-2" style={{ fontSize: '3.2rem', letterSpacing: '-2px' }}>connect.</h1>
                    <p className="text-white-50 mb-5 fs-5">Campus life, simplified.</p>
                    <div className="d-grid gap-3">
                      <Button onClick={() => { setIsSignUp(true); setStep('auth'); }} className="py-3 fw-bold border-0 accent-btn" style={{ backgroundColor: accent, color: '#000', borderRadius: '15px' }}>Join Campus</Button>
                      <Button onClick={() => { setIsSignUp(false); setStep('auth'); }} variant="outline-light" className="py-3 fw-bold outline-hover-btn" style={{ borderRadius: '15px' }}>Welcome Back</Button>
                    </div>
                  </div>
                )}

                {/* EMAIL/PASSWORD STEP */}
                {step === 'auth' && (
                  <div>
                    <button onClick={() => setStep('landing')} className="btn p-0 mb-4 text-white-50 border-0 d-flex align-items-center gap-2 shadow-none"><ChevronLeft size={20} /> Back</button>
                    <h3 className="fw-bold text-white mb-4 no-break">{isSignUp ? 'Create Node' : 'Authorize Session'}</h3>
                    <Form onSubmit={handleManualAuth}>
                      {isSignUp && (
                         <div className="position-relative mb-3">
                           <Form.Control name="fullName" type="text" placeholder="Full Name" style={inputStyle} className="custom-placeholder shadow-none" required />
                           <User size={18} className="position-absolute top-50 end-0 translate-middle-y me-3 text-white-50" />
                         </div>
                      )}
                      <Form.Control name="email" type="email" placeholder="Email" style={inputStyle} className="mb-3 custom-placeholder shadow-none" required />
                      
                      <div className="position-relative mb-1">
                        <Form.Control name="password" type={showPassword ? "text" : "password"} placeholder="Password" style={inputStyle} onChange={(e) => checkStrength(e.target.value)} className="shadow-none w-100 custom-placeholder" required />
                        <div className="position-absolute top-50 end-0 translate-middle-y me-3 cursor-pointer text-white-50" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </div>
                      </div>

                      {isSignUp && (
                        <>
                          <div className="d-flex gap-1 mb-3 mt-2 px-1">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="flex-grow-1" style={{ height: '4px', borderRadius: '10px', backgroundColor: strength >= i ? (strength <= 2 ? '#ff4b2b' : '#00e676') : '#222' }} />
                            ))}
                          </div>
                          <Form.Control name="confirmPassword" type="password" placeholder="Confirm Password" style={inputStyle} className="mb-4 shadow-none custom-placeholder" required />
                        </>
                      )}

                      {!isSignUp && <div className="text-end mb-4"><button type="button" onClick={() => setStep('forgot_password')} className="btn btn-link p-0 text-white-50 small text-decoration-none shadow-none">Forgot credentials?</button></div>}
                      
                      <Button type="submit" className="py-2 fw-bold border-0 mb-4 w-100 accent-btn" style={{ backgroundColor: accent, color: '#000', borderRadius: '12px' }}>{isSignUp ? 'Join Node' : 'Authorize'}</Button>
                      
                      <div className="text-center px-2">
                        <div className="d-flex align-items-center gap-3 mb-4">
                          <hr className="flex-grow-1" style={{ border: 'none', height: '1.5px', background: '#333' }} /> 
                          <span className="small fw-bold text-white-50">OR</span> 
                          <hr className="flex-grow-1" style={{ border: 'none', height: '1.5px', background: '#333' }} />
                        </div>
                        <Button 
                          onClick={async () => {
                            try {
                                const result = await signInWithPopup(auth, provider);
                                await syncUserToFirestore(result.user);
                            } catch (err) { toast.error("Social auth failed."); }
                          }} 
                          variant="outline-dark" className="rounded-circle p-0 border-0 social-btn" 
                          style={{ width: '56px', height: '56px', backgroundColor: '#16181c', border: '1px solid #333' }}
                        >
                          <img src="https://www.google.com/favicon.ico" width="24" alt="G" />
                        </Button>
                      </div>
                    </Form>
                  </div>
                )}

                {/* VERIFICATION STEP */}
                {step === 'verify' && (
                  <div className="text-center py-2">
                    <ShieldCheck size={48} color={accent} className="mb-3" />
                    <h4 className="fw-bold text-white mb-2">Security Gating</h4>
                    <p className="text-white-50 mb-4 small">Identity verification is required for the first login.</p>
                    <div 
                      className="mb-4 d-flex flex-column align-items-center justify-content-center border-dashed rounded-4" 
                      style={{ height: '180px', border: '2px dashed #333', cursor: uploading ? 'not-allowed' : 'pointer', background: '#000' }}
                      onClick={() => !uploading && document.getElementById('idUpload').click()}
                    >
                        {file ? <span className="text-success small fw-bold">{file.name}</span> : 
                        <><UploadCloud size={30} className="mb-2 text-white-50"/><span className="text-white-50 small">Upload Student ID Photo</span></>}
                    </div>
                    <input type="file" id="idUpload" hidden accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
                    <Button onClick={handleIdUpload} disabled={uploading} className="w-100 py-3 fw-bold border-0 accent-btn mb-3" style={{ backgroundColor: accent, color: '#000', borderRadius: '12px' }}>
                      {uploading ? "AI SCANNING..." : "VERIFY IDENTITY"}
                    </Button>
                    <button className="btn btn-link text-white-50 small text-decoration-none d-flex align-items-center justify-content-center mx-auto" onClick={() => signOut(auth).then(() => setStep('landing'))}>
                        <LogOut size={14} className="me-2"/> Switch Node Account
                    </button>
                  </div>
                )}

                {/* FORGOT PASSWORD STEP */}
                {step === 'forgot_password' && (
                  <div className="py-2 text-center">
                    <button onClick={() => setStep('auth')} className="btn p-0 mb-3 text-white-50 border-0 d-block shadow-none"><ChevronLeft size={20} /> Back</button>
                    <h4 className="fw-bold text-white mb-4">Node Recovery</h4>
                    <Form onSubmit={handleForgotPassword}>
                      <Form.Control name="resetEmail" type="email" placeholder="Enter Registered Email" style={inputStyle} className="mb-4 shadow-none text-center" required />
                      <Button type="submit" className="w-100 py-2 fw-bold border-0 accent-btn" style={{ backgroundColor: accent, color: '#000', borderRadius: '12px' }}>Send Link</Button>
                    </Form>
                  </div>
                )}

              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <style>{`
        .custom-placeholder::placeholder { color: #888 !important; }
        input:focus { border-color: ${accent} !important; outline: none; box-shadow: none !important; }
        input { color: white !important; }
        .no-break { white-space: nowrap !important; }
        .accent-btn:hover { filter: brightness(1.1); transform: translateY(-2px); box-shadow: 0 4px 15px ${accent}44; transition: 0.3s; }
        .outline-hover-btn:hover { background-color: #fff !important; color: #000 !important; transform: translateY(-2px); transition: 0.3s; }
        .social-btn:hover { border-color: #555 !important; background-color: #222 !important; transform: scale(1.1); transition: 0.3s; }
        .cursor-pointer { cursor: pointer; }
      `}</style>
    </div>
  );
};

export default Login;