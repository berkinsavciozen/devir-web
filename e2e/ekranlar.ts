// Tasarım PNG'si ↔ uygulamadaki karşılığı. Her satır bir karşılaştırma görseli üretir.
// yol: sahte API ile açılacak adres; hazirla: tıklama vb. (isteğe bağlı)
import type { Page } from '@playwright/test';

export interface EkranTanim {
  ad: string;               // ekranlar/<ad>.png
  yol: string;
  w?: number; h?: number;   // varsayılan 390 × 844
  hazirla?: (p: Page) => Promise<void>;
}

export const EKRANLAR: EkranTanim[] = [
  { ad: '_iskelet', yol: '/_iskelet' },
];
