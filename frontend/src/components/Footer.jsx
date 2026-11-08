import { Github, Linkedin, ExternalLink, AlertTriangle, Plus, BookOpen } from 'lucide-react';
import Logo from './Logo';

/**
 * Footer — technical project documentation in premium glass panels.
 * All content preserved. Presentation improved with structured panels.
 */

const TECH = [
  'React 18', 'Vite', 'TailwindCSS', 'Framer Motion',
  'FastAPI', 'PyTorch', 'timm', 'ConvNeXt', 'OpenCV', 'Pillow',
];

const LIMITATIONS = [
  'Single images only: not a video deepfake detector',
  'Real social-media photos: v4 accepts 53% (v3: 10%), so some are still flagged as AI',
  'Generators it never saw in training: AUC 0.80, lower than on known ones (0.97)',
  'Faces smaller than 40 px are not detected; the image centre is analysed instead',
  'Not suitable for legal, forensic, or production security use cases',
];

const FUTURE = [
  'Further cut false alarms on real social-media photos',
  'Video deepfake detection, frame by frame',
  'Shareable result reports',
];

/* ── Shared glass panel ────────────────────────── */
const Panel = ({ children, className = '' }) => (
  <div
    className={`glass rounded-2xl p-6 ${className}`}
    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.3)' }}
  >
    {children}
  </div>
);

/* ── Section heading ───────────────────────────── */
const PanelLabel = ({ children }) => (
  <p className="eyebrow mb-3">{children}</p>
);

