import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { hareketUygula } from './ayar/hareket';
import './stil/tokens.css';
import './stil/temel.css';
import './stil/bilesen.css';

hareketUygula();
createRoot(document.getElementById('kok')!).render(<StrictMode><App /></StrictMode>);
