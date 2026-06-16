import axios from 'axios';

// During local dev Vite proxies this, but in production we can configure it.
// Default fallback to port 7860 which is the Hugging Face port.
const API_URL = import.meta.env.VITE_API_URL || '';

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
