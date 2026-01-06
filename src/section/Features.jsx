import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Clock, MapPin, Heart, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';


const FEATURE_DATA = [
  { id: 1, title: "spawn anywhere.", desc: "stop the rot. post your vibe—gym, coffee, or library—and let the right people find you.", icon: <Zap size={32} />, emoji: "✨", color: '#C1FF72' },
  { id: 2, title: "u set the clock.", desc: "no endless 'hey hru'. you decide how long you're live. set your timer, meet up, and get back to living.", icon: <Clock size={32} />, emoji: "⏰", color: '#FFD93D' },
  { id: 3, title: "campus only.", desc: "gated to your school. if they aren't within walking distance, they don't exist.", icon: <MapPin size={32} />, emoji: "📍", color: '#6CB4EE' },
  { id: 4, title: "the handshake.", desc: "lock in. the app confirms the meet only when you're actually there. verified in the real world.", icon: <Heart size={32} />, emoji: "🤝", color: '#FF8AAE' }
];


const FeatureCard = ({ card, index, onRemove }) => (
  <motion.div
    className="swipe-card"
    style={{ backgroundColor: card.color, zIndex: index }}
    initial={{ scale: 0.9, opacity: 0 }}
    animate={{ 
      scale: 1 - (2 - index) * 0.05, 
      y: (2 - index) * 20,
      opacity: 1 
    }}
    exit={{ x: 500, opacity: 0, rotate: 20, transition: { duration: 0.3 } }}
    drag="x"
    dragConstraints={{ left: 0, right: 0 }}
    onDragEnd={(e, info) => { if (Math.abs(info.offset.x) > 100) onRemove(); }}
    whileDrag={{ scale: 1.05, rotate: 5 }}
  >
    <div className="card-inner text-black">
      <div className="card-top">
        <div className="icon-badge">{card.icon}</div>
        <div className="emoji-pill">{card.emoji}</div>
      </div>
      <div className="card-bottom">
        <h3 className="feature-headline">{card.title}</h3>
        <p className="feature-desc">{card.desc}</p>
      </div>
      <div className="swipe-instruction">
        <span>Next Feature</span>
        <div className="arrow-anim">→</div>
      </div>
    </div>
  </motion.div>
);

export const Features = () => {
  const { accent } = useTheme();
  const [cards, setCards] = useState(FEATURE_DATA);

  const rotateCards = () => {
    setCards((prev) => {
      const newStack = [...prev];
      const popped = newStack.shift();
      newStack.push(popped);
      return newStack;
    });
  };

  return (
    <section className="features-section py-5">
      <div className="container text-center mb-5">
        <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} className="d-flex align-items-center justify-content-center gap-2 mb-2">
          <Sparkles size={18} color={accent} />
          <span className="text-uppercase fw-bold" style={{ color: accent, letterSpacing: '2px', fontSize: '0.75rem' }}>
            System Capabilities
          </span>
        </motion.div>
        <h2 className="cute-title">the features.</h2>
      </div>

      <div className="stack-container">
        <AnimatePresence>
       
          {cards.slice(0, 3).reverse().map((card, index) => (
            <FeatureCard 
              key={card.id} 
              card={card} 
              index={index} 
              onRemove={rotateCards} 
            />
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
};