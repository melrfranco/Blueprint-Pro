import react from '@vitejs/plugin-react';

export default {
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': process.cwd(),
    }
  },
};
