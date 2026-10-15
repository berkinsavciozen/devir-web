// Tasarım PNG'si ↔ uygulamadaki karşılığı. Her satır bir karşılaştırma görseli üretir.
// yol: sahte API ile açılacak adres; hazirla: tıklama vb. (isteğe bağlı)
import type { Page } from '@playwright/test';

export interface EkranTanim {
  ad: string;               // ekranlar/<ad>.png
  yol: string;
  w?: number; h?: number;   // varsayılan 390 × 844
  /** sayfa açılmadan önce (saat, yerel depo) */
  once?: (p: Page) => Promise<void>;
  hazirla?: (p: Page) => Promise<void>;
}

const sonEposta = (e: string) => async (p: Page) => { await p.addInitScript((x) => localStorage.setItem('devir:son-eposta', x), e); };

export const EKRANLAR: EkranTanim[] = [
  { ad: '_iskelet', yol: '/_iskelet' },
  // A · Giriş, davet ve katılım
  { ad: 'A1-giris', yol: '/?senaryo=berkin&oturum=yok' },
  {
    ad: 'A1b-eposta-gonderildi', yol: '/?senaryo=berkin&oturum=yok',
    once: async (p) => { await p.clock.install(); },
    hazirla: async (p) => {
      await p.getByRole('textbox').fill('berkin@ornek.com');
      await p.getByRole('button', { name: 'Giriş bağlantısı gönder' }).click();
      await p.getByText('E-postanı kontrol et').waitFor();
      await p.clock.runFor(18_000); // "Yeniden gönder · 0:42"
    },
  },
  // sahte bağlantı değişimi ağ gecikmesi kadar bekler; saat durdurulunca A1c'de kalır
  { ad: 'A1c-giris-aciliyor', yol: '/giris?code=sahte-berkin:berkin@ornek.com', once: async (p) => { await sonEposta('berkin@ornek.com')(p); await p.clock.install(); } },
  { ad: 'A1d-baglanti-gecersiz', yol: '/giris?error_code=otp_expired', once: sonEposta('berkin@ornek.com') },
  { ad: 'A2-bos-evren', yol: '/?senaryo=bos' },
  { ad: 'A3-claudea-bagla', yol: '/bagla?senaryo=berkin', hazirla: async (p) => { await p.getByText('dv_', { exact: false }).first().waitFor(); } },
  { ad: 'A4-davet-kabul', yol: '/?senaryo=davetli' },
  { ad: 'A5-davet-yok', yol: '/?senaryo=davetsiz' },
];
