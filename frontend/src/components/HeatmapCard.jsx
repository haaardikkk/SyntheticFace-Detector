import React from 'react';
import { motion } from 'framer-motion';
import { ImageOff, Eye } from 'lucide-react';
import TiltCard from './TiltCard';

/**
 * HeatmapCard — side-by-side input / attention map.
 * Glass TiltCard with premium panel styling.
 */

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: 'easeOut' } },
};

const copy = {
  title: 'Alteration Map',
  subtitle: 'Regions the model believes were generated or altered',
  panel: 'Altered regions',
  alt: 'Altered regions overlay',
  caption: 'Warmer regions are more likely AI-made or altered. No colour means nothing was flagged.',
  missing: 'The map could not be generated for this image.',
};

const HeatmapCard = ({ heatmap, originalPreview }) => {
  return (
  <TiltCard maxTilt={5}>
    {/* Header */}
    <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: 'rgba(56,189,248,0.12)' }}>
        <Eye className="w-4 h-4" style={{ color: '#38bdf8' }} aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-sm font-semibold" style={{ color: '#f0f2f8', lineHeight: 1.2 }}>{copy.title}</h2>
        <p className="text-xs mt-0.5" style={{ color: '#6b7a94' }}>
          {copy.subtitle}
        </p>
      </div>
    </div>

    {/* Image panels */}
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 grid grid-cols-2 min-h-0"
      style={{ minHeight: 200 }}
    >
      {/* Input */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col p-3"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <p className="eyebrow mb-2">Input</p>
        <div
          className="relative flex-1 rounded-xl overflow-hidden min-h-[140px]"
          style={{ background: 'rgba(255,255,255,0.025)' }}
        >
          {originalPreview && (
            <img
              src={originalPreview}
              alt="Original uploaded image"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>
      </motion.div>

      {/* Attention */}
      <motion.div variants={itemVariants} className="flex flex-col p-3">
        <p className="eyebrow mb-2">{copy.panel}</p>
        <div
          className="relative flex-1 rounded-xl overflow-hidden min-h-[140px] flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.025)' }}
        >
          {heatmap ? (
            <img
              src={`data:image/png;base64,${heatmap}`}
              alt={copy.alt}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center p-3">
              <ImageOff className="w-5 h-5" style={{ color: '#6b7a94' }} aria-hidden="true" />
              <p className="text-xs" style={{ color: '#6b7a94' }}>Not available</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>

    {/* Caption */}
    <motion.p
      variants={itemVariants}
      className="px-5 py-3 text-xs leading-relaxed"
      style={{ color: '#6b7a94', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      {heatmap ? copy.caption : copy.missing}
    </motion.p>
  </TiltCard>
  );
};

export default React.memo(HeatmapCard);
