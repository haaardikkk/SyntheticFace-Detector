import { motion } from 'framer-motion';
import { Cpu, Target, Zap, Frame } from 'lucide-react';
import TiltCard from './TiltCard';

/**
 * ModelStats — premium ML model card.
 * Top row: 4 quick-stat glass tiles (architecture, accuracy, input size, speed)
 * Below: full specification table with hover row highlights
 */

/* ── Quick-stat tiles ────────────────────────────────── */
const QUICK_STATS = [
  {
    label: 'Architecture',
    value: 'ConvNeXt-Tiny',
    Icon:  Cpu,
    color: '#5b8dee',
    bg:    'rgba(91,141,238,0.12)',
    small: true,
  },
  {
    label: 'Balanced Accuracy*',
    value: '94.2%',
    Icon:  Target,
    color: '#4ade80',
    bg:    'rgba(74,222,128,0.12)',
    small: false,
  },
  {
    label: 'AUC, Unseen Generators',
    value: '0.83',
    Icon:  Frame,
    color: '#8b6cf7',
    bg:    'rgba(139,108,247,0.12)',
    small: false,
  },
  {
    label: 'Inference',
    value: '< 1 second',
    Icon:  Zap,
    color: '#fbbf24',
    bg:    'rgba(251,191,36,0.12)',
    small: false,
  },
];

/* ── Full specification table ────────────────────────── */
const SPECS = [
  { label: 'Architecture',        value: 'ConvNeXt-Tiny + alteration-map decoder',     note: null },
  { label: 'Training Data',       value: '179,426 face crops, 10+ generators',
    note: 'DeepFakeFace, SFHQ (Flux, SDXL, DALL-E 3), OpenFake, FFHQ / StyleGAN, CelebA-HQ, WildDeepfake' },
  { label: 'Output',              value: 'Real / AI-generated + altered regions',      note: null },
  { label: 'Input Resolution',    value: '256 × 256 px',                               note: null },
  { label: 'Held-out Test',       value: '94.2% balanced accuracy · AUC 0.98',
    note: 'Unseen images from the same generators as training' },
  { label: 'Unseen Generators',   value: '74.0% balanced accuracy · AUC 0.83',
    note: 'OpenFake test set: catches 94% of fakes, but flags 46% of real photos' },
  { label: 'Unseen Videos',       value: '71.3% balanced accuracy · AUC 0.79',
    note: 'WildDeepfake test set: compressed face swaps from internet video' },
  { label: 'Social-media Images', value: '52.9% balanced accuracy · AUC 0.56',
    note: 'OpenFake Reddit set: most real photos are flagged as AI. Not reliable here' },
  { label: 'Inference Time',      value: '< 1 second',
    note: 'Standard CPU — no GPU required' },
  { label: 'Explainability',      value: 'Alteration map',
    note: 'Trained on the real altered regions of inpainted and face-swapped images' },
  { label: 'Face Preprocessing',  value: 'YuNet face detection → 256 px crop',
    note: 'Largest detected face; the image centre if no face is found' },
];

const sectionVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] } },
};

const tileVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1], delay: 0.06 * i },
  }),
};

const ModelStats = () => (
  <section id="model" className="py-16 sm:py-20" aria-labelledby="model-heading">
    <div className="section-container">
      <motion.div
        variants={sectionVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.12 }}
      >
        {/* Section header */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(91,141,238,0.12)', border: '1px solid rgba(91,141,238,0.18)' }}
          >
            <Cpu style={{ width: 20, height: 20, color: '#5b8dee' }} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow mb-1">Model Specification</p>
            <h2
              id="model-heading"
              className="text-xl font-bold"
              style={{ color: '#f0f2f8', letterSpacing: '-0.02em' }}
            >
              Model Card
            </h2>
          </div>
        </div>

        {/* ── Quick-stat tiles ──────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {QUICK_STATS.map(({ label, value, Icon, color, bg, small }, i) => (
            <motion.div
              key={label}
              custom={i}
              className="flex"
              variants={tileVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
            >
              <TiltCard maxTilt={8} rounded="rounded-2xl" className="p-5 min-h-[120px]">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: bg }}
                >
                  <Icon style={{ width: 18, height: 18, color }} aria-hidden="true" />
                </div>
                <p
                  className={`font-mono font-bold leading-tight mb-1 ${small ? 'text-sm' : 'text-xl'}`}
                  style={{ color }}
                >
                  {value}
                </p>
                <p className="text-xs" style={{ color: '#9eaabb' }}>{label}</p>
              </TiltCard>
            </motion.div>
          ))}
        </div>

        <p className="text-xs mb-4" style={{ color: '#6b7a94' }}>
          * Held-out test images from the generators the model trained on. Scores on unseen generators and real-world images are lower: see below.
        </p>

        {/* ── Full specification table ──────────── */}
        <div
          className="glass rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' }}
        >
          {/* Column headers */}
          <div
            className="hidden sm:grid sm:grid-cols-[200px_1fr] px-6 py-3"
            style={{
              background: 'rgba(255,255,255,0.028)',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            <span className="eyebrow">Parameter</span>
            <span className="eyebrow">Value</span>
          </div>

          {/* Rows */}
          {SPECS.map(({ label, value, note }, i) => (
            <div
              key={label}
              className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-4 px-5 sm:px-6 py-4 transition-colors duration-200"
              style={{
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                borderBottom: i < SPECS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(91,141,238,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
            >
              <span className="text-xs sm:text-sm self-start pt-px uppercase sm:normal-case tracking-wider sm:tracking-normal" style={{ color: '#9eaabb' }}>{label}</span>
              <div>
                <span className="text-sm font-mono" style={{ color: '#f0f2f8' }}>{value}</span>
                {note && (
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: '#6b7a94' }}>{note}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-xs mt-5 leading-relaxed max-w-2xl" style={{ color: '#6b7a94' }}>
          <span style={{ color: '#9eaabb' }}>Note — </span>
          This model is intended for educational and research purposes only.
          It is not a video deepfake detector and is not suitable for forensic,
          legal, or production security applications.
        </p>
      </motion.div>
    </div>
  </section>
);

export default ModelStats;