const Footer = () => (
  <footer id="about" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} aria-label="About and documentation">

    <div className="section-container py-16 sm:py-20">

      <div className="mb-8">
        <p className="eyebrow mb-2">Project Documentation</p>
        <h2 className="text-xl font-bold" style={{ color: '#f0f2f8', letterSpacing: '-0.02em' }}>
          About This Project
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Left column ── 2 panels stacked */}
        <div className="md:col-span-2 space-y-4">

          {/* Problem & Dataset — two-column inside */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Panel>
              <PanelLabel>Problem Statement</PanelLabel>
              <p className="text-sm leading-relaxed" style={{ color: '#9eaabb' }}>
                With the rapid advancement of generative AI, synthetic faces produced by GANs and
                diffusion models are increasingly indistinguishable from real photographs. This tool
                automates that distinction using a trained classifier —{' '}
                <span style={{ color: '#f0f2f8' }}>not a forensic deepfake detector.</span>
              </p>
            </Panel>

            <Panel>
              <PanelLabel>Dataset</PanelLabel>
              <p className="text-sm leading-relaxed" style={{ color: '#9eaabb' }}>
                Trained on{' '}
                <span style={{ color: '#f0f2f8', fontWeight: 500 }}>182k face crops</span> from DeepFakeFace,
                FFHQ, CelebA-HQ, WildDeepfake and Reddit (real), and Stable Diffusion, inpainting, face swaps, Flux,
                SDXL, DALL-E 3, StyleGAN and{' '}
                <span style={{ color: '#f0f2f8', fontWeight: 500 }}>OpenFake</span> generators (AI-made).
              </p>
            </Panel>
          </div>

          {/* Architecture */}
          <Panel>
            <PanelLabel>Architecture</PanelLabel>
            <p className="text-sm leading-relaxed" style={{ color: '#9eaabb' }}>
              <span style={{ color: '#f0f2f8', fontWeight: 500 }}>ConvNeXt-Tiny</span> with two outputs: a
              real-vs-AI score, and an alteration map from a feature-pyramid decoder trained on the altered
              regions of inpainted and face-swapped images. Scores are calibrated on validation data.
            </p>
          </Panel>

          {/* Limitations + Future — side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Panel>
              <PanelLabel>Known Limitations</PanelLabel>
              <ul className="space-y-2.5">
                {LIMITATIONS.map(l => (
                  <li key={l} className="flex items-start gap-2.5 text-sm" style={{ color: '#9eaabb' }}>
                    <AlertTriangle
                      style={{ width: 13, height: 13, color: '#fbbf24', flexShrink: 0, marginTop: 3 }}
                      aria-hidden="true"
                    />
                    {l}
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <PanelLabel>Future Improvements</PanelLabel>
              <ul className="space-y-2.5">
                {FUTURE.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#9eaabb' }}>
                    <Plus
                      style={{ width: 13, height: 13, color: '#5b8dee', flexShrink: 0, marginTop: 3 }}
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {/* Technologies */}
          <Panel>
            <PanelLabel>Technologies</PanelLabel>
            <div className="flex flex-wrap gap-2">
              {TECH.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
          </Panel>
        </div>

        {/* Right column ── Developer info panel */}
        <div>
          <Panel className="h-full">
            <div className="flex items-center gap-3 mb-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(91,141,238,0.12)' }}
              >
                <BookOpen style={{ width: 16, height: 16, color: '#5b8dee' }} aria-hidden="true" />
              </div>
              <div>
                <p className="eyebrow">Developer</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: '#f0f2f8' }}>Hardik</p>
              </div>
            </div>

            <div className="space-y-5">
              {[
                { k: 'Purpose',       v: 'ML portfolio / research project' },
                { k: 'Last Updated',  v: 'November 2026', mono: true       },
                { k: 'Model Version', v: 'v4.0',         mono: true         },
                { k: 'License',       v: 'MIT'                              },
              ].map(({ k, v, mono }) => (
                <div key={k}>
                  <p className="eyebrow mb-1">{k}</p>
                  <p className={`text-sm ${mono ? 'font-mono' : ''}`} style={{ color: '#9eaabb' }}>{v}</p>
                </div>
              ))}
            </div>

            <div
              className="mt-6 pt-5 space-y-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              {[
                { label: 'github.com/haaardikkk',      href: 'https://github.com/haaardikkk',      Icon: Github   },
                { label: 'linkedin.com/in/haaardikkk', href: 'https://linkedin.com/in/haaardikkk', Icon: Linkedin },
              ].map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover-link flex items-center gap-2.5 text-sm py-0.5"
                  style={{ color: '#9eaabb' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f0f2f8')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9eaabb')}
                >
                  <Icon style={{ width: 15, height: 15, flexShrink: 0 }} aria-hidden="true" />
                  <span>{label}</span>
                  <ExternalLink style={{ width: 11, height: 11, marginLeft: 'auto', opacity: 0.4 }} aria-hidden="true" />
                </a>
              ))}
            </div>
          </Panel>
        </div>

      </div>
    </div>

    {/* Bottom bar */}
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="section-container py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Logo />

        {/* Made with love */}
        <p className="text-xs flex items-center gap-2" style={{ color: '#9eaabb' }}>
          Made with{' '}
          <span style={{ color: '#f87171' }} aria-label="love">❤️</span>
          {' '}by{' '}
          <a
            href="https://linkedin.com/in/haaardikkk"
            target="_blank"
            rel="noopener noreferrer"
            className="hover-link font-medium"
            style={{ color: '#5b8dee' }}
          >
            Hardik
          </a>
          <span style={{ color: '#4a5568', margin: '0 2px' }}>·</span>
          <a
            href="https://github.com/haaardikkk"
            target="_blank"
            rel="noopener noreferrer"
            className="hover-link flex items-center gap-1"
            style={{ color: '#9eaabb' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f0f2f8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9eaabb')}
          >
            <Github style={{ width: 12, height: 12 }} aria-hidden="true" />
            GitHub
          </a>
          <span style={{ color: '#4a5568', margin: '0 2px' }}>·</span>
          <a
            href="https://linkedin.com/in/haaardikkk"
            target="_blank"
            rel="noopener noreferrer"
            className="hover-link flex items-center gap-1"
            style={{ color: '#9eaabb' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f0f2f8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9eaabb')}
          >
            <Linkedin style={{ width: 12, height: 12 }} aria-hidden="true" />
            LinkedIn
          </a>
        </p>

        <p className="text-xs text-center" style={{ color: '#6b7a94' }}>
          © {new Date().getFullYear()} · MIT License
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
