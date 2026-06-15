import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';
import TiltCard from './TiltCard';

/* Color constants for brighter readable text */
const C_MUTED = '#6b7a94';

/**
 * ConfidenceGauge — premium arc gauge in a glass card.
 * Single color per confidence band (green/amber/red).
 * Monospace score with glow matching band color.
 */

const TRACK_COLOR = 'rgba(255,255,255,0.06)';

const BANDS = [
  { min: 80,  color: '#4ade80', label: 'High',   glow: 'rgba(74,222,128,0.5)'   },
  { min: 60,  color: '#fbbf24', label: 'Medium', glow: 'rgba(251,191,36,0.5)'  },
  { min: 0,   color: '#f87171', label: 'Low',    glow: 'rgba(248,113,113,0.5)' },
];

const SCALE = [
  { range: '80–100%', label: 'High',   color: '#4ade80' },
  { range: '60–79%',  label: 'Medium', color: '#fbbf24' },
  { range: '0–59%',   label: 'Low',    color: '#f87171' },
];

function getBand(c) {
  return BANDS.find(b => c >= b.min) ?? BANDS[BANDS.length - 1];
}

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
};

const ConfidenceGauge = ({ confidence }) => {
  const band = useMemo(() => getBand(confidence), [confidence]);

  const data = useMemo(() => [
    { value: confidence       },
    { value: 100 - confidence },
  ], [confidence]);

  return (
    <TiltCard maxTilt={5}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `${band.color}18` }}>
          <Activity className="w-4 h-4" style={{ color: band.color }} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#f0f2f8', lineHeight: 1.2 }}>Confidence Score</h2>
          <p className="text-xs mt-0.5" style={{ color: C_MUTED }}>Model prediction certainty</p>
        </div>
      </div>

      {/* Content */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 flex flex-col"
      >
        {/* Arc */}
        <motion.div
          variants={itemVariants}
          className="pt-5 px-4"
          aria-label={`Confidence: ${confidence}%`}
          style={{ flexShrink: 0 }}
        >
          <ResponsiveContainer width="100%" height={118}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="100%"
                startAngle={180}
                endAngle={0}
                innerRadius="56%"
                outerRadius="78%"
                dataKey="value"
                strokeWidth={0}
                animationDuration={800}
                animationBegin={60}
              >
                <Cell fill={band.color} style={{ filter: `drop-shadow(0 0 8px ${band.glow})` }} />
                <Cell fill={TRACK_COLOR} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Score */}
        <motion.div variants={itemVariants} className="text-center -mt-3 mb-5 px-4">
          <p
            className="font-mono font-bold leading-none"
            style={{ fontSize: '3.25rem', color: band.color, textShadow: `0 0 30px ${band.glow}` }}
            aria-live="polite"
          >
            {confidence}
            <span style={{ fontSize: '1.5rem', fontWeight: 600 }}>%</span>
          </p>
          <span
            className="inline-block text-xs font-mono px-3 py-1 rounded-full mt-2"
            style={{
              color: band.color,
              background: `${band.color}14`,
              border: `1px solid ${band.color}30`,
            }}
          >
            {band.label} Confidence
          </span>
        </motion.div>

        <div style={{ flex: 1 }} />

        {/* Scale legend */}
        <motion.div
          variants={itemVariants}
          className="px-5 py-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="eyebrow mb-3">Confidence Scale</p>
          <div className="grid grid-cols-3 gap-2.5 text-center">
            {SCALE.map(({ range, label, color }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <div className="w-full rounded-full" style={{ height: '2px', background: color, opacity: 0.5 }} />
                <span className="text-xs font-mono" style={{ color, opacity: 0.85 }}>{range}</span>
                <p className="text-xs" style={{ color: C_MUTED }}>{label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </TiltCard>
  );
};

export default React.memo(ConfidenceGauge);
