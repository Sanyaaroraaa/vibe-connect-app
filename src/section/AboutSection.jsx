import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useTheme } from '../context/ThemeContext';

gsap.registerPlugin(ScrollTrigger);

const InfoBlock = ({ title, desc, imgSrc, accent, isReversed, imgRef, tileRef }) => (
  <div className={`row align-items-center py-5 ${isReversed ? 'flex-row-reverse' : ''}`}>
    <div className="col-lg-6">
      <div className="img-mask" ref={imgRef}>
        <img src={imgSrc} alt={title} className="inner-img" loading="lazy" />
      </div>
    </div>
    <div className="col-lg-5 ms-auto me-auto">
      <div className="glass-tile border-top-glow" ref={tileRef} style={{ '--glow': accent }}>
        <h3 className="fw-black text-white mb-3" style={{ textTransform: 'none' }}>{title}</h3>
        <p className="text-secondary mb-0">{desc}</p>
      </div>
    </div>
  </div>
);

const AboutSection = () => {
  const { accent } = useTheme();
  const sectionRef = useRef(null);
  const pathRef = useRef(null);
  
  
  const imgRefs = useRef([]);
  const tileRefs = useRef([]);
  
  const firstRowTileRef = useRef(null);

 
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 576;

  useEffect(() => {
    const ctx = gsap.context(() => {
   
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top center",
          end: "bottom center",
          scrub: 1, 
        }
      });

      
      tl.fromTo(pathRef.current, 
        { strokeDashoffset: 5414 }, 
        { strokeDashoffset: 0, ease: "none" },
        0 
      );

    
      tl.fromTo(firstRowTileRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.3 },
        0.1
      );

     
      imgRefs.current.forEach((img, i) => {
        const tile = tileRefs.current[i];
        if (!img || !tile) return;

        tl.fromTo([img, tile], 
          { 
            opacity: 0, 
            y: 40, 
            clipPath: isMobile ? "inset(10% 10% 10% 10% round 30px)" : "inset(15% 15% 15% 15% round 40px)" 
          },
          { 
            opacity: 1, 
            y: 0, 
            clipPath: "inset(0% 0% 0% 0% round 40px)", 
            duration: 0.5 
          },
          ">-=0.2" 
        );
      });

     
      gsap.to('.massive-outline', {
        y: isMobile ? -30 : -100,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top bottom",
          scrub: 1
        }
      });

    }, sectionRef);

    return () => ctx.revert();
  }, [isMobile]); 

  return (
    <section ref={sectionRef} className="about-section-new">
      
      <svg className="tech-line-svg" viewBox="-480 0 2300 2241">
        <path
          ref={pathRef}
          stroke={accent}
          strokeWidth="12"
          strokeDasharray="5414"
          strokeLinecap="round"
          fill="none"
          opacity="0.2"
          d="M-841 100H584c124 0 225 101 225 225v0c0 124-101 225-225 225h-95a281 281 0 00-281 281v0c0 155 125 281 281 281h442c167 0 304 136 304 304v0c0 168-137 304-304 304H795a439 439 0 00-439 439v82"
        />
      </svg>

      <div className="container position-relative">
      
        <div className="row align-items-center min-vh-100 py-5">
          <div className="col-lg-6 position-relative">
            <h2 className="massive-outline">REALITY<br/><span className="filled" style={{ color: accent }}>OVER</span><br/>ROUTINE.</h2>
          </div>
          <div className="col-lg-5 ms-auto">
            <div className="glass-tile" ref={firstRowTileRef}>
              <p className="lead fw-bold text-white mb-0">
                we aren't another app to rot your brain. <b>connect.</b> is the "exit button" for digital loops. Bridge the gap to physical presence in 15 mins or less.
              </p>
            </div>
          </div>
        </div>

       
        <InfoBlock 
          title="500M zone."
          desc="If it isn't walkable, it isn't on the map. Strictly campus-radius. Strictly real peers. Strictly now."
          imgSrc="./500.png"
          accent={accent}
          isReversed={true}
          imgRef={el => imgRefs.current[0] = el}
          tileRef={el => tileRefs.current[0] = el}
        />

     
        <InfoBlock 
          title="Community first."
          desc="Building a safer campus starts with real interactions. Our handshake tech confirms you're there. No more ghosting. No more fakes."
          imgSrc="./community.png"
          accent={accent}
          isReversed={false}
          imgRef={el => imgRefs.current[1] = el}
          tileRef={el => tileRefs.current[1] = el}
        />
      </div>
    </section>
  );
};

export default AboutSection;