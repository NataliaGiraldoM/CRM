// VITE_API_URL is the backend origin, without /api (e.g. https://orbit-api.onrender.com).
const origin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const API_BASE = `${origin}/api`;
