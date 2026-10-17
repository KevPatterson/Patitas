import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // El bundle por defecto es un único archivo de todo el sitio.
    rollupOptions: {
      output: {
        /**
         * Chunks de vendors (tarea 6.3).
         *
         * Separar las librerías que casi nunca cambian permite que el navegador
         * las conserve entre despliegues: al publicar una corrección solo se
         * invalida el chunk de la aplicación, no los 500 KB de React y Supabase.
         *
         * `leaflet` NO se declara aquí a propósito: solo lo importa la ruta
         * `/mapa`, que es lazy, así que Rollup ya lo deja en su propio chunk y
         * nadie que no abra el mapa lo descarga.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('react-router')) return 'vendor-router';
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('scheduler')
          ) {
            return 'vendor-react';
          }

          return undefined;
        },
      },
    },
    // Aviso a partir de 500 KB. Se mantiene en el valor por defecto para que si
    // un chunk vuelve a crecer se note en el build.
    chunkSizeWarningLimit: 500,
  },
});
