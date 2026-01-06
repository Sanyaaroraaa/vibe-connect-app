import React, { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import { ThemeProvider } from '../context/ThemeContext';
import HeroMask from '../section/HeroMask'; 
import { Features } from '../section/Features';
import AboutSection from '../section/AboutSection';
import Footer from '../section/Footer';

const Landing = ({ accent = "'#C1FF72" }) => {
  const videoSource = "hv.mp4"; 

  useEffect(() => {
    
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), 
      direction: 'vertical',
      gestureDirection: 'vertical',
      smooth: true,
      mouseMultiplier: 1,
      smoothTouch: false,
      touchMultiplier: 2,
      infinite: false,
    });

    
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    
    return () => {
      lenis.destroy();
    };
  }, []);

  return (
    <ThemeProvider accent={accent}>
      <div className="bg-black text-white overflow-x-hidden">
        <HeroMask videoUrl={videoSource} />
        
        <main className="position-relative bg-black" style={{ zIndex: 2 }}>
          <div className="container mx-auto">
            <Features />
          </div>
          <AboutSection />
          <Footer />
        </main>
      </div>
    </ThemeProvider>
  );
};

export default Landing;