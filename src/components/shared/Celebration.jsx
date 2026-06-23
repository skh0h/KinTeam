import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

const PARTICLE_COUNT = 24;
const EMOJIS = ['⭐', '✨', '🌟', '🎉', '💫', '🎊'];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

function Particle({ index, originX, originY }) {
  const angle = (index / PARTICLE_COUNT) * 360 + randomBetween(-15, 15);
  const dist = randomBetween(80, 220);
  const rad = (angle * Math.PI) / 180;
  const tx = Math.cos(rad) * dist;
  const ty = Math.sin(rad) * dist;
  const emoji = EMOJIS[index % EMOJIS.length];
  const size = randomBetween(14, 26);
  const delay = randomBetween(0, 0.12);

  return (
    <motion.span
      style={{
        position: 'fixed',
        left: originX,
        top: originY,
        fontSize: size,
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: 9999,
        display: 'block',
        lineHeight: 1,
      }}
      initial={{ opacity: 1, x: 0, y: 0, scale: 0.3 }}
      animate={{
        opacity: [1, 1, 0],
        x: tx,
        y: ty,
        scale: [0.3, 1.1, 0.8],
        rotate: randomBetween(-180, 180),
      }}
      transition={{
        duration: 0.9,
        delay,
        ease: [0.2, 0.8, 0.4, 1],
      }}
    >
      {emoji}
    </motion.span>
  );
}

/**
 * Celebration overlay — rendered into a portal so it floats above everything.
 * Props:
 *   visible: boolean
 *   origin: { x: number, y: number } — viewport coords of the burst origin
 *   onDone: () => void
 */
export default function Celebration({ visible, origin, onDone }) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (visible) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onDone?.();
      }, 1200);
    }
    return () => clearTimeout(timerRef.current);
  }, [visible, onDone]);

  if (!visible) return null;

  const cx = origin?.x ?? window.innerWidth / 2;
  const cy = origin?.y ?? window.innerHeight / 2;

  return createPortal(
    <AnimatePresence>
      {visible && (
        <>
          {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
            <Particle key={i} index={i} originX={cx} originY={cy} />
          ))}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
