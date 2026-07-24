import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base debe coincidir con el nombre del repo para GitHub Pages (/<repo>/).
// Se puede sobreescribir con la env BASE_PATH en el workflow de deploy.
export default defineConfig({
  base: process.env.BASE_PATH || '/magoya-studio/',
  plugins: [react()],
})
