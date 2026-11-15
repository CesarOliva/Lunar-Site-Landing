import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const resolveFromRoot = (path) => fileURLToPath(new URL(path, import.meta.url))

// El PDS de la NASA (elevación LOLA de 16 bits de la vista de primera persona) no envía cabeceras
// CORS, así que se accede a través de un proxy del mismo origen. En producción hace falta un proxy
// equivalente para '/pds' hacia https://pds-geosciences.wustl.edu.
const pdsProxy = {
  '/pds': {
    target: 'https://pds-geosciences.wustl.edu',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/pds/, ''),
  },
}

const cesiumBuild = 'node_modules/cesium/Build/Cesium'

export default defineConfig({
  // CesiumJS carga Workers, Assets y Widgets como archivos estáticos desde esta ruta.
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium') },
  plugins: [
    react(),
    viteStaticCopy({
      targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((folder) => ({
        src: `${cesiumBuild}/${folder}/**/*`,
        dest: `cesium/${folder}`,
        rename: { stripBase: 5 },
      })),
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      ...pdsProxy,
    },
  },
  preview: { proxy: pdsProxy },
  build: {
    rollupOptions: {
      // Dos páginas: la aplicación Oddity y el explorador MOON completo (/moon/).
      input: {
        main: resolveFromRoot('./index.html'),
        moon: resolveFromRoot('./moon/index.html'),
      },
    },
  },
})
