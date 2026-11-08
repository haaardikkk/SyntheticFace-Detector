import React, { useEffect, useRef, useState } from 'react';
import { verdictOf } from '../verdict';

/**
 * An image fitted inside its box (like object-contain), with numbered, clickable face boxes.
 * The boxes are placed on the image's real on-screen rectangle, so they line up at any size.
 */
const FaceImage = ({ src, alt, faces = [], selected = 0, onSelect, className = '' }) => {
  const frameRef = useRef(null);
  const [natural, setNatural] = useState(null);
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const observer = new window.ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setFrame({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let rect = null;
  if (natural && frame) {
    const scale = Math.min(frame.width / natural.width, frame.height / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    rect = { width, height, left: (frame.width - width) / 2, top: (frame.height - height) / 2 };
  }
  const boxed = faces.filter((f) => f.box);

  return (
    <div ref={frameRef} className={`relative w-full h-full ${className}`}>
      {rect && (
        <div className="absolute" style={rect}>
          <img
            src={src}
            alt={alt}
            className="w-full h-full"
            onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
          />
          {boxed.length > 0 && faces.map((face, i) => {
            if (!face.box) return null;
            const [x, y, w, h] = face.box;
            const { color } = verdictOf(face.prediction);
            const active = i === selected;
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelect?.(i); }}
                aria-label={`Face ${i + 1}: ${face.prediction}, ${face.confidence}%`}
                aria-pressed={active}
                className="absolute rounded-md transition-shadow duration-150 focus:outline-none"
                style={{
                  left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`,
                  border: `${active ? 2.5 : 1.5}px solid ${color}`,
                  boxShadow: active ? `0 0 0 3px ${color}40, 0 0 18px ${color}80` : 'none',
                  cursor: onSelect ? 'pointer' : 'default',
                }}
              >
                <span
                  className="absolute -top-2.5 -left-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold"
                  style={{ background: color, color: '#07080f' }}
                >
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {/* Measures the image's natural size before the fitted rectangle exists */}
      {!natural && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute opacity-0 pointer-events-none"
          onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
        />
      )}
    </div>
  );
};

export default React.memo(FaceImage);
