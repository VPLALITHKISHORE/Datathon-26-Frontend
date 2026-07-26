/**
 * Utility to resolve backend API endpoints dynamically.
 * 
 * - In local development (localhost / 127.0.0.1), it returns relative paths,
 *   relying on Vite's dev server proxy to route calls to the local FastAPI server.
 * - In production (deployed on Zoho Catalyst), it prepends the deployed backend URL.
 */
export const getApiUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return cleanPath;
  }
  
  // Deployed Zoho AppSail backend URL (loaded dynamically from env or fallback)
  const baseUrl = import.meta.env.VITE_API_URL;
  return `${baseUrl}${cleanPath}`;
};
