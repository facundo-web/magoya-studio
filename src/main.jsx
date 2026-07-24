import React from 'react'
import { createRoot } from 'react-dom/client'

// Manrope (pantalla). El export embebe la fuente aparte (engine/export.js)
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'

import './brand/tokens.css'
import './styles.css'

import App from './App.jsx'
import { preloadBrandAssets } from './engine/assets.js'

const root = createRoot(document.getElementById('root'))

async function boot() {
  // precargar assets de marca + esperar que Manrope esté lista (medición exacta)
  await preloadBrandAssets()
  try {
    await Promise.all([
      document.fonts.load('800 40px Manrope'),
      document.fonts.load('500 20px Manrope'),
      document.fonts.load('700 20px Manrope'),
    ])
    await document.fonts.ready
  } catch (e) {
    console.warn('[boot] fuentes', e)
  }
  root.render(<App />)
}

boot()
