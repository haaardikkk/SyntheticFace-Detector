import { useState, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScanLine, Eye, BarChart2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import UploadCard from '../components/UploadCard';
import PredictionCard from '../components/PredictionCard';
import ConfidenceGauge from '../components/ConfidenceGauge';
import HeatmapCard from '../components/HeatmapCard';
import ModelStats from '../components/ModelStats';
import Footer from '../components/Footer';
import GridBackground from '../components/GridBackground';

const EASE = [0.23, 1, 0.32, 1];

/**
 * PlaceholderCard — glass card shown before predictions exist.
 * Matches the dimensions and structure of the real result cards,
 * giving the page correct height and visual balance.
 * Subtle breathe animation on the icon.
 */
const PlaceholderCard = ({ Icon, title, sub, iconColor = '#6b7a94', accentBg = 'rgba(255,255,255,0.04)' }) => (
  <div
    className="glass rounded-2xl flex flex-col"
    style={{ minHeight: '280px' }}
    aria-hidden="true"
  >
    {/* Skeleton header */}
    <div
      className="flex items-center gap-3 px-5 py-4"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div
        className="w-8 h-8 rounded-xl flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.03)' }}
      />
      <div className="space-y-1.5">
        <div style={{ height: 10, width: 130, borderRadius: 4, background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ height: 8,  width: 90,  borderRadius: 4, background: 'rgba(255,255,255,0.03)' }} />
      </div>
    </div>

    {/* Centered placeholder */}
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <motion.div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: accentBg, border: '1px dashed rgba(255,255,255,0.09)' }}
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Icon style={{ width: 22, height: 22, color: iconColor }} aria-hidden="true" />
      </motion.div>
      <p className="text-sm font-medium mb-1.5" style={{ color: '#6b7a94' }}>{title}</p>
      <p className="text-xs" style={{ color: '#4a5568', maxWidth: '160px', lineHeight: 1.5 }}>{sub}</p>
    </div>
  </div>
);

const PLACEHOLDERS = [
  {
    key:      'pred',
    Icon:     ScanLine,
    title:    'Awaiting classification',
    sub:      'Upload an image and run the classifier',
    iconColor: '#6b7a94',
    accentBg:  'rgba(91,141,238,0.06)',
  },
  {
    key:      'heat',
    Icon:     Eye,
    title:    'Grad-CAM map',
    sub:      'Generated after classification completes',
    iconColor: '#6b7a94',
    accentBg:  'rgba(56,189,248,0.06)',
  },
  {
    key:      'conf',
    Icon:     BarChart2,
    title:    'Confidence score',
    sub:      'Model certainty shown here',
    iconColor: '#6b7a94',
    accentBg:  'rgba(139,108,247,0.06)',
  },
];

const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
  exit:    { opacity: 0, transition: { duration: 0.18 } },
};

const Home = () => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview,  setImagePreview]  = useState(null);
  const [prediction,    setPrediction]    = useState(null);
  const [isLoading,     setIsLoading]     = useState(false);

  const handleImageSelect      = useCallback((f, p) => { setSelectedImage(f); setImagePreview(p); setPrediction(null); }, []);
  const handlePredictionResult = useCallback((r) => setPrediction(r), []);
  const handleReset            = useCallback(() => { setSelectedImage(null); setImagePreview(null); setPrediction(null); setIsLoading(false); }, []);

  const hasPrediction = useMemo(() => Boolean(prediction), [prediction]);

  return (
    <div className="min-h-screen" style={{ background: '#07080f' }}>
      <GridBackground />

      <div className="relative z-10">
        <Navbar />

        {/* Spacer for fixed navbar */}
        <div className="hidden sm:block" style={{ height: '80px' }} aria-hidden="true" />
        <div className="sm:hidden"       style={{ height: '64px' }} aria-hidden="true" />

        <main>
          <Hero />

          {/* ── Classifier section ───────────────── */}
          <section id="upload" className="py-14 sm:py-16" aria-label="Run classifier">
            <div className="section-container">

              {/* Section heading */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="mb-8"
              >
                <p className="eyebrow mb-2">Inference</p>
                <h2
                  className="text-xl font-bold mb-2"
                  style={{ color: '#f0f2f8', letterSpacing: '-0.02em' }}
                >
                  Run Classifier
                </h2>
                <p className="text-sm max-w-lg" style={{ color: '#9eaabb' }}>
                  Upload a facial image to classify it as real or AI-generated.
                  Clear, front-facing portraits produce the most reliable results.
                </p>
              </motion.div>

              {/* 2×2 card grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Upload */}
                <UploadCard
                  onImageSelect={handleImageSelect}
                  imagePreview={imagePreview}
                  selectedImage={selectedImage}
                  onPredictionResult={handlePredictionResult}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onReset={handleReset}
                />

                {/* Prediction */}
                <AnimatePresence mode="wait">
                  {hasPrediction ? (
                    <motion.div key="pred" {...fadeIn} className="flex flex-col">
                      <PredictionCard prediction={prediction} />
                    </motion.div>
                  ) : (
                    <motion.div key="pred-ph" {...fadeIn} className="flex flex-col">
                      <PlaceholderCard {...PLACEHOLDERS[0]} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Heatmap */}
                <AnimatePresence mode="wait">
                  {hasPrediction ? (
                    <motion.div key="heat" {...fadeIn}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE, delay: 0.06 } }}
                      className="flex flex-col"
                    >
                      <HeatmapCard heatmap={prediction.heatmap} originalPreview={imagePreview} />
                    </motion.div>
                  ) : (
                    <motion.div key="heat-ph" {...fadeIn} className="flex flex-col">
                      <PlaceholderCard {...PLACEHOLDERS[1]} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Confidence */}
                <AnimatePresence mode="wait">
                  {hasPrediction ? (
                    <motion.div key="conf" {...fadeIn}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE, delay: 0.12 } }}
                      className="flex flex-col"
                    >
                      <ConfidenceGauge confidence={prediction.confidence} />
                    </motion.div>
                  ) : (
                    <motion.div key="conf-ph" {...fadeIn} className="flex flex-col">
                      <PlaceholderCard {...PLACEHOLDERS[2]} />
                    </motion.div>
                  )}
                </AnimatePresence>

              </div>
            </div>
          </section>

          {/* Gradient section divider */}
          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)',
              margin: '0 2.5rem',
            }}
          />

          <ModelStats />

          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.06) 70%, transparent)',
              margin: '0 2.5rem',
            }}
          />
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default Home;
