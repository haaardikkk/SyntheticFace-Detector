import React, { useCallback, useRef, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
export const MAX_SIZE_MB = 10;

/** Returns an error message, or null when the file can be uploaded. */
export const fileProblem = (file) => {
  if (!VALID_TYPES.includes(file.type)) return `${file.name}: please use a JPG, PNG or WebP image.`;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) return `${file.name}: larger than ${MAX_SIZE_MB} MB.`;
  return null;
};

/** Click-or-drop area. Calls onFiles with the chosen File objects. */
const DropZone = ({ onFiles, multiple = false, title, hint, minHeight = 200 }) => {
  const [active, setActive] = useState(false);
  const inputRef = useRef(null);
  const open = useCallback(() => inputRef.current?.click(), []);
  const onDrag = useCallback((e) => { e.preventDefault(); e.stopPropagation(); setActive(e.type === 'dragenter' || e.type === 'dragover'); }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault(); e.stopPropagation(); setActive(false);
    const files = [...(e.dataTransfer.files || [])];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  }, [onFiles, multiple]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()}
      onDragEnter={onDrag}
      onDragLeave={onDrag}
      onDragOver={onDrag}
      onDrop={onDrop}
      className="flex flex-col items-center justify-center text-center cursor-pointer rounded-xl transition-colors duration-200 outline-none px-4"
      style={{
        minHeight,
        border: `1px dashed ${active ? 'rgba(91,141,238,0.6)' : 'rgba(255,255,255,0.1)'}`,
        background: active ? 'rgba(91,141,238,0.06)' : 'rgba(255,255,255,0.016)',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={VALID_TYPES.join(',')}
        className="hidden"
        aria-hidden="true"
        onChange={(e) => { const files = [...(e.target.files || [])]; if (files.length) onFiles(files); e.target.value = ''; }}
      />
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
           style={{ background: active ? 'rgba(91,141,238,0.15)' : 'rgba(255,255,255,0.04)' }}>
        <ImageIcon className="w-6 h-6" style={{ color: active ? '#5b8dee' : '#4a5568' }} aria-hidden="true" />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: '#8b96a8' }}>{active ? 'Drop to add' : title}</p>
      <p className="text-xs" style={{ color: '#4a5568' }}>
        {hint ?? <>or <span style={{ color: '#5b8dee' }}>click to browse</span></>}
      </p>
    </div>
  );
};

export default React.memo(DropZone);
