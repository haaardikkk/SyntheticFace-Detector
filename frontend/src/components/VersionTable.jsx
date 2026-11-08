import { motion } from 'framer-motion';
import { GitCompare } from 'lucide-react';

/**
 * VersionTable — v2, v3 and v4 scored on the same test images (from the v4 training run).
 * Static, so it shows even while the backend is waking up.
 */

const VERSIONS = [
  { id: 'v2', name: 'EfficientNet-B0', year: 'Jun 2026' },
  { id: 'v3', name: 'ConvNeXt-Tiny',   year: 'Nov 2026' },
  { id: 'v4', name: 'ConvNeXt-Tiny',   year: 'Nov 2026', current: true },
];

// [balanced accuracy %, AUC, real photos accepted %] per version
const ROWS = [
  { set: 'Social-media images', note: 'OpenFake Reddit', scores: { v2: [32.8, 0.286, 46.1], v3: [52.9, 0.555, 9.8], v4: [63.9, 0.727, 53.2] } },
  { set: 'Unseen videos',       note: 'WildDeepfake test', scores: { v2: [49.9, 0.458, 99.8], v3: [71.3, 0.789, 80.7], v4: [73.5, 0.836, 65.3] } },
  { set: 'Unseen generators',   note: 'OpenFake core/test', scores: { v2: [61.1, 0.730, 85.0], v3: [74.0, 0.828, 54.1], v4: [73.9, 0.803, 62.4] } },
  { set: 'Held-out test',       note: 'generators seen in training', scores: { v2: [49.2, 0.471, 66.8], v3: [92.8, 0.974, 90.6], v4: [92.4, 0.966, 91.2] } },
];

const HIGHLIGHTS = [
  { value: '0.56 → 0.73', label: 'AUC on social-media images, v3 → v4' },
  { value: '10% → 53%',   label: 'Real social-media photos accepted' },
  { value: '0.79 → 0.84', label: 'AUC on unseen deepfake videos' },
];

const GREEN = '#4ade80';

const Cell = ({ score, best }) => {
  const [acc, auc, real] = score;
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold" style={{ color: best ? GREEN : '#f0f2f8' }}>{auc.toFixed(2)}</span>
        {best && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: GREEN, background: 'rgba(74,222,128,0.12)' }}>BEST</span>}
      </div>
      {/* AUC bar: 0.5 (chance) to 1.0 */}
      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', width: 96 }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, (auc - 0.5) / 0.5) * 100}%`, background: best ? GREEN : '#5b8dee' }} />
      </div>
      <p className="font-mono text-[11px] mt-1.5" style={{ color: '#6b7a94' }}>
        {acc.toFixed(1)}% bal. acc · {real.toFixed(0)}% real OK
      </p>
    </div>
  );
};

const VersionTable = () => (
  <section id="versions" className="py-16 sm:py-20" aria-labelledby="versions-heading">
    <div className="section-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(139,108,247,0.12)', border: '1px solid rgba(139,108,247,0.18)' }}
          >
            <GitCompare style={{ width: 20, height: 20, color: '#8b6cf7' }} aria-hidden="true" />
          </div>
          <div>
            <p className="eyebrow mb-1">Model History</p>
            <h2 id="versions-heading" className="text-xl font-bold" style={{ color: '#f0f2f8', letterSpacing: '-0.02em' }}>
              Version Comparison
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {HIGHLIGHTS.map(({ value, label }) => (
            <div key={label} className="glass rounded-2xl p-5">
              <p className="font-mono font-bold text-xl mb-1" style={{ color: GREEN }}>{value}</p>
              <p className="text-xs" style={{ color: '#9eaabb' }}>{label}</p>
            </div>
          ))}
        </div>

        <div
          className="glass rounded-2xl overflow-x-auto"
          style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' }}
        >
          <table className="w-full min-w-[640px]">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.028)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="text-left font-normal px-6 py-3"><span className="eyebrow">Test set</span></th>
                {VERSIONS.map((v) => (
                  <th key={v.id} className="text-left font-normal px-6 py-3">
                    <span className="eyebrow" style={v.current ? { color: '#5b8dee' } : undefined}>
                      {v.id.toUpperCase()}{v.current ? ' · current' : ''}
                    </span>
                    <span className="block text-xs mt-1 font-mono" style={{ color: '#6b7a94' }}>{v.name} · {v.year}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ set, note, scores }, i) => {
                const best = Math.max(...VERSIONS.map((v) => scores[v.id][1]));
                return (
                  <tr key={set} style={{ borderTop: i ? '1px solid rgba(255,255,255,0.04)' : 'none', background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                    <td className="px-6 py-4 align-top">
                      <p className="text-sm" style={{ color: '#f0f2f8' }}>{set}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#6b7a94' }}>{note}</p>
                    </td>
                    {VERSIONS.map((v) => (
                      <td key={v.id} className="px-6 py-4 align-top">
                        <Cell score={scores[v.id]} best={scores[v.id][1] === best} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs mt-4 leading-relaxed max-w-3xl" style={{ color: '#6b7a94' }}>
          AUC (large number) measures how well real and AI images are separated: 0.5 is chance, 1.0 is perfect. All three versions were
          scored on the same test images. v4 trades a little accuracy on known generators for far fewer false alarms on real photos.
          Pick any version in the classifier, or use Compare to run all three on one image.
        </p>
      </motion.div>
    </div>
  </section>
);

export default VersionTable;
