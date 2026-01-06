import React from 'react';
import { Zap, Github, Twitter, Instagram, ArrowRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';


const Footer = () => {
  const currentYear = new Date().getFullYear();
  const {accent}=useTheme();
  const navigate = useNavigate();
  return (
    <footer className="footer-wrapper" style={{ '--accent': accent }}>
      
    
      <section className="final-cta-block text-center position-relative overflow-hidden">
      
        <div className="cta-glow-core" style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}></div>
        <div className="scanner-beam"></div>

        <div className="container position-relative" style={{ zIndex: 1 }}>
          <h2 className="massive-outline mb-4">
            READY<br/>TO<br/><span className="filled" style={{ color: accent }}>MEET?</span>
          </h2>
          
          <div className="d-flex flex-column align-items-center gap-4 mt-5">
            <p className="mission-text text-secondary">
              Stop the rot. Join the campus network and meet real peers in the real world.
            </p>
            
          
            <button className="launch-mission-btn" onClick={() => navigate('/login', { state: { initialSignUp: true } })}>
              <span>INITIALIZE VIBE</span>
              <ArrowRight size={20} />
            </button>
          </div>
          
          <div className="mt-5 coordinate-stamp">
            <span className="monospace small">COORD // 40.7128° N, 74.0060° W</span>
          </div>
        </div>
      </section>

    
      <div className="footer-nav-block">
        <div className="container">
          <div className="row py-5 border-top border-dark align-items-center g-4">
            <div className="col-lg-4 text-center text-lg-start">
              <div className="d-flex align-items-center justify-content-center justify-content-lg-start gap-2 mb-3">
                <Zap size={24} color={accent} fill={accent} className="logo-glow" />
                <h4 className="fw-black text-white m-0 letter-spacing-1">connect.</h4>
              </div>
              <div className="status-pill-terminal">
                <div className="status-dot" style={{ background: accent }}></div>
                <span className="monospace">STATUS: ENCRYPTED_CHANNEL</span>
              </div>
            </div>

            <div className="col-lg-4">
               <div className="d-flex justify-content-center gap-4">
                  <a href="#t" className="social-pill-link"><Twitter size={20} /></a>
                  <a href="#i" className="social-pill-link"><Instagram size={20} /></a>
                  <a href="#g" className="social-pill-link"><Github size={20} /></a>
               </div>
            </div>

            <div className="col-lg-4 text-center text-lg-end">
              <div className="utility-grid">
                <a href="#terms" className="monospace">TERMS</a>
                <a href="#privacy" className="monospace">PRIVACY</a>
                <a href="#safety" className="monospace">SAFETY</a>
              </div>
            </div>
          </div>

          <div className="row pb-4">
            <div className="col-12 text-center">
              <p className="text-secondary small monospace opacity-75 m-0">
                © {currentYear} CONNECT_SYS // BYPASS_DIGITAL_ROUTINE
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;