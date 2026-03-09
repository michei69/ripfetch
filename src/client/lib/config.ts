const isDev = import.meta.env['VITE_DEV'] === 'true'

export const API_BASE_URL = isDev ? 'http://127.0.0.1:3000' : ''