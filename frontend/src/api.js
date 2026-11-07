import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://haaardikkkk-syntheticface-detector.hf.space';

// A free Hugging Face Space sleeps when unused and answers 502/503/504, or an error with no
// CORS headers (seen here as no response at all), until it has woken up. That takes a minute or two.
const WAKE_RETRIES = 10;
const WAKE_DELAY_MS = 15000;
const isWaking = (error) => !error.response || [502, 503, 504].includes(error.response.status);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const predictImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await axios.post(`${API_URL}/predict`, formData);
      return response.data;
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
};
