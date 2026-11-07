import React from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import TiltCard from './TiltCard';

const C_MUTED = '#6b7a94';
const VERDICT_COLOR = { REAL: '#4ade80', FAKE: '#f87171' };

// A two-way decision is always at least 50% confident, so the scale starts at 50.
const BANDS = [
  { min: 85, label: 'High',   range: '85–100%' },
  { min: 65, label: 'Medium', range: '65–84%'  },
  { min: 0,  label: 'Low',    range: '50–64%'  },
];
const getBand = (c) => BANDS.find((b) => c >= b.min);

// Semicircle gauge: 50% at the left end, 100% at the right end
const R = 80;
const ARC = Math.PI * R;
const ARC_PATH = `M ${100 - R} 100 A ${R} ${R} 0 0 1 ${100 + R} 100`;

const ConfidenceGauge = ({ confidence, prediction }) => {
  const band = getBand(confidence);
  const color = VERDICT_COLOR[prediction] ?? '#5b8dee';
  const fill = Math.min(1, Math.max(0, (confidence - 50) / 50));

  return (
    <TiltCard maxTilt={5}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <Activity className="w-4 h-4" style={{ color }} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#f0f2f8', lineHeight: 1.2 }}>Confidence Score</h2>
          <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>How sure the model is that this face is {prediction}</p>
        </div>
      </div>

      {/* Gauge */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-6 pb-5">
        <div className="relative w-full" style={{ maxWidth: 260 }} aria-label={`Confidence: ${confidence}%`} role="img">
          <svg viewBox="0 0 200 112" className="w-full" aria-hidden="true">
            <path d={ARC_PATH} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="14" strokeLinecap="round" />
            <motion.path
              d={ARC_PATH}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={ARC}
              initial={{ strokeDashoffset: ARC }}
              animate={{ strokeDashoffset: ARC * (1 - fill) }}
              transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
              style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
            />
          </svg>
          {/* Score sits inside the arc's bowl, clear of the stroke */}
          <div className="absolute inset-x-0 bottom-0 text-center">
            <p className="font-mono font-bold leading-none" style={{ fontSize: '2.5rem', color, textShadow: `0 0 24px ${color}60` }} aria-live="polite">
              {confidence}
              <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>%</span>
            </p>
          </div>
        </div>
        <div className="w-full flex justify-between font-mono text-xs mt-1" style={{ maxWidth: 260, color: C_MUTED }}>
          <span>50%</span>
          <span>100%</span>
        </div>
        <span
          className="inline-block text-xs font-mono px-3 py-1 rounded-full mt-3"
          style={{ color, background: `${color}14`, border: `1px solid ${color}30` }}
        >
          {band.label} confidence
        </span>
      </div>

      {/* Scale legend */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="eyebrow mb-3">Confidence Scale</p>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          {[...BANDS].reverse().map(({ label, range }) => {
            const active = label === band.label;
            return (
              <div key={label} className="flex flex-col gap-1.5">
                <div className="w-full rounded-full" style={{ height: '2px', background: active ? color : 'rgba(255,255,255,0.12)' }} />
                <span className="text-xs font-mono" style={{ color: active ? color : C_MUTED }}>{range}</span>
                <p className="text-xs" style={{ color: active ? '#f0f2f8' : C_MUTED }}>{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </TiltCard>
  );
};

export default React.memo(ConfidenceGauge);
