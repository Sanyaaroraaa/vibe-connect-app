import React, { useEffect, useRef, useMemo } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Zap, MapPin } from 'lucide-react'; 
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import '../App.css';

gsap.registerPlugin(ScrollTrigger);

const HeroMask = ({ videoUrl }) => {
  const navigate = useNavigate();
  const { accent } = useTheme();
  const containerRef = useRef(null);
  const maskRef = useRef(null);
  const contentRef = useRef(null);
  const bgLayerRef = useRef(null);
  const oRef = useRef(null); 

  
  const isMobile = useMemo(() => typeof window !== "undefined" && window.innerWidth <= 768, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      
      const getMaskPos = () => {
        if (!oRef.current || !containerRef.current) return { x: "25%", y: "45%" };
        const rect = oRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const x = ((rect.left + rect.width / 2) / containerRect.width) * 100;
        const y = ((rect.top + rect.height / 2) / containerRect.height) * 100;
        return { x: `${x}%`, y: `${y}%` };
      };

      const pos = getMaskPos();
      const initialRadius = isMobile ? "7vw" : "2vw";

      // 1. Initial Set
      gsap.set(maskRef.current, {
        clipPath: `circle(${initialRadius} at ${pos.x} ${pos.y})`,
        WebkitClipPath: `circle(${initialRadius} at ${pos.x} ${pos.y})`
      });

      // 2. Timeline Logic
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=200%",
          scrub: 1,
          pin: true,
          invalidateOnRefresh: true 
        }
      });

      tl.to(bgLayerRef.current, {
        opacity: 0,
        filter: "blur(15px)",
        scale: 1.05,
        duration: 0.8
      }, 0)
      .to(contentRef.current, {
        scale: 1.2,
        opacity: 0,
        filter: "blur(20px)",
        duration: 1,
        transformOrigin: "left bottom"
      }, 0)
      .to(maskRef.current, {
        clipPath: `circle(150% at ${pos.x} ${pos.y})`,
        WebkitClipPath: `circle(150% at ${pos.x} ${pos.y})`,
        duration: 2,
        ease: "none"
      }, 0);

    }, containerRef);

    return () => ctx.revert();
  }, [isMobile]); 

  return (
    <div ref={containerRef} className="hero-scroll-container">
      
      {/* 1. BACKGROUND LAYER - Original Paths & Opacity Restored */}
      <div ref={bgLayerRef} className="hero-map-bg-layer">
        <div className="badge-pill-bg" style={{ border: `1px solid ${accent}40`, color: accent }}>
          CAMPUS NETWORK ACTIVE
        </div>

        <div style={{ position: 'absolute', top: '18%', left: '12%', opacity: 0.7 }}>
          <MapPin size={26} color={accent} fill={accent} fillOpacity={0.2} />
        </div>

        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path 
            d="M 15,20 C 35,20 65,80 85,80" 
            fill="transparent" 
            stroke="white" 
            strokeWidth="0.2" 
            strokeDasharray="1,1.5" 
            opacity="0.3" 
          />
        </svg>

        <div className="mission-tag">ANTI-SCROLLING <br/> REAL WORLD ONLY</div>
        <div className="vibe-callout">MEET UP WITHIN <span style={{ color: accent, opacity: 1, fontWeight: '900' }}>15 MINS.</span></div>

        <div style={{ position: 'absolute', bottom: '16%', right: '12%', opacity: 0.5 }}>
          <MapPin size={26} color="white" />
        </div>
      </div>

      <nav className="hero-nav-overlay">
        <div className="d-flex align-items-center gap-2">
          <Zap size={32} color={accent} strokeWidth={3} fill={accent} className="logo-glow" />
          <h3 className="fw-black m-0 text-white letter-spacing-1">connect.</h3>
        </div>
        <div className="d-flex gap-3">
          <button className="mirror-btn" onClick={() => navigate('/login', { state: { initialSignUp: false } })}>SIGN IN</button>
          <button className="mirror-btn accent-border" style={{'--accent': accent}} onClick={() => navigate('/login', { state: { initialSignUp: true } })}>SIGN UP</button>
        </div>
      </nav>

      {/* 2. THE VIDEO MASK */}
      <div ref={maskRef} className="video-mask-wrapper" style={{ zIndex: 2 }}>
        <video autoPlay loop muted playsInline className="hero-video-element" src={videoUrl} />
      </div>

      {/* 3. THE BRANDING - Original side-text classes restored */}
      <div ref={contentRef} className="hero-content-overlay-corner" style={{ zIndex: 10 }}>
        <h1 className="hero-title-corner">
          <span className="side-text">C</span>
          <div ref={oRef} className="o-space-corner">
              <div className="ring-container">
                <div className="ring ring-outer" style={{ borderColor: accent }}></div>
                <div className="ring ring-inner" style={{ borderColor: accent }}></div>
              </div>
          </div>
          <span className="side-text">NNECT</span>
        </h1>
      </div>
    </div>
  );
};

export default HeroMask;