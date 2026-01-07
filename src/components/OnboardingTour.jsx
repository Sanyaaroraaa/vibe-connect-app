import React, { useState, useEffect, useMemo } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { useTheme } from '../context/ThemeContext';

const OnboardingTour = ({ ready, hasSeenTourInDb, onComplete }) => {
  const { accent } = useTheme();
  const [run, setRun] = useState(false);

  useEffect(() => {
    const localSeen = localStorage.getItem('hasSeenConnectTour');
    
    // Only run if NOT seen in DB AND NOT seen in LocalStorage
    if (!hasSeenTourInDb && localSeen !== 'true' && ready) {
      setRun(true);
    }
  }, [ready, hasSeenTourInDb]);

  const steps = useMemo(() => [
    {
      target: 'body',
      placement: 'center',
      title: 'NEURAL LINK ESTABLISHED',
      content: 'Welcome to Connect. Let’s calibrate your campus radar.',
    },
    {
      target: '.trust-pill',
      title: 'TRUST PROTOCOL',
      content: 'Your reputation score. Earn points by completing vibes to unlock verified status.',
      placement: window.innerWidth < 768 ? 'bottom' : 'right',
    },
    {
      target: '.heatmap-wrapper',
      title: 'GEOSPATIAL RADAR',
      content: 'Real-time scan of nearby nodes. Heat clusters indicate high student activity.',
      placement: 'top',
    },
    {
      target: 'textarea[placeholder*="plan"]', 
      title: 'SIGNAL UPLINK',
      content: 'Broadcast your intent here. Signals vanish once a peer connects or time expires.',
      placement: 'top',
    },
    {
      target: '.filter-indicator',
      title: 'FREQUENCY FILTER',
      content: 'Isolate specific vibes: Study sessions, Coffee runs, or Gym partners.',
      placement: 'bottom',
    }
  ], []);

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem('hasSeenConnectTour', 'true');
      setRun(false);
   
      if (onComplete) onComplete();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      showProgress={true}
      disableScrolling={false}
      scrollToFirstStep={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          zIndex: 10000000,
          primaryColor: accent,
          backgroundColor: '#16181c',
          textColor: '#ffffff',
          arrowColor: '#16181c',
          overlayColor: 'rgba(0, 0, 0, 0.7)', 
        },
        buttonNext: {
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#000',
          padding: '10px 20px',
          backgroundColor: accent,
        },
        tooltip: {
          borderRadius: '16px',
          border: `1px solid ${accent}44`,
          padding: '15px'
        }
      }}
    />
  );
};

export default OnboardingTour;