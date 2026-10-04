import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  optimizeDeps: { exclude: ['three-mesh-bvh/worker'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: id => /node_modules\/(three-gpu-pathtracer|three-mesh-bvh)\//.test(id) ? 'pathtracing' : id.includes('node_modules/three/examples/') ? 'effects' : id.includes('node_modules/three/') ? 'three' : undefined,
      },
    },
  },
});
