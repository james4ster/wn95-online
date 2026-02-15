import React from 'react';
import ReactDOM from 'react-dom/client'; // note '/client' here
import App from './app';
import './globals.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
