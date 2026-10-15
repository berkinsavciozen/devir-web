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
  { ad: 'A5-davet-yok', yol: '/?senaryo=davetsiz&kayit=kapali' },
  { ad: 'A5-alan-ac', yol: '/?senaryo=davetsiz' }, // açık kayıt (tasarımda PNG yok)
  // B · Günlük
  { ad: 'B1-evren', yol: '/?senaryo=berkin', hazirla: async (p) => { await p.getByText('tutuyor', { exact: false }).first().waitFor(); await p.waitForTimeout(600); } },
  { ad: 'B2-akislar', yol: '/akislar?senaryo=berkin', hazirla: async (p) => { await p.getByText('akış sürüyor', { exact: false }).waitFor(); await p.waitForTimeout(800); } },
  { ad: 'B3-galaksi', yol: '/akis/RTD5?senaryo=berkin' },
  { ad: 'B4-adim', yol: '/akis/RTD5/adim/6?senaryo=berkin', hazirla: async (p) => { await p.getByText('tutuyor').waitFor(); await p.waitForTimeout(400); } },
  { ad: 'B5-adim-gecmis', yol: '/akis/RTD5/adim/6?senaryo=berkin&sekme=gecmis', hazirla: async (p) => { await p.getByText('GEÇMİŞ').waitFor(); await p.waitForTimeout(400); } },
  {
    ad: 'B8-adim-dosya', yol: '/akis/RTD5/adim/6?senaryo=berkin&bolum=ciktilar',
    once: async (p) => { await p.clock.install(); },
    hazirla: async (p) => {
      await p.getByText('tarif-kapak-2.jpg').waitFor();
      await p.locator('input[type=file]').setInputFiles({ name: 'tarif-kapak-3.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(2_500_000) });
      await p.clock.runFor(1_350);
      await p.getByText('%6', { exact: false }).waitFor();
    },
  },
  {
    ad: 'B9-dosya-sil', yol: '/akis/RTD5/adim/6?senaryo=berkin&bolum=ciktilar',
    hazirla: async (p) => { await p.waitForTimeout(300); await p.getByRole('button', { name: 'Sil: tarif-kapak-2.jpg' }).click(); await p.getByText('Bu dosya silinsin mi?').first().waitFor(); await p.waitForTimeout(400); },
  },
  { ad: 'B6-filtre', yol: '/akis/RTD5?senaryo=berkin', hazirla: async (p) => { await p.getByRole('listitem', { name: /^Berkin yolu/ }).click(); } },
  {
    ad: 'B7-tarih-basili-tut', yol: '/akis/RTD5?senaryo=berkin',
    hazirla: async (p) => { const b = await p.getByRole('listitem', { name: /^6\. adım/ }).boundingBox(); await p.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2); await p.mouse.down(); await p.waitForTimeout(600); },
  },
  // S · Zaman sürgüsü
  { ad: 'S1-zaman-erken', yol: '/akis/RTD5?senaryo=berkin&an=2026-10-13T09:00' },
  { ad: 'S2-zaman-oynatiliyor', yol: '/akis/RTD5?senaryo=berkin&an=2026-10-17T12:00', once: async (p) => { await p.clock.install(); }, hazirla: async (p) => { await p.getByRole('button', { name: 'Oynat' }).click(); } },
  { ad: 'S3-zaman-ileri', yol: '/akis/RTD5?senaryo=berkin&an=2026-10-22T09:00' },
];
