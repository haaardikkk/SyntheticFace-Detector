import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Scan } from 'lucide-react';
import TiltCard from './TiltCard';
import { MODEL_NAMES, verdictOf } from '../verdict';

/**
 * PredictionCard — the verdict for the selected face, the other faces as chips, then details.
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

const FaceChips = ({ faces, selected, onSelect }) => (
  <div className="px-5 py-3 flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    <span className="text-xs mr-1" style={{ color: '#6b7a94' }}>{faces.length} faces:</span>
    {faces.map((f, i) => {
      const { color } = verdictOf(f.prediction);
      const active = i === selected;
      return (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-pressed={active}
          className="text-xs font-mono px-2.5 py-1 rounded-full transition-colors duration-150"
          style={{
            color: active ? '#07080f' : color,
            background: active ? color : `${color}14`,
            border: `1px solid ${color}${active ? '' : '40'}`,
          }}
        >
          {i + 1} · {f.prediction}
        </button>
      );
    })}
  </div>
);

const PredictionCard = ({ prediction, faces = [], selectedFace = 0, onSelectFace }) => {
  const { color: labelColor, glow: barGlow, text } = verdictOf(prediction?.prediction);
  const faceFound = prediction?.face_detected !== false;
  const modelName = MODEL_NAMES[prediction?.model_version] ?? prediction?.model_version;
  const dataRows = [
    ...(prediction?.altered_area != null
      ? [{ label: 'Altered area', value: `${prediction.altered_area}% of face crop`, mono: true }] : []),
    { label: 'AI likelihood', value: prediction?.fake_probability != null ? `${prediction.fake_probability}%` : '—', mono: true },
    { label: 'Faces found',   value: faceFound ? String(prediction?.face_count ?? 1) : 'None: analysed image centre', mono: false },
    { label: 'Model',         value: modelName, mono: true },
  ];

  return (
    <TiltCard isActive maxTilt={4}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${labelColor}1f` }}>
          <Scan style={{ width: 16, height: 16, color: labelColor }} aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: '#f0f2f8', lineHeight: 1.2 }}>
            Classification Result{faces.length > 1 ? ` · Face ${selectedFace + 1}` : ''}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#6b7a94' }}>{modelName} · Synthetic face analysis</p>
        </div>
      </div>

      {faces.length > 1 && <FaceChips faces={faces} selected={selectedFace} onSelect={onSelectFace} />}

      {/* ── VERDICT — dominant visual element ─────── */}
      <motion.div
        key={`${prediction?.prediction}-${selectedFace}`}
        variants={verdictVariants}
        initial="hidden"
        animate="visible"
        className="px-5 py-7 text-center"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p
          className="font-mono font-black leading-none tracking-wider mb-2"
          style={{
            fontSize: prediction?.prediction === 'UNCERTAIN' ? '2.1rem' : '2.75rem',
            color: labelColor,
            textShadow: `0 0 40px ${barGlow}, 0 0 80px ${barGlow}`,
            letterSpacing: '0.12em',
          }}
          aria-live="polite"
        >
          {prediction?.prediction}
        </p>
        <p className="text-sm" style={{ color: '#9eaabb' }}>{text}</p>
        {!faceFound && (
          <p className="text-xs mt-3 mx-auto max-w-xs leading-relaxed" style={{ color: '#fbbf24' }}>
            No face was found, so the centre of the image was analysed. This result is less reliable.
          </p>
        )}
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
            key={selectedFace}
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
        {dataRows.map(({ label, value, mono }, i) => (
          <motion.div
            key={label}
            custom={i + 1}
            variants={rowVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-between gap-4 px-5 py-3"
            style={{ borderBottom: i < dataRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
          >
            <span className="text-xs" style={{ color: '#6b7a94' }}>{label}</span>
            <span className={`text-sm text-right ${mono ? 'font-mono' : ''}`} style={{ color: '#9eaabb' }}>{value}</span>
          </motion.div>
        ))}
      </div>

      {/* Disclaimer */}
      <motion.div
        custom={5}
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
