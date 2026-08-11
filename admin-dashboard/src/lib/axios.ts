import axios from 'axios';

const api = axios.create({
  // Point all frontend requests to the Next.js API Proxy which handles injecting the HTTPOnly cookie as a Bearer Token
  baseURL: '/api/proxy',
});

api.interceptors.response.use(
  (response) => {
    // Return the nested "data" if the backend nests it
    return response.data;
  },
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      if (typeof window !== 'undefined') {
        window.location.href = '/unauthorized';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
