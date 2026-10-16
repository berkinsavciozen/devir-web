import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './stil/tokens.css';
import './stil/temel.css';
import './stil/bilesen.css';

createRoot(document.getElementById('kok')!).render(<StrictMode><App /></StrictMode>);
