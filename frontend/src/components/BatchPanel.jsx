import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers, Loader2, X } from 'lucide-react';
import { predictBatch } from '../api';
import { verdictOf } from '../verdict';
import DropZone, { fileProblem } from './DropZone';
import FaceImage from './FaceImage';

const MAX_FILES = 10;

const Badge = ({ prediction, confidence }) => {
  const { color } = verdictOf(prediction);
  return (
    <span className="text-xs font-mono px-2 py-0.5 rounded-full whitespace-nowrap"
          style={{ color, background: `${color}14`, border: `1px solid ${color}40` }}>
      {prediction} · {confidence}%
    </span>
  );
};

/** Classify up to 10 images in one request; results as a grid. */
const BatchPanel = ({ model }) => {
  const [items, setItems] = useState([]);   // { id, file, url, result?, error? }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // free the preview URLs when the panel goes away
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const addFiles = useCallback((files) => {
    const room = MAX_FILES - items.length;
    const problems = files.map(fileProblem).filter(Boolean);
    const ok = files.filter((f) => !fileProblem(f));
    if (ok.length > room) problems.push(`Only ${MAX_FILES} images per batch: the rest were skipped.`);
    setError(problems.length ? problems.join(' ') : null);
    const added = ok.slice(0, room).map((file) => ({ id: `${file.name}-${file.size}-${Math.random()}`, file, url: URL.createObjectURL(file) }));
    // a changed set of images makes earlier results stale
    setItems([...items.map((p) => ({ ...p, result: undefined, error: undefined })), ...added]);
  }, [items]);

  const remove = useCallback((id) => setItems((prev) => {
    const gone = prev.find((p) => p.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    return prev.filter((p) => p.id !== id);
  }), []);

  const clear = useCallback(() => { items.forEach((i) => URL.revokeObjectURL(i.url)); setItems([]); setError(null); }, [items]);

  const run = useCallback(async () => {
    if (!items.length || loading) return;
    setLoading(true); setError(null);
    try {
      const { results } = await predictBatch(items.map((i) => i.file), model);
      setItems((prev) => prev.map((p, n) => ({ ...p, result: results[n]?.error ? undefined : results[n], error: results[n]?.error })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [items, loading, model]);

  const done = items.filter((i) => i.result);
  const counts = ['FAKE', 'UNCERTAIN', 'REAL'].map((v) => [v, done.filter((i) => i.result.prediction === v).length]);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(91,141,238,0.12)' }}>
          <Layers className="w-4 h-4" style={{ color: '#5b8dee' }} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <h2 className="text-sm font-semibold" style={{ color: '#f0f2f8' }}>Batch Classification</h2>
          <p className="text-xs mt-0.5" style={{ color: '#6b7a94' }}>Up to {MAX_FILES} images · every face in each image is checked</p>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={clear} disabled={loading} className="text-xs px-3 py-2 rounded-xl"
                    style={{ color: '#9eaabb', border: '1px solid rgba(255,255,255,0.1)' }}>
              Clear
            </button>
            <button type="button" onClick={run} disabled={loading} aria-busy={loading} className="btn-primary">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Classifying…</> : `Classify ${items.length} image${items.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {done.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs" aria-live="polite">
            {counts.filter(([, n]) => n).map(([v, n]) => {
              const { color } = verdictOf(v);
              return <span key={v} className="font-mono px-2.5 py-1 rounded-full" style={{ color, background: `${color}14` }}>{n} {v}</span>;
            })}
          </div>
        )}

        {items.length < MAX_FILES && (
          <DropZone multiple onFiles={addFiles} minHeight={items.length ? 110 : 220}
                    title={items.length ? 'Add more images' : 'Drag & drop up to 10 images'} />
        )}

        {error && (
          <p role="alert" className="text-xs p-3 rounded-xl"
             style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
            {error}
          </p>
        )}

        {items.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl overflow-hidden flex flex-col"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="relative h-44 p-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <FaceImage src={item.url} alt={item.file.name} faces={item.result?.faces ?? []} selected={item.result?.primary_face ?? 0} />
                  {!loading && (
                    <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.file.name}`}
                            className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: 'rgba(7,8,15,0.75)' }}>
                      <X className="w-3.5 h-3.5" style={{ color: '#9eaabb' }} />
                    </button>
                  )}
                </div>
                <div className="px-3 py-2.5 flex flex-col gap-1.5">
                  <p className="text-xs truncate" style={{ color: '#f0f2f8' }} title={item.file.name}>{item.file.name}</p>
                  {item.result && (
                    <div className="flex items-center justify-between gap-2">
                      <Badge prediction={item.result.prediction} confidence={item.result.confidence} />
                      <span className="text-xs" style={{ color: '#6b7a94' }}>
                        {item.result.face_count ? `${item.result.face_count} face${item.result.face_count > 1 ? 's' : ''}` : 'no face found'}
                      </span>
                    </div>
                  )}
                  {item.error && <p className="text-xs" style={{ color: '#f87171' }}>{item.error}</p>}
                  {!item.result && !item.error && (
                    <p className="text-xs" style={{ color: '#4a5568' }}>{loading ? 'Classifying…' : 'Ready'}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default BatchPanel;
