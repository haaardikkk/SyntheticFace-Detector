import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Scan } from 'lucide-react';
import TiltCard from './TiltCard';

/**
 * PredictionCard — premium result display.
 * Visual hierarchy: large verdict dominates, then confidence bar, then data rows.
 * Always shows Gemini border ring (isActive=true).
 */

const rowVariants = {
  hidden:  { opacity: 0, x: -12 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1], delay: 0.12 + i * 0.07 },
  }),
};

const verdictVariants = {
  hidden:  { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1], delay: 0.05 } },
};

const DATA_ROWS = [
  { label: 'Model',          value: 'EfficientNet-B0', mono: true  },
  { label: 'Preprocessing',  value: 'OpenCV face crop', mono: true  },
  { label: 'Dataset',        value: 'CelebDF + Synthetic', mono: false },
];

const PredictionCard = ({ prediction }) => {
  const isReal     = useMemo(() => prediction?.prediction === 'REAL', [prediction?.prediction]);
  const labelColor = isReal ? '#4ade80' : '#f87171';
  const barGlow    = isReal ? 'rgba(74,222,128,0.5)' : 'rgba(248,113,113,0.5)';
  const iconBg     = isReal ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)';

  return (
    <TiltCard isActive maxTilt={4}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>
          <Scan style={{ width: 16, height: 16, color: labelColor }} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#f0f2f8', lineHeight: 1.2 }}>Classification Result</h2>
          <p className="text-xs mt-0.5" style={{ color: '#6b7a94' }}>EfficientNet-B0 · Synthetic face analysis</p>
        </div>
      </div>

      {/* ── VERDICT — dominant visual element ─────── */}
      <motion.div
        variants={verdictVariants}
        initial="hidden"
        animate="visible"
        className="px-5 py-7 text-center"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p
          className="font-mono font-black leading-none tracking-wider mb-2"
          style={{
            fontSize: '2.75rem',
            color: labelColor,
            textShadow: `0 0 40px ${barGlow}, 0 0 80px ${barGlow}`,
            letterSpacing: '0.12em',
          }}
          aria-live="polite"
        >
          {prediction?.prediction}
        </p>
        <p className="text-sm" style={{ color: '#9eaabb' }}>
          {isReal
            ? 'Likely a real human photograph'
            : 'Likely an AI-generated synthetic face'}
        </p>
      </motion.div>

      {/* ── Confidence bar ───────────────────────── */}
      <motion.div
        custom={0}
        variants={rowVariants}
        initial="hidden"
        animate="visible"
        className="px-5 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs" style={{ color: '#6b7a94' }}>Confidence</span>
          <span className="text-sm font-mono font-semibold" style={{ color: '#f0f2f8' }}>
            {prediction?.confidence}%
          </span>
        </div>
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: '4px', background: 'rgba(255,255,255,0.06)' }}
          role="progressbar"
          aria-valuenow={prediction?.confidence}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.25 }}
            style={{
              height: '100%',
              width: `${prediction?.confidence}%`,
              borderRadius: '999px',
              transformOrigin: 'left',
              background: `linear-gradient(to right, ${labelColor}99, ${labelColor})`,
              boxShadow: `0 0 10px ${barGlow}`,
            }}
          />
        </div>
      </motion.div>

      {/* ── Data rows ────────────────────────────── */}
      <div className="flex-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {DATA_ROWS.map(({ label, value, mono }, i) => (
          <motion.div
            key={label}
            custom={i + 1}
            variants={rowVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
          >
            <span className="text-xs" style={{ color: '#6b7a94' }}>{label}</span>
            <span className={`text-sm ${mono ? 'font-mono' : ''}`} style={{ color: '#9eaabb' }}>{value}</span>
          </motion.div>
        ))}
      </div>

      {/* Disclaimer */}
      <motion.div
        custom={4}
        variants={rowVariants}
        initial="hidden"
        animate="visible"
        className="flex items-start gap-2.5 px-5 py-3"
      >
        <AlertTriangle style={{ width: 14, height: 14, color: '#6b7a94', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <p className="text-xs leading-relaxed" style={{ color: '#6b7a94' }}>
          Educational use only. Not suitable for forensic or legal purposes.
        </p>
      </motion.div>
    </TiltCard>
  );
};

export default React.memo(PredictionCard);
