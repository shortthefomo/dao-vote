import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import mkcert from 'vite-plugin-mkcert'

// export default defineConfig({
//   plugins: [mkcert(), vue()],
//   server: {
//     https: true,
//     strictPort: true,
//     port: 3016,
//   },
//   define: {
//     'process.env': {}
//   }
// })

export default defineConfig({
  plugins: [vue()],
  define: {
    'process.env': {}
  }
})