import { useCallback, useEffect, useState } from 'react';
import { GitCompare, Loader2 } from 'lucide-react';
import { compareModels } from '../api';
import { MODEL_NAMES, verdictOf } from '../verdict';
import DropZone, { fileProblem } from './DropZone';
import FaceImage from './FaceImage';

const SET_LABELS = {
  'held-out test (same generators as training)': 'Held-out test',
  'GOLD unseen generators (OpenFake core/test)': 'Unseen generators',
  'GOLD unseen videos (WildDeepfake test)': 'Unseen videos',
  'GOLD in the wild (OpenFake Reddit)': 'Social-media images',
};

// full class names, so Tailwind includes them in the build
const COLUMNS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' };

const ModelResult = ({ version, result, isDefault }) => {
  const { color, text } = verdictOf(result.prediction);
  return (
    <div className="rounded-xl flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-sm font-mono" style={{ color: '#f0f2f8' }}>{MODEL_NAMES[version] ?? version}</p>
        {isDefault && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ color: '#5b8dee', background: 'rgba(91,141,238,0.12)' }}>DEFAULT</span>}
      </div>
      <div className="px-4 py-5 text-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="font-mono font-black tracking-wider" style={{ fontSize: '1.9rem', color, textShadow: `0 0 30px ${color}80` }}>{result.prediction}</p>
        <p className="text-xs mt-1" style={{ color: '#9eaabb' }}>{text}</p>
        <p className="text-xs font-mono mt-3" style={{ color: '#6b7a94' }}>
          confidence {result.confidence}% · AI likelihood {result.fake_probability}%
        </p>
      </div>
      <div className="p-3">
        <p className="eyebrow mb-2">{result.heatmap_kind === 'gradcam' ? 'Attention (Grad-CAM)' : 'Altered regions'}{result.face_count > 1 ? ` · face ${result.primary_face + 1}` : ''}</p>
        <div className="relative rounded-lg overflow-hidden aspect-square" style={{ background: 'rgba(0,0,0,0.2)' }}>
          {result.heatmap
            ? <img src={`data:image/png;base64,${result.heatmap}`} alt={`${version} heatmap`} className="absolute inset-0 w-full h-full object-contain" />
            : <p className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: '#6b7a94' }}>No map</p>}
        </div>
      </div>
    </div>
  );
};

const ScoresTable = ({ models }) => {
  const sets = Object.keys(SET_LABELS);
  const cell = (m, set) => {
    const s = m.metrics?.[set];
    return s ? `${(s.balanced_acc * 100).toFixed(1)}% · AUC ${s.auc.toFixed(2)}` : 'not measured';
  };
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <table className="w-full text-sm min-w-[480px]">
        <thead>
          <tr style={{ background: 'rgba(255,255,255,0.028)' }}>
            <th className="text-left font-normal px-4 py-3"><span className="eyebrow">Test set · balanced accuracy · AUC</span></th>
            {models.map((m) => <th key={m.version} className="text-left font-normal px-4 py-3 whitespace-nowrap"><span className="eyebrow">{m.name ?? m.version}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {sets.map((set) => (
            <tr key={set} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <td className="px-4 py-3" style={{ color: '#9eaabb' }}>{SET_LABELS[set]}</td>
              {models.map((m) => (
                <td key={m.version} className="px-4 py-3 font-mono text-xs whitespace-nowrap" style={{ color: m.metrics?.[set] ? '#f0f2f8' : '#4a5568' }}>{cell(m, set)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Run one image through every model, side by side, plus each model's measured scores. */
const ComparePanel = ({ models, defaultModel }) => {
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const choose = useCallback(([f]) => {
    const problem = fileProblem(f);
    setResults(null);
    if (problem) { setError(problem); return; }
    setError(null);
    setFile(f);
    setUrl(URL.createObjectURL(f));
  }, []);

  const run = useCallback(async () => {
    if (!file || loading) return;
    setLoading(true); setError(null);
    try {
      setResults((await compareModels(file)).results);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [file, loading]);

  const order = (models.length ? models.map((m) => m.version) : Object.keys(results ?? {}))
    .filter((v) => !results || results[v]);
  const primaryFaces = results?.[defaultModel]?.faces ?? [];

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,108,247,0.12)' }}>
          <GitCompare className="w-4 h-4" style={{ color: '#8b6cf7' }} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <h2 className="text-sm font-semibold" style={{ color: '#f0f2f8' }}>Compare Models</h2>
          <p className="text-xs mt-0.5" style={{ color: '#6b7a94' }}>The same image through every model version</p>
        </div>
        {file && (
          <button type="button" onClick={run} disabled={loading} aria-busy={loading} className="btn-primary">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Comparing…</> : 'Compare'}
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4">
          <div className="flex flex-col gap-3">
            {url ? (
              <div className="relative h-64 rounded-xl p-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
                <FaceImage key={url} src={url} alt={file?.name} faces={primaryFaces} selected={results?.[defaultModel]?.primary_face ?? 0} />
              </div>
            ) : null}
            <DropZone onFiles={choose} minHeight={url ? 90 : 256} title={url ? 'Choose another image' : 'Drag & drop an image to compare'} />
            {error && (
              <p role="alert" className="text-xs p-3 rounded-xl"
                 style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171' }}>
                {error}
              </p>
            )}
          </div>

          {results ? (
            <div className={`grid grid-cols-1 ${COLUMNS[Math.min(order.length, 3)] ?? ''} gap-3`}>
              {order.map((v) => <ModelResult key={v} version={v} result={results[v]} isDefault={v === defaultModel} />)}
            </div>
          ) : (
            <div className="rounded-xl flex items-center justify-center text-center p-6 min-h-[200px]"
                 style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
              <p className="text-sm" style={{ color: '#6b7a94' }}>
                {file ? 'Press Compare to run every model on this image.' : 'Results from each model appear here side by side.'}
              </p>
            </div>
          )}
        </div>

        {models.length > 0 && (
          <div>
            <p className="eyebrow mb-3">Measured scores, same test images for every model</p>
            <ScoresTable models={models} />
            <p className="text-xs mt-2" style={{ color: '#4a5568' }}>
              &ldquo;Not measured&rdquo;: that model was not scored on these test sets.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ComparePanel;
