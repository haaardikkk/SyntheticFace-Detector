import React, { useRef, useEffect } from 'react';

/**
 * TiltCard — glass card with:
 *   ① 3D tilt on mouse move (direct DOM — zero re-renders)
 *   ② Dynamic glare highlight that tracks the cursor
 *   ③ Gemini border ring — a thin colorful light trail that travels
 *      around the PERIMETER ONLY (not the card interior).
 *
 * The Gemini ring uses CSS @property --gem-angle + mask-composite:exclude
 * so the conic-gradient is visible only in the 1.5px padding border area.
 * No overflow:hidden needed — the card and border are separate layers.
 */
const TiltCard = ({
  children,
  className = '',
  maxTilt   = 7,
  isActive  = false,
  rounded   = 'rounded-2xl',
  style     = {},
}) => {
  const wrapRef    = useRef(null);
  const cardRef    = useRef(null);
  const glareRef   = useRef(null);
  const ringRef    = useRef(null);   // ← Gemini border ring element
  const hoveredRef = useRef(false);

  /* ── Tilt + Glare + Border ring on hover ─── */
  useEffect(() => {
    const card  = cardRef.current;
    const glare = glareRef.current;
    const ring  = ringRef.current;
    if (!card) return;

    const activateRing = () => {
      if (!ring) return;
      ring.style.opacity = '0.85';
      ring.classList.add('is-active');
    };

    const deactivateRing = () => {
      if (!ring || isActive) return;
      ring.style.opacity = '0';
      // Let the opacity transition finish before stopping the animation
      setTimeout(() => {
        if (!hoveredRef.current && !isActive) ring.classList.remove('is-active');
      }, 520);
    };

    const onMove = (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width  - 0.5;
      const y = (e.clientY - r.top)  / r.height - 0.5;

      card.style.transform  = `perspective(900px) rotateX(${-y * maxTilt * 2}deg) rotateY(${x * maxTilt * 2}deg) scale3d(1.018,1.018,1.018)`;
      card.style.transition = 'transform 0.08s linear';

      if (glare) {
        glare.style.opacity    = '1';
        glare.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(255,255,255,0.07) 0%, transparent 65%)`;
      }
    };

    const onEnter = () => {
      hoveredRef.current = true;
      if (!isActive) activateRing();
    };

    const onLeave = () => {
      hoveredRef.current = false;
      card.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
      card.style.transition = 'transform 0.45s cubic-bezier(0.23,1,0.32,1)';
      if (glare) glare.style.opacity = '0';
      deactivateRing();
    };

    card.addEventListener('mousemove',  onMove,  { passive: true });
    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);

    return () => {
      card.removeEventListener('mousemove',  onMove);
      card.removeEventListener('mouseenter', onEnter);
      card.removeEventListener('mouseleave', onLeave);
    };
  }, [maxTilt, isActive]);

  /* ── Sync isActive prop → ring state ──────── */
  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    if (isActive) {
      ring.style.opacity = '0.85';
      ring.classList.add('is-active');
    } else if (!hoveredRef.current) {
      ring.style.opacity = '0';
      setTimeout(() => {
        if (!hoveredRef.current) ring.classList.remove('is-active');
      }, 520);
    }
  }, [isActive]);

  return (
    /*
     * Wrapper layout:
     *   • ringRef div — absolute, inset: -1.5px, .gemini-ring CSS class
     *     (mask-composite makes only the 1.5px border area visible)
     *   • cardRef div — the glass card, sits on top of the ring element
     *
     * We do NOT use overflow:hidden on the wrapper so the 3D tilt is
     * never clipped. The ring is visually contained by the mask.
     */
    <div
      ref={wrapRef}
      className={`relative ${rounded} flex-1`}
    >
      {/* ── Gemini border ring (border area only) ── */}
      <div
        ref={ringRef}
        className="gemini-ring pointer-events-none"
        style={{
          position:     'absolute',
          inset:        '-1.5px',
          borderRadius: 'calc(1rem + 1.5px)',   /* slightly larger than card radius */
          opacity:      isActive ? 0.85 : 0,
          transition:   'opacity 0.5s ease',
          zIndex:       30,
        }}
        aria-hidden="true"
      />

      {/* ── The glass card ───────────────────────── */}
      <div
        ref={cardRef}
        className={`glass ${rounded} relative overflow-hidden h-full flex flex-col ${className}`}
        style={{
          transformStyle: 'preserve-3d',
          willChange: 'transform',
          zIndex: 1,
          ...style,
        }}
      >
        {/* Glare highlight */}
        <div
          ref={glareRef}
          className="absolute inset-0 pointer-events-none"
          style={{
            borderRadius: 'inherit',
            opacity: 0,
            zIndex: 20,
            transition: 'opacity 0.2s ease',
          }}
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  );
};

export default React.memo(TiltCard);
