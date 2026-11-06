import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { hareketUygula } from './ayar/hareket';
import { yaziTipleriHazir } from './metin/turkce';
import './stil/tokens.css';
import './stil/temel.css';
import './stil/bilesen.css';

hareketUygula();
// Satır kırma canvas ile ölçülür; font (latin + latin-ext) yüklenmeden ölçülen satır taşar (W9). En çok 1,5 sn bekler.
const ciz = () => createRoot(document.getElementById('kok')!).render(<StrictMode><App /></StrictMode>);
void Promise.race([yaziTipleriHazir(), new Promise((r) => setTimeout(r, 1500))]).finally(ciz);
