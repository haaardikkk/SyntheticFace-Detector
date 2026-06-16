import axios from 'axios';

// In production VITE_API_URL must point to the HF Space backend.
// The hardcoded fallback ensures it works even if the env var is missing.
const API_URL = import.meta.env.VITE_API_URL || 'https://haaardikkkk-syntheticface-detector.hf.space';

export const predictImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${API_URL}/predict`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.detail) {
      throw new Error(error.response.data.detail);
    }
    throw new Error('Prediction failed. Please make sure the backend is running.');
  }
};
