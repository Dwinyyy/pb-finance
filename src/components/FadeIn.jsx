import React from 'react';
import { motion } from 'framer-motion';

export default function FadeIn({ children, delay = 0, direction = 'up', className = "", hover = false }) {
  const directions = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { x: -40, y: 0 },
    right: { x: 40, y: 0 },
    none: { x: 0, y: 0, scale: 0.95 }
  };

  const initial = {
    opacity: 0,
    ...directions[direction]
  };

  return (
    <motion.div
      initial={initial}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      whileHover={hover ? { scale: 1.02, y: -6, rotateX: 2, rotateY: -1, boxShadow: "0px 25px 40px -10px rgba(0,0,0,0.1)" } : undefined}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ 
        duration: 0.8, 
        delay: delay / 1000, 
        ease: [0.21, 0.47, 0.32, 0.98] 
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
