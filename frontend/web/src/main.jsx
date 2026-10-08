import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { FolderIconTestPage } from './pages/FolderIconTestPage.jsx'

const isTestIconFolder = window.location.pathname === '/test/icon-folder';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isTestIconFolder ? <FolderIconTestPage /> : <App />}
  </StrictMode>,
)
