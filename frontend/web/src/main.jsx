import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import ThemeProvider from './contexts/ThemeContext';
import LayoutProvider from './contexts/LayoutContext';
import { router } from './routes/route';
import './main.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <LayoutProvider>
        <RouterProvider router={router} />
      </LayoutProvider>
    </ThemeProvider>
  </StrictMode>,
);
