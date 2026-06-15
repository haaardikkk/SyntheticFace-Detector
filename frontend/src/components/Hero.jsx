import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ExternalLink } from 'lucide-react';

const CHECK_PATH = 'M 80 310 L 360 540 L 920 80';

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

/**
 * Hero — checkmark reveal improved:
 *  • Base layer slightly more visible (4% → 5%)
 *  • Reveal mask uses a softer gradient with a solid inner zone
 *  • Tiny radial cursor glow follows mouse for depth
 *  • All via direct DOM — zero rerenders
 */
const Hero = () => {
  const heroRef    = useRef(null);
  const revealRef  = useRef(null);
  const cursorGlow = useRef(null);

  useEffect(() => {
    const hero   = heroRef.current;
    const reveal = revealRef.current;
    const glow   = cursorGlow.current;
    if (!hero || !reveal) return;

    const onMove = (e) => {
      const rect = hero.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      /* Softer reveal — solid centre, gentle fade out */
      const mask = `radial-gradient(circle 340px at ${x}px ${y}px, black 0%, black 25%, transparent 85%)`;
      reveal.style.WebkitMaskImage = mask;
      reveal.style.maskImage       = mask;
      reveal.style.opacity         = '1';

      /* Ambient cursor glow */
      if (glow) {
        glow.style.transform = `translate(${x - 120}px, ${y - 120}px)`;
        glow.style.opacity   = '1';
      }
    };

    const onLeave = () => {
      reveal.style.opacity = '0';
      if (glow) glow.style.opacity = '0';
    };

    hero.addEventListener('mousemove',  onMove,  { passive: true });
    hero.addEventListener('mouseleave', onLeave);

    return () => {
      hero.removeEventListener('mousemove',  onMove);
      hero.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <section
      ref={heroRef}
      id="hero"
      className="relative flex items-center"
      style={{
        minHeight: 'calc(100svh - 80px)',
        paddingTop: '100px',
        paddingBottom: '80px',
        overflow: 'hidden',
      }}
      aria-label="Project overview"
    >
      {/* ── Checkmark background ─────────────────── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">

        {/* Base layer — always visible, slightly brighter than before */}
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.05 }}
        >
          <path
            d={CHECK_PATH}
            stroke="white"
            strokeWidth="72"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Reveal layer — accent blue, revealed around cursor */}
        <svg
          ref={revealRef}
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: 0,
            transition: 'opacity 0.35s ease',
            maskImage: 'none',
            WebkitMaskImage: 'none',
          }}
        >
          <path
            d={CHECK_PATH}
            stroke="#5b8dee"
            strokeWidth="72"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 28px rgba(91,141,238,0.8))' }}
          />
        </svg>

        {/* Ambient cursor glow — adds depth around the cursor position */}
        <div
          ref={cursorGlow}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, left: 0,
            width: 240, height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(91,141,238,0.08) 0%, transparent 70%)',
            opacity: 0,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease',
            /* transform is set via JS */
          }}
        />
      </div>

      {/* ── Content ───────────────────────────────── */}
      <div className="section-container w-full relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-2xl"
        >
          {/* Eyebrow */}
          <motion.div variants={itemVariants}>
            <span className="eyebrow mb-5 block">
              Computer Vision · Binary Classification
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-6xl font-bold leading-[1.08] tracking-tight mb-5"
            style={{ letterSpacing: '-0.025em' }}
          >
            <span className="gradient-text">Synthetic Face</span>
            <br />
            <span className="gradient-text-accent">Detector</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={itemVariants}
            className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl"
            style={{ color: '#9eaabb' }}
          >
            A binary image classifier that determines whether a facial image is a{' '}
            <span style={{ color: '#f0f2f8', fontWeight: 500 }}>real human photograph</span> or an{' '}
            <span style={{ color: '#f0f2f8', fontWeight: 500 }}>AI-generated synthetic face</span>.
            Powered by EfficientNet-B0 with Grad-CAM attention maps.
          </motion.p>

          {/* CTA row */}
          <motion.div variants={itemVariants} className="flex flex-wrap gap-3 mb-10">
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
            className="flex flex-wrap gap-2"
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
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{ height: 120, background: 'linear-gradient(to bottom, transparent, #07080f)' }}
        aria-hidden="true"
      />
    </section>
  );
};

export default Hero;
