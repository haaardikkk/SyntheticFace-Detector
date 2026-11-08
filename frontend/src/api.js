import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://haaardikkkk-syntheticface-detector.hf.space';

// A free Hugging Face Space sleeps when unused and answers 502/503/504, or an error with no
// CORS headers (seen here as no response at all), until it has woken up. That takes a minute or two.
const WAKE_RETRIES = 10;
const WAKE_DELAY_MS = 15000;
const isWaking = (error) => !error.response || [502, 503, 504].includes(error.response.status);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(send) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return (await send()).data;
    } catch (error) {
      if (isWaking(error) && attempt < WAKE_RETRIES) {
        await sleep(WAKE_DELAY_MS);
        continue;
      }
      if (error.response?.data?.detail) {
        throw new Error(error.response.data.detail);
      }
      throw new Error('The detection server is not responding. Please try again in a few minutes.');
    }
  }
}

const form = (field, files) => {
  const data = new FormData();
  for (const f of [].concat(files)) data.append(field, f);
  return data;
};

/** Score every face in one image. model: a version such as "v3", or undefined for the default. */
export const predictImage = (file, model) =>
  request(() => axios.post(`${API_URL}/predict`, form('file', file), { params: model ? { model } : {} }));

/** Score up to 10 images (no heatmaps). */
export const predictBatch = (files, model) =>
  request(() => axios.post(`${API_URL}/predict/batch`, form('files', files), { params: model ? { model } : {} }));

/** Score one image with every model. */
export const compareModels = (file) => request(() => axios.post(`${API_URL}/compare`, form('file', file)));

/** The available models, their scores, and which one is the default. */
export const fetchModels = () => request(() => axios.get(`${API_URL}/models`));
