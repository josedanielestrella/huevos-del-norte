import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles/app.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => registration.unregister());
    }).catch(() => {});
  });
}

createRoot(document.getElementById('root')).render(<App />);
