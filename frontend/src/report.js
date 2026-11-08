// Builds a printable A4 PDF report of one classification result. jsPDF is loaded only when a report is made.
import { MODEL_NAMES } from './verdict';

const SITE = 'synthetic-face-detector.vercel.app';
const INK = [24, 28, 40];
const MUTED = [100, 112, 132];
const LINE = [226, 230, 238];
const COLORS = { REAL: [22, 163, 74], FAKE: [220, 38, 38], UNCERTAIN: [217, 119, 6] };
const TEXT = {
  REAL: 'Likely a real photograph',
  FAKE: 'Likely AI-generated or AI-altered',
  UNCERTAIN: 'Inconclusive: the model is not sure either way',
};
const color = (p) => COLORS[p] ?? COLORS.UNCERTAIN;
const pct = (v) => (v == null ? '-' : `${Number(v).toFixed(1)}%`);

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new window.Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// The uploaded image with numbered, verdict-coloured face boxes, as a JPEG data URL
async function annotatedImage(src, faces) {
  const img = await loadImage(src);
  const scale = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const line = Math.max(2, Math.round(Math.min(w, h) / 220));
  faces.forEach((f, i) => {
    if (!f.box) return;
    const [x, y, bw, bh] = [f.box[0] * w, f.box[1] * h, f.box[2] * w, f.box[3] * h];
    const [r, g, b] = color(f.prediction);
    ctx.strokeStyle = `rgb(${r},${g},${b})`;
    ctx.lineWidth = line;
    ctx.strokeRect(x, y, bw, bh);
    const tag = String(i + 1);
    const fs = Math.max(14, Math.round(Math.min(w, h) / 28));
    ctx.font = `bold ${fs}px Helvetica, Arial, sans-serif`;
    const tw = ctx.measureText(tag).width + fs * 0.6;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x - line / 2, Math.max(0, y - fs * 1.3), tw, fs * 1.3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tag, x - line / 2 + fs * 0.3, Math.max(fs, y - fs * 0.3));
  });
  return { data: canvas.toDataURL('image/jpeg', 0.9), w, h };
}

