import React from 'react';

const Logo = ({ compact = false }) => (
  <div className="flex items-center gap-2.5 no-select" style={{ flexShrink: 0 }}>
    <img
      src="/logo.png"
      alt=""
      width={20}
      height={20}
      draggable={false}
      style={{ opacity: 0.85 }}
    />
    {!compact && (
      <span className="text-sm font-semibold tracking-tight"
            style={{ color: '#f0f2f8', letterSpacing: '-0.01em' }}>
        Synthetic<span style={{ color: '#5b8dee' }}>Face</span>Detect
      </span>
    )}
  </div>
);

export default React.memo(Logo);
