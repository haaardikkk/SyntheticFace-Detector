import React from 'react';
import { motion } from 'framer-motion';

/* ── Particle data ─────────────────────────────────────────────── */
const PARTICLES = [
  { id: 0, x: '12%',  y: '22%', size: 2,   dur: 22, delay: 0    },
  { id: 1, x: '88%',  y: '15%', size: 1.5, dur: 28, delay: 4    },
  { id: 2, x: '65%',  y: '75%', size: 2.5, dur: 18, delay: 7    },
  { id: 3, x: '30%',  y: '60%', size: 1,   dur: 34, delay: 2    },
  { id: 4, x: '78%',  y: '48%', size: 2,   dur: 26, delay: 11   },
  { id: 5, x: '45%',  y: '85%', size: 1.5, dur: 20, delay: 5    },
  { id: 6, x: '92%',  y: '68%', size: 1,   dur: 30, delay: 9    },
  { id: 7, x: '18%',  y: '80%', size: 2,   dur: 24, delay: 1    },
  { id: 8, x: '55%',  y: '10%', size: 1.5, dur: 32, delay: 6    },
  { id: 9, x: '8%',   y: '52%', size: 1,   dur: 27, delay: 13   },
];

/**
 * Ambient background — three radial light blobs + floating micro-particles.
 * Fixed positioning so it underlays the entire page.
 * Zero canvas, no RAF loop — pure CSS + Framer Motion with lazy rendering.
 */
const GridBackground = () => (
  <div
    aria-hidden="true"
    className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
  >
    {/* ── Base colour ─────────────────────────────── */}
    <div className="absolute inset-0 bg-bg" />

    {/* ── Ambient radial glow — top right (blue) ─── */}
    <div
      className="absolute"
      style={{
        top:    '-20%',
        right:  '-10%',
        width:  '60vw',
        height: '60vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(91,141,238,0.13) 0%, transparent 70%)',
        animation: 'slow-pulse 12s ease-in-out infinite',
      }}
    />

    {/* ── Ambient radial glow — bottom left (violet) */}
    <div
      className="absolute"
      style={{
        bottom: '-15%',
        left:   '-12%',
        width:  '55vw',
        height: '55vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,108,247,0.09) 0%, transparent 70%)',
        animation: 'slow-pulse 16s ease-in-out infinite 4s',
      }}
    />

    {/* ── Center whisper ─────────────────────────── */}
    <div
      className="absolute"
      style={{
        top:    '30%',
        left:   '35%',
        width:  '40vw',
        height: '40vw',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,189,248,0.05) 0%, transparent 70%)',
        animation: 'slow-pulse 20s ease-in-out infinite 8s',
      }}
    />

    {/* ── Floating particles ──────────────────────── */}
    {PARTICLES.map(({ id, x, y, size, dur, delay }) => (
      <motion.div
        key={id}
        className="absolute rounded-full"
        style={{
          left: x,
          top:  y,
          width:  size,
          height: size,
          background: id % 3 === 0
            ? 'rgba(91,141,238,0.55)'
            : id % 3 === 1
            ? 'rgba(139,108,247,0.45)'
            : 'rgba(56,189,248,0.4)',
        }}
        animate={{
          y:       [0, -24, 0],
          opacity: [0.35, 0.65, 0.35],
          scale:   [1, 1.4, 1],
        }}
        transition={{
          duration: dur,
          delay,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

export default React.memo(GridBackground);
