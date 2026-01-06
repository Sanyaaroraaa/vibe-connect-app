import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '../context/ThemeContext';
import { Target, BookOpen, Coffee, Dumbbell, UserRound, Info } from 'lucide-react';
import { renderToString } from 'react-dom/server';

const VibeHeatmap = ({ vibes, center }) => {
  const { accent } = useTheme();
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const vibeMarkersGroupRef = useRef(L.layerGroup());

  // Helper: Convert Lucide Icons to SVG Strings for Leaflet
  const getIconHtml = (type) => {
    const iconProps = { size: 10, color: "#fff", strokeWidth: 3 };
    switch (type) {
      case 'Study': return renderToString(<BookOpen {...iconProps} />);
      case 'Coffee': return renderToString(<Coffee {...iconProps} />);
      case 'Gym': return renderToString(<Dumbbell {...iconProps} />);
      case 'Walk': return renderToString(<UserRound {...iconProps} />);
      default: return renderToString(<Info {...iconProps} />);
    }
  };

  const isValidCoords = (coords) => (
    Array.isArray(coords) && coords.length === 2 && 
    typeof coords[0] === 'number' && !isNaN(coords[0]) &&
    typeof coords[1] === 'number' && !isNaN(coords[1])
  );

  const handleRecenter = () => {
    if (mapInstanceRef.current && isValidCoords(center)) {
      mapInstanceRef.current.flyTo(center, 15, { animate: true, duration: 1 });
    }
  };

  // 1. INITIALIZE MAP
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current || !isValidCoords(center)) return;

    mapInstanceRef.current = L.map(mapContainerRef.current, {
      center: center,
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current);
    vibeMarkersGroupRef.current.addTo(mapInstanceRef.current);

    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 400);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center]);

  // 2. UPDATE USER PULSE
  useEffect(() => {
    if (mapInstanceRef.current && isValidCoords(center)) {
      if (userMarkerRef.current) mapInstanceRef.current.removeLayer(userMarkerRef.current);
      
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `<div class="pulse-ring" style="border-color: ${accent}"></div>
               <div class="pulse-dot" style="background-color: ${accent}"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      userMarkerRef.current = L.marker(center, { icon: userIcon, zIndexOffset: 1000 }).addTo(mapInstanceRef.current);
    }
  }, [center, accent]);

  // 3. UPDATE RADAR NODES & HEATMAP
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (heatLayerRef.current) mapInstanceRef.current.removeLayer(heatLayerRef.current);
    vibeMarkersGroupRef.current.clearLayers();

    // Filter: Only show vibes that are NOT full, NOT expired, and OPEN
    const activeVibes = vibes?.filter(v => 
      v.coords && 
      v.participantCount < 1 && 
      v.mins > 0 &&
      v.status === "open"
    );

    if (activeVibes?.length > 0) {
      // Create Heat Layer
      const heatData = activeVibes.map(p => [p.coords.lat, p.coords.lng, 0.6]);
      heatLayerRef.current = L.heatLayer(heatData, {
        radius: 25, blur: 18, maxZoom: 17,
        gradient: { 0.4: '#111', 0.7: accent, 1.0: '#fff' }
      }).addTo(mapInstanceRef.current);

      // Create Individual Node Markers with Activity Icons
      activeVibes.forEach((vibe) => {
        const jitterLat = (Math.random() - 0.5) * 0.0004;
        const jitterLng = (Math.random() - 0.5) * 0.0004;

        const vibeIcon = L.divIcon({
          className: 'vibe-node-marker',
          html: `<div class="vibe-dot-container" style="background-color: ${accent}; border: 1px solid rgba(255,255,255,0.5); box-shadow: 0 0 15px ${accent}88">
                    ${getIconHtml(vibe.type || vibe.activityType)}
                 </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker([vibe.coords.lat + jitterLat, vibe.coords.lng + jitterLng], { icon: vibeIcon })
          .addTo(vibeMarkersGroupRef.current);

        // Click to Scroll Logic
        marker.on('click', () => {
          const element = document.getElementById(`vibe-card-${vibe.id}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.style.borderColor = accent;
            element.style.boxShadow = `0 0 20px ${accent}33`;
            setTimeout(() => {
                element.style.borderColor = '#2f3336';
                element.style.boxShadow = 'none';
            }, 2000);
          }
        });
      });
    }
  }, [vibes, accent]);

  return (
    <div className="heatmap-wrapper position-relative overflow-hidden" style={{ height: '300px' }}>
      <div ref={mapContainerRef} style={{ height: '100%', width: '100%', background: '#000' }} />
      
      {/* Radar Sweep Animation Overlay */}
      <div className="radar-sweep" style={{ background: `conic-gradient(from 0deg, ${accent}22 0%, transparent 15%)` }}></div>

      <button onClick={handleRecenter} className="position-absolute border-0 d-flex align-items-center justify-content-center active-click"
        style={{ bottom: '15px', right: '15px', zIndex: 1000, width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'rgba(0,0,0,0.8)', border: `1px solid ${accent}44`, color: accent }}>
        <Target size={20} />
      </button>

      {!isValidCoords(center) && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-black" style={{ zIndex: 1001 }}>
             <div className="spinner-border spinner-border-sm text-secondary me-2"></div>
             <span className="text-white-50 small fw-bold">LOCKING RADAR...</span>
        </div>
      )}

      <style>{`
        .pulse-ring { position: absolute; width: 30px; height: 30px; border: 2px solid; border-radius: 50%; animation: map-pulse 2s infinite; margin-top: -5px; margin-left: -5px; }
        .pulse-dot { width: 10px; height: 10px; border-radius: 50%; background: #fff; border: 2px solid #000; }
        
        .vibe-dot-container { 
          width: 20px; height: 20px; border-radius: 6px; 
          display: flex; align-items: center; justify-content: center;
          animation: vibe-blink 1.5s infinite; cursor: pointer;
          position: relative; z-index: 600;
        }

        .radar-sweep {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 800px;
          height: 800px;
          margin-top: -400px;
          margin-left: -400px;
          border-radius: 50%;
          pointer-events: none;
          z-index: 500;
          animation: rotate-radar 4s linear infinite;
        }

        @keyframes rotate-radar {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes map-pulse { 0% { transform: scale(0.5); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes vibe-blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.1); } }
        .leaflet-container { background: #000 !important; cursor: crosshair !important; }
        .active-click:active { transform: scale(0.9); }
      `}</style>
    </div>
  );
};

export default VibeHeatmap;