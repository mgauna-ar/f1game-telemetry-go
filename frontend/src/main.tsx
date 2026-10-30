import React from 'react'
import ReactDOM from 'react-dom/client'
import { Root } from './Root.tsx'
import { isNativeWindow, markNativeWindow } from './utils/nativeWindow'
import './styles/index.css'

if (isNativeWindow()) markNativeWindow()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
