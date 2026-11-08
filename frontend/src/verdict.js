// Shared look and wording for the three verdicts the backend returns.
export const VERDICT = {
  REAL:      { color: '#4ade80', glow: 'rgba(74,222,128,0.5)',  text: 'Likely a real photograph' },
  FAKE:      { color: '#f87171', glow: 'rgba(248,113,113,0.5)', text: 'Likely AI-generated or AI-altered' },
  UNCERTAIN: { color: '#fbbf24', glow: 'rgba(251,191,36,0.5)',  text: 'Inconclusive: the model is not sure either way' },
};

export const verdictOf = (prediction) => VERDICT[prediction] ?? VERDICT.UNCERTAIN;

export const MODEL_NAMES = { v2: 'EfficientNet-B0 v2', v3: 'ConvNeXt-Tiny v3', v4: 'ConvNeXt-Tiny v4' };

/** One face's result, merged with the image-level fields the cards need. */
export const faceView = (result, index) => {
  if (!result) return null;
  const face = result.faces?.[index] ?? result;
  return {
    ...face,
    model_version: result.model_version,
    heatmap_kind: result.heatmap_kind,
    face_detected: result.face_detected,
    face_count: result.face_count ?? 0,
  };
};
