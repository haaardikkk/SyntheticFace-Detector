import React, { useState, useEffect } from 'react';
import { Github, Linkedin, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Logo from './Logo';

const NAV_LINKS = [
  { label: 'Classifier', href: '#upload' },
  { label: 'Model Card', href: '#model'  },
  { label: 'About',      href: '#about'  },
];

const EXTERNAL = [
  { label: 'GitHub',   href: 'https://github.com/haaardikkk',      Icon: Github   },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/haaardikkk', Icon: Linkedin },
];

/**
 * Floating glass pill navbar — refined for size, contrast and substance.
 */
const Navbar = () => {
  const [scrolled,   setScrolled]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkHoverOn  = e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)');
  const linkHoverOff = e => (e.currentTarget.style.background = 'transparent');

  return (
    <>
      {/* ── Desktop floating pill ───────────────── */}
      <div className="hidden sm:flex fixed top-5 left-0 right-0 z-50 justify-center px-6">
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          aria-label="Main navigation"
          className="glass-hi rounded-2xl flex items-center px-5 max-w-3xl w-full"
          style={{
            height: '60px',
            gap: '2px',
            boxShadow: scrolled
              ? '0 12px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.12)'
              : '0 4px 24px rgba(0,0,0,0.4), inset 0  1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Logo */}
          <a href="#" className="flex-shrink-0 mr-6" aria-label="Home" style={{ display: 'flex', alignItems: 'center' }}>
            <Logo />
          </a>

          {/* Nav links */}
          <div className="flex items-center gap-0.5 flex-1">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-sm font-medium px-3 py-2 rounded-xl transition-colors duration-150"
                style={{ color: '#9eaabb', transitionProperty: 'color, background' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#f0f2f8'; linkHoverOn(e); }}
                onMouseLeave={e => { e.currentTarget.style.color = '#9eaabb'; linkHoverOff(e); }}
              >
                {label}
              </a>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0, margin: '0 10px' }} />

          {/* External links */}
          {EXTERNAL.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition-colors duration-150 flex-shrink-0"
              style={{ color: '#9eaabb', fontSize: '0.8125rem', fontWeight: 500 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#f0f2f8'; linkHoverOn(e); }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9eaabb'; linkHoverOff(e); }}
            >
              <Icon style={{ width: 14, height: 14 }} aria-hidden="true" />
              <span>{label}</span>
            </a>
          ))}
        </motion.nav>
      </div>

      {/* ── Mobile slim top bar ─────────────────── */}
      <div
        className="sm:hidden fixed top-0 inset-x-0 z-50"
        style={{
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          background: 'rgba(7,8,15,0.88)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center h-16 px-5">
          <a href="#" aria-label="Home"><Logo /></a>
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="ml-auto transition-colors duration-150"
            style={{ color: '#9eaabb' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#f0f2f8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9eaabb')}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X style={{ width: 20, height: 20 }} /> : <Menu style={{ width: 20, height: 20 }} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="sm:hidden fixed top-16 inset-x-0 z-40 px-4 pb-4"
          >
            <div className="glass rounded-2xl p-3 space-y-0.5">
              {NAV_LINKS.map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors duration-150"
                  style={{ color: '#9eaabb' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f0f2f8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9eaabb'; e.currentTarget.style.background = 'transparent'; }}
                >
                  {label}
                </a>
              ))}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '6px 16px' }} />
              {EXTERNAL.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors duration-150"
                  style={{ color: '#9eaabb' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f0f2f8'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9eaabb'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <Icon style={{ width: 16, height: 16 }} aria-hidden="true" />
                  {label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default React.memo(Navbar);
