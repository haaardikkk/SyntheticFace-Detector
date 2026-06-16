import React, { useRef, useEffect } from 'react';

const ParticleWave = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const PARTICLE_COUNT = 350;
    const MOUSE_RADIUS = 140;      // How far mouse influence reaches
    const RISE_STRENGTH = 5.5;     // How much particles rise near mouse
    const RISE_SPEED = 0.06;       // Speed at which the rise is applied

    let mouseX = -9999;
    let mouseY = -9999;

    // Build fully randomised particles
    const particles = Array.from({ length: PARTICLE_COUNT }, () => {
      const isBlue = Math.random() > 0.4;
      return {
        // Base position — fully random across the canvas
        bx: Math.random() * width,
        by: Math.random() * height,
        // Current rendered position (starts at base)
        x: Math.random() * width,
        y: Math.random() * height,
        // Individual drift offsets so they don't move in sync
        offsetX: Math.random() * Math.PI * 2,
        offsetY: Math.random() * Math.PI * 2,
        // Drift speed varies slightly per particle
        speedX: 0.18 + Math.random() * 0.14,
        speedY: 0.12 + Math.random() * 0.12,
        // Amplitude of the ambient drift
        ampX: 18 + Math.random() * 22,
        ampY: 12 + Math.random() * 18,
        // Visual properties
        baseRadius: 1.0 + Math.random() * 2.2,
        radius: 1.0 + Math.random() * 2.2,
        baseAlpha: 0.25 + Math.random() * 0.55,
        alpha: 0.25 + Math.random() * 0.55,
        // 0 = blue (#5b8dee), 1 = purple (#8b6cf7)
        isBlue,
        // How much this particle is currently "risen" by the mouse (0–1)
        rise: 0,
      };
    });

    let time = 0;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    let animationFrameId;

    const render = () => {
      ctx.fillStyle = '#07080f';
      ctx.fillRect(0, 0, width, height);

      for (const p of particles) {
        // Ambient drift — each particle floats independently
        const driftX = Math.sin(time * p.speedX + p.offsetX) * p.ampX;
        const driftY = Math.cos(time * p.speedY + p.offsetY) * p.ampY;

        const targetX = p.bx + driftX;
        const targetY = p.by + driftY;

        // Distance from mouse to current rendered position
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetRise = 0;
        if (dist < MOUSE_RADIUS) {
          // Rise is stronger the closer the particle is to the cursor
          targetRise = 1 - dist / MOUSE_RADIUS;
        }

        // Smooth lerp the rise value
        p.rise += (targetRise - p.rise) * RISE_SPEED;

        // When rising, push the particle upward (negative Y) toward cursor
        const riseOffsetY = -p.rise * RISE_STRENGTH * 20;
        const riseOffsetX = dx * p.rise * 0.04; // Slight attraction toward cursor

        // Lerp position smoothly toward target
        p.x += (targetX + riseOffsetX - p.x) * 0.04;
        p.y += (targetY + riseOffsetY - p.y) * 0.04;

        // Particles near the mouse grow and brighten
        p.radius = p.baseRadius + p.rise * 3.5;
        p.alpha = Math.min(1, p.baseAlpha + p.rise * 0.6);

        // Draw glow for risen particles
        if (p.rise > 0.05) {
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 5);
          if (p.isBlue) {
            gradient.addColorStop(0, `rgba(91, 141, 238, ${p.rise * 0.25})`);
          } else {
            gradient.addColorStop(0, `rgba(139, 108, 247, ${p.rise * 0.25})`);
          }
          gradient.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 5, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        // Draw the dot itself
        const r = p.isBlue ? 91 : 139;
        const g = p.isBlue ? 141 : 108;
        const b = p.isBlue ? 238 : 247;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
        ctx.fill();
      }

      time += 0.012;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      style={{ display: 'block', zIndex: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    />
  );
};

export default ParticleWave;
