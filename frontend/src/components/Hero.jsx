import { motion } from 'framer-motion';
import { ChevronRight, ExternalLink } from 'lucide-react';
import ParticleWave from './ParticleWave';

const META = [
  { label: 'Architecture', value: 'EfficientNet-B0'      },
  { label: 'Task',         value: 'Binary Classification' },
  { label: 'Dataset',      value: 'CelebDF + Synthetic'   },
  { label: 'Framework',    value: 'PyTorch 2.x'           },
  { label: 'Version',      value: 'v2.0'                  },
];

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.23, 1, 0.32, 1] } },
};

const Hero = () => {
  return (
    <section
      id="hero"
      className="relative flex items-center justify-center text-center"
      style={{
        minHeight: 'calc(100svh - 80px)',
        paddingTop: '100px',
        paddingBottom: '80px',
        overflow: 'hidden',
      }}
      aria-label="Project overview"
    >
      <ParticleWave />

      <div className="section-container w-full relative z-10 flex flex-col items-center">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-3xl flex flex-col items-center"
        >
          {/* Eyebrow */}
          <motion.div variants={itemVariants}>
            <span className="eyebrow mb-6 block">
              Computer Vision · Binary Classification
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-7xl font-bold leading-[1.08] tracking-tight mb-6"
            style={{ letterSpacing: '-0.025em' }}
          >
            <span className="gradient-text">Synthetic Face</span>
            <br />
            <span className="gradient-text-accent">Detector</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-xl leading-relaxed mb-10 max-w-2xl mx-auto"
            style={{ color: '#9eaabb' }}
          >
            A binary image classifier that determines whether a facial image is a{' '}
            <span style={{ color: '#f0f2f8', fontWeight: 500 }}>real human photograph</span> or an{' '}
            <span style={{ color: '#f0f2f8', fontWeight: 500 }}>AI-generated synthetic face</span>.
            Powered by EfficientNet-B0 with Grad-CAM attention maps.
          </motion.p>

          {/* CTA row */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-4 mb-12">
            <a href="#upload" className="btn-primary" id="hero-cta">
              Run Classifier
              <ChevronRight style={{ width: 16, height: 16 }} aria-hidden="true" />
            </a>
            <a
              href="https://github.com/haaardikkk"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              id="hero-github"
            >
              View on GitHub
              <ExternalLink style={{ width: 14, height: 14 }} aria-hidden="true" />
            </a>
          </motion.div>

          {/* Meta tags */}
          <motion.div
            variants={itemVariants}
            className="flex flex-wrap justify-center gap-3"
            role="list"
            aria-label="Model metadata"
          >
            {META.map(({ label, value }) => (
              <div key={label} className="tag" role="listitem">
                <span style={{ color: '#6b7a94' }}>{label}:</span>
                <span style={{ color: '#5b8dee' }}>{value}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-10"
        style={{ height: 120, background: 'linear-gradient(to bottom, transparent, #07080f)' }}
        aria-hidden="true"
      />
    </section>
  );
};

export default Hero;
