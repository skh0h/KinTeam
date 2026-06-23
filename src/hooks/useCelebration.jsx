import { useState, useCallback, useRef } from 'react';
import Celebration from '@/components/shared/Celebration';

/**
 * useCelebration — imperative confetti/sparkle burst.
 *
 * Returns:
 *   celebrate(origin?: { x, y }, opts?: { sound?: boolean }) — fire a burst
 *   CelebrationPortal — JSX element to include once in your tree (or in a page root)
 *
 * Usage:
 *   const { celebrate, CelebrationPortal } = useCelebration();
 *   ...
 *   <button onClick={(e) => celebrate({ x: e.clientX, y: e.clientY })}>Hi-five!</button>
 *   {CelebrationPortal}
 */
export function useCelebration() {
  const [state, setState] = useState({ visible: false, origin: null });
  const timeoutRef = useRef(null);

  const celebrate = useCallback((origin, opts = {}) => {
    // Optional chime — Web Audio, off by default
    if (opts.sound) {
      try {
        // @ts-ignore — webkitAudioContext is a vendor prefix, not in lib.dom.d.ts
        const AudioCtxCtor = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        const ctx = new AudioCtxCtor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } catch {
        // Web Audio not available — silent fallback
      }
    }

    clearTimeout(timeoutRef.current);
    setState({ visible: true, origin: origin ?? null });

    // Auto-hide after animation completes (1.2 s)
    timeoutRef.current = setTimeout(() => {
      setState({ visible: false, origin: null });
    }, 1250);
  }, []);

  const handleDone = useCallback(() => {
    setState({ visible: false, origin: null });
  }, []);

  const CelebrationPortal = (
    <Celebration
      visible={state.visible}
      origin={state.origin}
      onDone={handleDone}
    />
  );

  return { celebrate, CelebrationPortal };
}
