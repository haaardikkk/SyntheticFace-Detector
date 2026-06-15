import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, Image as ImageIcon, X, Loader2, CheckCircle2, Clipboard } from 'lucide-react';
import { predictImage } from '../api';
import TiltCard from './TiltCard';

const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_SIZE_MB  = 10;

function validateFile(file) {
  if (!VALID_TYPES.includes(file.type))
    throw new Error('Please upload a valid image file (JPG, JPEG, or PNG).');
  if (file.size > MAX_SIZE_MB * 1024 * 1024)
    throw new Error(`File size must be less than ${MAX_SIZE_MB} MB.`);
}

const fadeV = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.12 } },
};

const CardHeader = ({ Icon, title, sub }) => (
  <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
         style={{ background: 'rgba(91,141,238,0.12)' }}>
      <Icon className="w-4 h-4" style={{ color: '#5b8dee' }} aria-hidden="true" />
    </div>
    <div>
      <h2 className="text-sm font-semibold" style={{ color: '#f0f2f8', lineHeight: 1.2 }}>{title}</h2>
      <p className="text-xs mt-0.5" style={{ color: '#4a5568' }}>{sub}</p>
    </div>
  </div>
);

const UploadCard = ({
  onImageSelect,
  imagePreview,
  selectedImage,
  onPredictionResult,
  isLoading,
  setIsLoading,
  onReset,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error,      setError]      = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    setError(null);
    try { validateFile(file); } catch (e) { setError(e.message); return; }
    const reader = new FileReader();
    reader.onloadend = () => onImageSelect(file, reader.result);
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) { const f = item.getAsFile(); if (f) handleFile(f); break; }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  const handleDrag   = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragActive(e.type === 'dragenter' || e.type === 'dragover'); }, []);
  const handleDrop   = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }, [handleFile]);
  const handleChange = useCallback((e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }, [handleFile]);
  const handleClick  = useCallback(() => fileInputRef.current?.click(), []);
  const handleRemove = useCallback(() => { onReset(); setError(null); if (fileInputRef.current) fileInputRef.current.value = ''; }, [onReset]);

  const handleAnalyze = useCallback(async () => {
    if (!selectedImage || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await predictImage(selectedImage);
      onPredictionResult(result);
    } catch (err) {
      setError(err.message || 'Classification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedImage, isLoading, setIsLoading, onPredictionResult]);

  return (
    <TiltCard maxTilt={4}>
      <CardHeader Icon={Upload} title="Upload Image" sub="JPG / PNG — max 10 MB" />

      <div className="flex-1 flex flex-col p-4 min-h-0">
        <AnimatePresence mode="wait">
          {!imagePreview ? (
            /* Drop zone */
            <motion.div
              key="drop"
              variants={fadeV}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="button"
              tabIndex={0}
              aria-label="Upload image — click, drag, or paste"
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={handleClick}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
              className="flex-1 flex flex-col items-center justify-center cursor-pointer rounded-xl min-h-[260px] transition-all duration-200 outline-none"
              style={{
                border: dragActive
                  ? '1px dashed rgba(91,141,238,0.6)'
                  : '1px dashed rgba(255,255,255,0.1)',
                background: dragActive
                  ? 'rgba(91,141,238,0.06)'
                  : 'rgba(255,255,255,0.016)',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleChange}
                className="hidden"
                aria-hidden="true"
              />

              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors duration-200"
                   style={{ background: dragActive ? 'rgba(91,141,238,0.15)' : 'rgba(255,255,255,0.04)' }}>
                <ImageIcon className="w-7 h-7 transition-colors duration-200"
                           style={{ color: dragActive ? '#5b8dee' : '#4a5568' }} />
              </div>

              <p className="text-sm font-medium mb-1.5" style={{ color: '#8b96a8' }}>
                {dragActive ? 'Drop to upload' : 'Drag & drop your image'}
              </p>
              <p className="text-xs mb-4" style={{ color: '#4a5568' }}>
                or <span style={{ color: '#5b8dee' }}>click to browse</span>
              </p>
              <div className="flex items-center gap-1.5" style={{ opacity: 0.5 }}>
                <Clipboard className="w-3 h-3" style={{ color: '#4a5568' }} aria-hidden="true" />
                <span className="text-xs" style={{ color: '#4a5568', fontFamily: 'IBM Plex Mono, monospace' }}>Ctrl+V to paste</span>
              </div>
            </motion.div>

          ) : (
            /* Preview */
            <motion.div
              key="preview"
              variants={fadeV}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex-1 flex flex-col gap-3"
            >
              {/* Preview image */}
              <div className="relative group rounded-xl overflow-hidden flex-1 min-h-[200px]"
                   style={{ background: 'rgba(255,255,255,0.03)' }}>
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover absolute inset-0" loading="lazy" />
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                     style={{ background: 'rgba(0,0,0,0.35)' }} />
                <button
                  onClick={handleRemove}
                  aria-label="Remove image"
                  className="absolute top-2.5 right-2.5 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ background: 'rgba(248,113,113,0.85)' }}
                >
                  <X className="w-3.5 h-3.5 text-white" />
                </button>
              </div>

              {/* File info chip */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl flex-shrink-0"
                   style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#4ade80' }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: '#f0f2f8' }}>{selectedImage?.name}</p>
                  <p className="text-xs font-mono" style={{ color: '#4a5568' }}>
                    {selectedImage ? (selectedImage.size / 1024).toFixed(1) : 0} KB
                  </p>
                </div>
              </div>

              {/* Classify button */}
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                aria-busy={isLoading}
                className="btn-primary w-full justify-center flex-shrink-0"
                id="analyze-btn"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /><span>Classifying…</span></>
                ) : 'Classify Image'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            role="alert"
            className="mx-4 mb-4 p-3 rounded-xl text-xs"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </TiltCard>
  );
};

export default React.memo(UploadCard);