export async function downloadReport({ result, imageSrc, fileName, selectedFace = 0 }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16;
  const faces = result.faces?.length ? result.faces : [{ ...result, box: null }];
  const modelName = MODEL_NAMES[result.model_version] ?? result.model_version ?? 'unknown';
  const made = new Date();
  let y = 0;

  const footer = () => {
    doc.setDrawColor(...LINE); doc.line(M, H - 14, W - M, H - 14);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`Synthetic Face Detector  |  ${SITE}`, M, H - 9);
    doc.text(`Page ${doc.getNumberOfPages()}`, W - M, H - 9, { align: 'right' });
  };
  const ensure = (need) => {
    if (y + need > H - 20) { footer(); doc.addPage(); y = M; }
  };
  const heading = (text, keepWith = 10) => {
    ensure(8 + keepWith);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK);
    doc.text(text.toUpperCase(), M, y);
    doc.setDrawColor(...LINE); doc.line(M, y + 2, W - M, y + 2);
    y += 8;
  };

  // ── Header band
  doc.setFillColor(7, 8, 15); doc.rect(0, 0, W, 34, 'F');
  doc.setFillColor(91, 141, 238); doc.rect(0, 34, W, 1.2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(240, 242, 248);
  doc.text('Synthetic Face Detector', M, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(158, 170, 187);
  doc.text('Image analysis report', M, 24);
  doc.setFontSize(9);
  doc.text(made.toLocaleString(), W - M, 16, { align: 'right' });
  doc.text(`Model: ${modelName}`, W - M, 24, { align: 'right' });
  y = 46;

  // ── Image (left) + verdict (right)
  const shot = await annotatedImage(imageSrc, faces);
  const boxW = 92, boxH = 104;
  const k = Math.min(boxW / shot.w, boxH / shot.h);
  const iw = shot.w * k, ih = shot.h * k;
  doc.setFillColor(245, 247, 250); doc.roundedRect(M, y, boxW, boxH, 2, 2, 'F');
  doc.addImage(shot.data, 'JPEG', M + (boxW - iw) / 2, y + (boxH - ih) / 2, iw, ih);

  const X = M + boxW + 8, RW = W - M - X;
  const [r, g, b] = color(result.prediction);
  doc.setFillColor(r, g, b); doc.roundedRect(X, y, RW, 34, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text(faces.length > 1 ? `OVERALL VERDICT  |  FACE ${(result.primary_face ?? 0) + 1} OF ${faces.length}` : 'VERDICT', X + 5, y + 8);
  doc.setFontSize(24); doc.text(result.prediction ?? '-', X + 5, y + 20);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(TEXT[result.prediction] ?? '', X + 5, y + 28);

  const rows = [
    ['Confidence', pct(result.confidence)],
    ['AI likelihood', pct(result.fake_probability)],
    ...(result.altered_area != null ? [['Altered area', `${pct(result.altered_area)} of face`]] : []),
    ['Faces found', result.face_detected === false ? 'None (image centre analysed)' : String(result.face_count ?? faces.length)],
    ['Model', modelName],
    ['File', fileName ?? '-'],
  ];
  let ry = y + 42;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
    doc.text(label, X, ry);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK);
    const v = doc.splitTextToSize(String(value), RW - 30);
    doc.text(v[0] + (v.length > 1 ? '...' : ''), W - M, ry, { align: 'right' });
    doc.setDrawColor(...LINE); doc.line(X, ry + 2.5, W - M, ry + 2.5);
    ry += 8.5;
  });

  // AI-likelihood scale with the uncertain band
  ry += 2;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text('AI likelihood scale', X, ry);
  ry += 3;
  const seg = [[0, 35, COLORS.REAL], [35, 75, COLORS.UNCERTAIN], [75, 100, COLORS.FAKE]];
  seg.forEach(([a, z, c]) => { doc.setFillColor(...c.map((v) => Math.round(v + (255 - v) * 0.65))); doc.rect(X + (RW * a) / 100, ry, (RW * (z - a)) / 100, 4, 'F'); });
  const mx = X + (RW * Math.min(100, Math.max(0, result.fake_probability ?? 0))) / 100;
  doc.setFillColor(...INK); doc.triangle(mx - 1.6, ry - 1.8, mx + 1.6, ry - 1.8, mx, ry + 0.6, 'F');
  doc.rect(mx - 0.3, ry, 0.6, 4, 'F');
  doc.setFontSize(7); doc.setTextColor(...MUTED);
  doc.text('Real', X, ry + 8); doc.text('Uncertain', X + RW * 0.55, ry + 8, { align: 'center' }); doc.text('AI', W - M, ry + 8, { align: 'right' });

  y += boxH + 12;

  // ── Faces table
  if (faces.length > 1 || faces[0].box) {
    heading(`Faces (${faces.length})`);
    const cols = [[M, 'Face'], [M + 20, 'Verdict'], [M + 62, 'Confidence'], [M + 98, 'AI likelihood'], [M + 138, 'Altered area']];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...MUTED);
    cols.forEach(([x, t]) => doc.text(t, x, y));
    y += 5;
    faces.forEach((f, i) => {
      ensure(8);
      if (i === selectedFace && faces.length > 1) { doc.setFillColor(243, 246, 252); doc.rect(M - 2, y - 4.5, W - 2 * M + 4, 7, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
      doc.text(String(i + 1), cols[0][0], y);
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...color(f.prediction));
      doc.text(f.prediction ?? '-', cols[1][0], y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK);
      doc.text(pct(f.confidence), cols[2][0], y);
      doc.text(pct(f.fake_probability), cols[3][0], y);
      doc.text(f.altered_area == null ? '-' : pct(f.altered_area), cols[4][0], y);
      doc.setDrawColor(...LINE); doc.line(M, y + 2.5, W - M, y + 2.5);
      y += 7;
    });
    y += 6;
  }

  // ── Heatmaps
  const maps = faces.map((f, i) => ({ f, i })).filter(({ f }) => f.heatmap);
  if (maps.length) {
    const n = 4, gap = 5, size = (W - 2 * M - gap * (n - 1)) / n;
    heading(result.heatmap_kind === 'gradcam' ? 'Where the model looked (Grad-CAM)' : 'Alteration maps', size + 11);
    maps.forEach(({ f, i }, j) => {
      if (j % n === 0) { if (j) y += size + 11; ensure(size + 11); }
      const x = M + (j % n) * (size + gap);
      doc.addImage(`data:image/png;base64,${f.heatmap}`, 'PNG', x, y, size, size);
      doc.setDrawColor(...color(f.prediction)); doc.setLineWidth(0.6); doc.rect(x, y, size, size); doc.setLineWidth(0.2);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...color(f.prediction));
      doc.text(`Face ${i + 1}  ${f.prediction}`, x, y + size + 5);
    });
    y += size + 14;
  }

  // ── How to read
  heading('How to read this report');
  const notes = [
    'Verdict: REAL or FAKE when the AI likelihood is clearly low or high; UNCERTAIN between 35% and 75%, where the model is not reliable either way.',
    'AI likelihood: the calibrated probability that the face is AI-generated or AI-altered. Confidence is how sure the model is of the verdict shown.',
    result.heatmap_kind === 'gradcam'
      ? 'Map: the image regions the model paid most attention to. It does not show what was altered.'
      : 'Alteration map: bright regions look generated or edited. It is approximate and most useful on partly altered faces (inpainting, face swaps).',
    'With several faces, the overall verdict is the most suspicious face, so one altered face in a group photo is not hidden.',
  ];
  notes.forEach((t) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    const lines = doc.splitTextToSize(t, W - 2 * M - 5);
    ensure(lines.length * 4.4 + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);   // a page break resets these
    doc.setFillColor(...MUTED); doc.circle(M + 1, y - 1.1, 0.7, 'F');
    doc.text(lines, M + 5, y);
    y += lines.length * 4.4 + 2;
  });

  // ── Disclaimer
  y += 3;
  const disc = doc.splitTextToSize(
    'Automated analysis for educational and research use only. Detection of AI-generated images is an open problem and this model makes mistakes, ' +
    'especially on real social-media photos and on generators it never saw. Do not use this report for legal, forensic or security decisions.',
    W - 2 * M - 10,
  );
  ensure(disc.length * 3.6 + 8);
  doc.setFillColor(254, 247, 230); doc.roundedRect(M, y - 4, W - 2 * M, disc.length * 3.5 + 5, 1.5, 1.5, 'F');
  doc.setFontSize(8); doc.setTextColor(146, 84, 6);
  doc.text(disc, M + 5, y + 0.5);
  footer();

  const base = (fileName ?? 'image').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_').slice(0, 40);
  doc.save(`face-report_${base}_${made.toISOString().slice(0, 10)}.pdf`);
}
