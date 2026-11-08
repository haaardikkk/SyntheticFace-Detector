import { useState, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ScanLine, Eye, BarChart2, Image as ImageIcon, Layers, GitCompare } from 'lucide-react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import UploadCard from '../components/UploadCard';
import PredictionCard from '../components/PredictionCard';
import ConfidenceGauge from '../components/ConfidenceGauge';
import HeatmapCard from '../components/HeatmapCard';
import ModelStats from '../components/ModelStats';
import VersionTable from '../components/VersionTable';
import Footer from '../components/Footer';
import GridBackground from '../components/GridBackground';
import BatchPanel from '../components/BatchPanel';
import ComparePanel from '../components/ComparePanel';
import { fetchModels } from '../api';
import { faceView } from '../verdict';

const EASE = [0.23, 1, 0.32, 1];

/**
 * PlaceholderCard — glass card shown before predictions exist.
 * Matches the dimensions and structure of the real result cards,
 * giving the page correct height and visual balance.
 * Subtle breathe animation on the icon.
 */
const PlaceholderCard = ({ Icon, title, sub, iconColor = '#6b7a94', accentBg = 'rgba(255,255,255,0.04)' }) => (
  <div
    className="glass rounded-2xl flex flex-col flex-1"
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
    id:       'pred',
    Icon:     ScanLine,
    title:    'Awaiting classification',
    sub:      'Upload an image and run the classifier',
    iconColor: '#6b7a94',
    accentBg:  'rgba(91,141,238,0.06)',
  },
  {
    id:       'heat',
    Icon:     Eye,
    title:    'Alteration map',
    sub:      'Generated after classification completes',
    iconColor: '#6b7a94',
    accentBg:  'rgba(56,189,248,0.06)',
  },
  {
    id:       'conf',
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

const MODES = [
  { id: 'single',  label: 'Single image',   short: 'Single',  Icon: ImageIcon  },
  { id: 'batch',   label: 'Batch',          short: 'Batch',   Icon: Layers     },
  { id: 'compare', label: 'Compare models', short: 'Compare', Icon: GitCompare },
];

const Home = () => {
  const [mode,          setMode]          = useState('single');
  const [models,        setModels]        = useState([]);
  const [defaultModel,  setDefaultModel]  = useState(null);
  const [model,         setModel]         = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview,  setImagePreview]  = useState(null);
  const [result,        setResult]        = useState(null);
  const [selectedFace,  setSelectedFace]  = useState(0);
  const [isLoading,     setIsLoading]     = useState(false);

  // The model list is a nice-to-have: if it fails, the backend's default model is used
  useEffect(() => {
    fetchModels()
      .then(({ default: d, models: list }) => { setModels(list); setDefaultModel(d); setModel(d); })
      .catch(() => {});
  }, []);

  const handleImageSelect      = useCallback((f, p) => { setSelectedImage(f); setImagePreview(p); setResult(null); }, []);
  const handlePredictionResult = useCallback((r) => { setResult(r); setSelectedFace(r.primary_face ?? 0); }, []);
  const handleReset            = useCallback(() => { setSelectedImage(null); setImagePreview(null); setResult(null); setIsLoading(false); }, []);
  const handleModelChange      = useCallback((e) => { setModel(e.target.value); setResult(null); }, []);

  const [downloading, setDownloading] = useState(false);
  const handleDownload = useCallback(async () => {
    if (!result || !imagePreview) return;
    setDownloading(true);
    try {
      const { downloadReport } = await import('../report');
      await downloadReport({ result, imageSrc: imagePreview, fileName: selectedImage?.name, selectedFace });
    } catch (err) {
      console.error('PDF report failed', err);
      window.alert('Sorry, the PDF report could not be created.');
    } finally {
      setDownloading(false);
    }
  }, [result, imagePreview, selectedImage, selectedFace]);

  const prediction    = faceView(result, selectedFace);
  const hasPrediction = Boolean(result);

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
                  Upload a face image to check whether it is real, AI-generated or AI-altered.
                  Clear, front-facing portraits produce the most reliable results.
                </p>
              </motion.div>

              {/* Mode tabs + model picker */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div role="tablist" aria-label="Classifier mode" className="glass rounded-xl p-1 flex gap-1 max-w-full">
                  {MODES.map(({ id, label, short, Icon }) => (
                    <button
                      key={id}
                      role="tab"
                      type="button"
                      aria-selected={mode === id}
                      onClick={() => setMode(id)}
                      className="flex items-center gap-2 text-sm px-3.5 py-2 rounded-lg whitespace-nowrap transition-colors duration-150"
                      style={{
                        color: mode === id ? '#f0f2f8' : '#9eaabb',
                        background: mode === id ? 'rgba(91,141,238,0.18)' : 'transparent',
                      }}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      <span className="hidden sm:inline">{label}</span>
                      <span className="sm:hidden">{short}</span>
                    </button>
                  ))}
                </div>
                {mode !== 'compare' && models.length > 1 && (
                  <label className="flex items-center gap-2 text-xs" style={{ color: '#9eaabb' }}>
                    Model
                    <select
                      value={model ?? ''}
                      onChange={handleModelChange}
                      className="glass rounded-lg text-sm px-3 py-2 font-mono outline-none"
                      style={{ color: '#f0f2f8', background: 'rgba(17,19,30,0.9)' }}
                    >
                      {models.map((m) => (
                        <option key={m.version} value={m.version}>{m.name ?? m.version}{m.version === defaultModel ? ' (default)' : ''}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {mode === 'batch' && <BatchPanel model={model} />}
              {mode === 'compare' && <ComparePanel models={models} defaultModel={defaultModel} />}

              {/* 2×2 card grid */}
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-5 ${mode === 'single' ? '' : 'hidden'}`}>

                {/* Upload */}
                <UploadCard
                  onImageSelect={handleImageSelect}
                  imagePreview={imagePreview}
                  selectedImage={selectedImage}
                  onPredictionResult={handlePredictionResult}
                  isLoading={isLoading}
                  setIsLoading={setIsLoading}
                  onReset={handleReset}
                  model={model}
                  faces={result?.faces ?? []}
                  selectedFace={selectedFace}
                  onSelectFace={setSelectedFace}
                />

                {/* Prediction */}
                <AnimatePresence mode="wait">
                  {hasPrediction ? (
                    <motion.div key="pred" {...fadeIn} className="flex flex-col">
                      <PredictionCard prediction={prediction} faces={result.faces ?? []} selectedFace={selectedFace} onSelectFace={setSelectedFace}
                        onDownload={handleDownload} downloading={downloading} />
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
                      <HeatmapCard heatmap={prediction.heatmap} originalPreview={imagePreview} kind={prediction.heatmap_kind} />
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
                      <ConfidenceGauge confidence={prediction.confidence} prediction={prediction.prediction} />
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

          <VersionTable />

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
