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
  { ad: 'A3-claudea-bagla', yol: '/bagla?senaryo=berkin', hazirla: async (p) => { await p.getByText('devir-mcp', { exact: false }).first().waitFor(); } },
  { ad: 'A4-oauth-onay', yol: '/oauth/onay?authorization_id=istek1&senaryo=berkin', hazirla: async (p) => { await p.getByRole('button', { name: 'İzin ver' }).waitFor(); } },
  { ad: 'A4b-oauth-gecersiz', yol: '/oauth/onay?authorization_id=gecersiz&senaryo=berkin', hazirla: async (p) => { await p.getByText('Bağlantı kurulamadı').waitFor(); } },
  { ad: 'A4c-oauth-giris', yol: '/oauth/onay?authorization_id=istek1&senaryo=berkin&oturum=yok', hazirla: async (p) => { await p.getByText('Giriş bağlantısı gönder').waitFor(); } },
  { ad: 'A4-davet-kabul', yol: '/?senaryo=davetli' },
  { ad: 'A5-davet-yok', yol: '/?senaryo=davetsiz&kayit=kapali' },
  { ad: 'A5-alan-ac', yol: '/?senaryo=davetsiz' }, // açık kayıt (tasarımda PNG yok)
  // B · Günlük
  { ad: 'B1-evren', yol: '/?senaryo=berkin', hazirla: async (p) => { await p.getByText('tutuyor', { exact: false }).first().waitFor(); await p.waitForTimeout(600); } },
  { ad: 'B2-akislar', yol: '/akislar?senaryo=berkin', hazirla: async (p) => { await p.getByText('akış sürüyor', { exact: false }).waitFor(); await p.waitForTimeout(800); } },
  { ad: 'B3-galaksi', yol: '/akis/RTD5?senaryo=berkin' },
  { ad: 'B4-adim', yol: '/akis/RTD5/adim/6?senaryo=berkin', hazirla: async (p) => { await p.getByText('tutuyor').waitFor(); await p.waitForTimeout(400); } },
  { ad: 'B5-adim-gecmis', yol: '/akis/RTD5/adim/6?senaryo=berkin&sekme=gecmis', hazirla: async (p) => { await p.getByRole('heading', { name: 'GEÇMİŞ' }).waitFor(); await p.waitForTimeout(400); } },
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
  { ad: 'D1-galaksi-uydular', yol: '/akis/XPVZ?senaryo=berkin&hal=uydu', hazirla: async (p) => { await p.getByText('tamamladı', { exact: false }).waitFor(); await p.waitForTimeout(400); } },
  { ad: 'E1-cevapsiz-tarih', yol: '/akis/XPVZ?senaryo=berkin&hal=tarih', hazirla: async (p) => { await p.getByText('belli olur', { exact: false }).waitFor(); await p.waitForTimeout(400); } },
  { ad: 'E2-kosullu-dal', yol: '/akis/XPVZ?senaryo=berkin&hal=dal', hazirla: async (p) => { await p.getByText('biri kalır', { exact: false }).waitFor(); await p.waitForTimeout(400); } },
  { ad: 'E3-cevapla', yol: '/akis/XPVZ/soru/fatura?senaryo=berkin&hal=dal', hazirla: async (p) => { await p.getByText('Henüz bilmiyorum').waitFor(); await p.waitForTimeout(500); } },
  { ad: 'F1-sayfa', yol: '/l/k7Q2emreTestBank00wP9?senaryo=berkin', hazirla: async (p) => { await p.getByText('Başladım').waitFor(); await p.waitForTimeout(400); } },
  { ad: 'F2-cikti-ekle', yol: '/l/k7Q2emreTestBank00wP9?senaryo=berkin', hazirla: async (p) => { await p.getByRole('button', { name: 'Tamam' }).click(); await p.getByText('Dosya seç').waitFor(); await p.waitForTimeout(600); } },
  { ad: 'F2b-dosya-yukleniyor', yol: '/l/k7Q2emreTestBank00wP9?senaryo=berkin', hazirla: async (p) => { await p.getByRole('button', { name: 'Tamam' }).click(); await p.getByText('Dosya seç').waitFor(); await p.waitForTimeout(500); await p.locator('input[type=file]').setInputFiles({ name: 'ip-izin-listesi.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(1_300_000, 1) }); await p.waitForTimeout(820); } },
  { ad: 'F2c-dosya-hazir', yol: '/l/k7Q2emreTestBank00wP9?senaryo=berkin', hazirla: async (p) => { await p.getByRole('button', { name: 'Tamam' }).click(); await p.getByText('Dosya seç').waitFor(); await p.waitForTimeout(500); await p.locator('input[type=file]').setInputFiles({ name: 'ip-izin-listesi.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(1_300_000, 1) }); await p.getByText('yüklendi', { exact: false }).waitFor(); await p.getByPlaceholder('Ne gönderdiğini bir cümleyle yaz').fill('3 sabit IP; ofis ve iki sunucu'); await p.locator(':focus').blur(); await p.waitForTimeout(300); } },
  { ad: 'F2d-dosya-hata', yol: '/l/k7Q2emreTestBank00wP9?senaryo=berkin', hazirla: async (p) => { await p.getByRole('button', { name: 'Tamam' }).click(); await p.getByText('Dosya seç').waitFor(); await p.waitForTimeout(500); await p.locator('input[type=file]').setInputFiles({ name: 'ag-semasi-tam.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(24_000_000, 1) }); await p.waitForTimeout(400); } },
  { ad: 'F3-tesekkur', yol: '/l/k7Q2emreTestBank00wP9?senaryo=berkin', hazirla: async (p) => { await p.getByRole('button', { name: 'Tamam' }).click(); await p.getByText('Dosya seç').waitFor(); await p.locator('input[type=file]').setInputFiles({ name: 'ip-izin-listesi.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(300_000, 1) }); await p.getByText('yüklendi', { exact: false }).waitFor(); await p.getByRole('button', { name: /Teslim et ve bitir/ }).click(); await p.getByText('Teşekkürler', { exact: false }).waitFor(); await p.waitForTimeout(900); } },
  { ad: 'F4-gecersiz-baglanti', yol: '/l/gecersizbaglanti0000?senaryo=berkin', hazirla: async (p) => { await p.getByText('artık açılmıyor', { exact: false }).waitFor(); await p.waitForTimeout(300); } },
  { ad: 'G1-baglanti-gonder', yol: '/akis/U422?senaryo=berkin', hazirla: async (p) => { await p.getByRole('listitem', { name: /^Emre \(Test Bank\) yolu/ }).click(); await p.getByText('WhatsApp’ta gönder').waitFor(); await p.waitForTimeout(600); } },
  { ad: 'H1-taslak-sorulari', yol: '/yeni/TEURX?senaryo=berkin', hazirla: async (p) => { await p.getByText('Akışı kur').waitFor(); await p.waitForTimeout(400); } },
  { ad: 'J1-evren-20-akis', yol: '/?senaryo=berkin&hal=olcek', hazirla: async (p) => { await p.getByText('akış sürüyor', { exact: false }).waitFor(); await p.waitForTimeout(1200); } },
  { ad: 'J2-galaksi-30-adim', yol: '/akis/OLC8?senaryo=berkin&hal=olcek30', hazirla: async (p) => { await p.waitForTimeout(900); } },
  { ad: 'I1-akis-kapandi', yol: '/akis/GKX8?senaryo=berkin', hazirla: async (p) => { await p.getByText('Dersleri gör').waitFor(); await p.waitForTimeout(400); } },
  { ad: 'I2-hedef-gecti', yol: '/akis/RTD5?senaryo=berkin&hal=gecikme', hazirla: async (p) => { await p.waitForTimeout(800); } },
  { ad: 'I3-dosyalari-sil', yol: '/akis/GKX8?senaryo=berkin', hazirla: async (p) => { await p.getByRole('button', { name: 'Akış menüsü' }).click(); await p.getByRole('button', { name: 'Bütün dosyaları sil' }).click(); await p.getByRole('textbox').fill('Ege'); await p.waitForTimeout(700); } },
  { ad: 'K1-ayarlar', yol: '/ayarlar?senaryo=berkin&hal=ekip', hazirla: async (p) => { await p.getByText('ANAHTARLAR').waitFor(); await p.getByText('davet bekliyor', { exact: false }).waitFor(); await p.waitForTimeout(400); } },
  { ad: 'K2-uyeler', yol: '/ayarlar/ekip?senaryo=berkin&hal=ekip', hazirla: async (p) => { await p.getByText('ÜYELER').waitFor(); await p.waitForTimeout(400); } },
  { ad: 'K2b-davet-et', yol: '/ayarlar/ekip?senaryo=berkin&hal=ekip', hazirla: async (p) => { await p.getByRole('button', { name: 'Kişi davet et' }).click(); await p.getByLabel('E-posta').fill('emre@ornek.com'); await p.getByLabel('Adı', { exact: true }).fill('Emre'); await p.getByRole('tab', { name: 'Dış katılımcı' }).click(); await p.getByLabel('Adımlardaki adı').fill('Emre (Test Bank)'); await p.getByLabel('E-posta').focus(); await p.waitForTimeout(600); } },
  { ad: 'K2c-davet-paylas', yol: '/ayarlar/ekip?senaryo=berkin&hal=ekip', hazirla: async (p) => { await p.getByRole('button', { name: 'Bağlantıyı paylaş' }).click(); await p.getByText('Davet kaydedildi').first().waitFor(); await p.waitForTimeout(600); } },
  { ad: 'K2d-uye', yol: '/ayarlar/ekip?senaryo=berkin&hal=ekip', hazirla: async (p) => { await p.getByRole('button', { name: /^Selin: rol/ }).click(); await p.getByText('Alandan çıkar').waitFor(); await p.waitForTimeout(600); } },
  { ad: 'K2e-uye-cikar', yol: '/ayarlar/ekip?senaryo=berkin&hal=ekip', hazirla: async (p) => { await p.getByRole('button', { name: /^Selin: rol/ }).click(); await p.getByText('Alandan çıkar').click(); await p.getByText('Selin çıkarılsın mı?').first().waitFor(); await p.waitForTimeout(600); } },
  { ad: 'K3-alan-sec', yol: '/hesap?senaryo=berkin&hal=ekip', hazirla: async (p) => { await p.getByText('Çıkış yap').waitFor(); await p.waitForTimeout(700); } },
  { ad: 'T1-tablet-galaksi', w: 1024, h: 768, yol: '/akis/RTD5?senaryo=berkin', hazirla: async (p) => { await p.getByText('ŞERİTLER').waitFor(); await p.waitForTimeout(900); } },
  { ad: 'M1-harita-panel', w: 1440, h: 900, yol: '/akis/RTD5?senaryo=berkin', hazirla: async (p) => { await p.getByText('ŞERİTLER').waitFor(); await p.waitForTimeout(900); } },
  { ad: 'M2-evren', w: 1440, h: 900, yol: '/?senaryo=berkin', hazirla: async (p) => { await p.getByText('PANO', { exact: true }).waitFor(); await p.waitForTimeout(1500); } },
  { ad: 'X1-arsiv', yol: '/akislar/arsiv?senaryo=berkin&hal=olcek', hazirla: async (p) => { await p.getByText('kapandı', { exact: false }).first().waitFor(); await p.waitForTimeout(600); } },
  { ad: 'D2-kalem-listesi', yol: '/akis/XPVZ/tekrar/7?senaryo=berkin&hal=uydu', hazirla: async (p) => { await p.getByText('Hemşin Koop').waitFor(); await p.waitForTimeout(500); } },
  { ad: 'C1-karar-bekleyen', yol: '/akis/XPVZ/adim/9?senaryo=berkin&hal=karar', hazirla: async (p) => { await p.getByText('Kararı ver').waitFor(); await p.waitForTimeout(500); } },
  { ad: 'C2-karar-verildi', yol: '/akis/GKX8/adim/7?senaryo=berkin', hazirla: async (p) => { await p.getByText('Verildi', { exact: false }).waitFor(); await p.waitForTimeout(500); } },
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
