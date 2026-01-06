import React, { useState, useEffect, useMemo } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import { useTheme } from '../context/ThemeContext';

const OnboardingTour = ({ ready }) => {
  const { accent } = useTheme();
  
  // Initialize state based on localStorage to prevent "flickering" starts
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenConnectTour');
    
    // Only set run to true if the user hasn't seen it and the parent component is ready
    if (hasSeenTour !== 'true' && ready) {
      setRun(true);
    }
  }, [ready]);

  // useMemo prevents the steps array from being re-created on every render
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
    // When the tour ends or is skipped, update localStorage and stop the run
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem('hasSeenConnectTour', 'true');
      setRun(false);
    }
  };

  return (
    <>
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
            overlayColor: 'rgba(0, 0, 0, 0.6)', 
          },
          overlay: {
            backdropFilter: 'none', 
          },
          buttonNext: {
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#000',
            padding: '10px 20px',
            backgroundColor: accent,
          },
          buttonBack: {
            color: '#888',
            fontSize: '12px',
            marginRight: '10px'
          },
          tooltip: {
            borderRadius: '16px',
            border: `1px solid ${accent}44`,
            padding: '15px'
          }
        }}
      />
      <style>{`
        /* Force the guide box to be on top of the overlay */
        .react-joyride__tooltip {
          z-index: 10000001 !important;
        }

        /* Neon Glow around the focused element */
        .joyride-spotlight {
          box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5), 0 0 30px ${accent} !important;
          border-radius: 16px !important;
        }

        /* Responsive Fix */
        @media (max-width: 768px) {
          .react-joyride__tooltip {
            width: 90vw !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
    </>
  );
};

export default OnboardingTour;