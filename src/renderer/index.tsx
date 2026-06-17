import ReactDom from 'react-dom/client'
import React from 'react'

import '@fontsource-variable/space-grotesk'

import { AppRoutes } from './routes'

import './globals.css'

ReactDom.createRoot(document.querySelector('app') as HTMLElement).render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>
)
