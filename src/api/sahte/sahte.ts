/**
 * Sahte API: canlı sunucunun kendi kodu (sunucu/server.ts → handle) tarayıcıda, bellekteki bir veritabanıyla çalışır.
 * Veri tasarim/veri/ornek-veri.json'dan gelir; saat tasarımdaki "bugün"e (14 Eki 2026 10:00) sabitlenir.
 * Böylece özet cümleleri, kritik yol, bekleme süreleri ve hata cümleleri canlı API ile birebir aynıdır.
 * Yalnız `--mode sahte` derlemesinde yüklenir (dinamik içe aktarma).
 */
import { handle } from '../../../sunucu/server.ts';
import ornek from '../../../tasarim/veri/ornek-veri.json';

export const SAHTE_SIMDI = Date.parse('2026-10-14T10:00:00+03:00');
export const BERKIN_ALAN = 'c370682c-5111-4d7c-876f-b43dc9a8fe46';
export const BERKIN_ANAHTAR = 'dv_sahteBerkinAnahtari';
export const TABAN = 'https://sahte.devir/functions/v1/devir-mcp';

/** Senaryolar: oturumdaki kişinin durumu (A ekranları için). */
export type Senaryo = 'berkin' | 'bos' | 'davetli' | 'davetsiz' | 'iki-alan';
export interface SahteKimlik { auth_id: string; eposta: string }
export const SENARYO_KIMLIK: Record<Senaryo, SahteKimlik> = {
  berkin: { auth_id: 'sahte-berkin', eposta: 'berkin@ornek.com' },
  'iki-alan': { auth_id: 'sahte-berkin', eposta: 'berkin@ornek.com' },
  bos: { auth_id: 'sahte-berkin-yeni', eposta: 'berkin@ornek.com' },
  davetli: { auth_id: 'sahte-emre', eposta: 'emre@ornek.com' },
  davetsiz: { auth_id: 'sahte-davetsiz', eposta: 'emre.k@ornek.com' },
};

type Satir = Record<string, any>;
const sha256 = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, '0')).join('');
const esle = (r: Satir, w: Satir) => Object.entries(w).every(([k, v]) => (v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v));
const VARSAYILAN: Record<string, () => Satir> = {
  adim: () => ({ durum: 'sirada', ciktilar: [] }),
  akis: () => ({ durum: 'aktif', kurallar: {}, baglam: {} }),
  katilimci: () => ({ link_token: Math.random().toString(36).slice(2, 14) }),
  cikti: () => ({ durum: 'taslak', paylasim: 'ekip' }),
  davet: () => ({ durum: 'bekliyor' }),
  dosya: () => ({ durum: 'bekliyor' }),
};
const UUIDLI = ['adim', 'akis', 'taslak', 'katilimci', 'anahtar', 'kullanici', 'uye', 'davet', 'dosya'];

export function sahteDb(saat: () => number) {
  const T: Record<string, Satir[]> = JSON.parse(JSON.stringify(ornek));
  delete (T as any)._not;
  let id = 10_000;
  return {
    T,
    async one(t: string, w: Satir) { const r = (T[t] || []).find((x) => esle(x, w)); return r ? { ...r } : null; },
    async many(t: string, w: Satir, o?: string, limit?: number) {
      const x = (T[t] || []).filter((r) => esle(r, w));
      const s = o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x;
      return (limit ? s.slice(0, limit) : s).map((r) => ({ ...r }));
    },
    async insert(t: string, rows: Satir[]) {
      T[t] = T[t] || [];
      const simdi = new Date(saat()).toISOString();
      const out = rows.map((r) => ({ id: UUIDLI.includes(t) ? crypto.randomUUID() : id++, created_at: simdi, durum_at: simdi, ...(VARSAYILAN[t]?.() || {}), ...r }));
      T[t].push(...out);
      return out.map((r) => ({ ...r }));
    },
    async update(t: string, w: Satir, p: Satir) { for (const r of T[t] || []) if (esle(r, w)) Object.assign(r, p); },
    async delete(t: string, w: Satir) { T[t] = (T[t] || []).filter((r) => !esle(r, w)); },
  };
}

export async function sahteSunucu(senaryo: Senaryo = 'berkin', o: { webAdresi?: string; acikKayit?: boolean } = {}) {
  let saat = SAHTE_SIMDI;
  const db = sahteDb(() => saat);
  const T = db.T;
  // kayıt varsayılan açık (herkese açık sürüm); ?kayit=kapali ile davetle açılan sunucu
  T.ayar = [{ anahtar: 'web_adresi', deger: o.webAdresi ?? location.origin }, { anahtar: 'acik_kayit', deger: o.acikKayit === false ? 'hayir' : 'evet' }];
  T.uye = []; T.davet = []; T.dosya = [];
  // kısa ad (§9 öneri `akis.kisa_ad`; 0.10.0'da `baglam.kisa_ad`tan döner): tasarımdaki ekran adları
  const KISA: Record<string, string> = { RTD5: 'Hasat postu', U422: 'Test Bank', GKX8: 'Ege', '4BZC': 'Offsite', NESR: 'İzmir', XPVZ: 'Karadeniz', '4WDK': 'Karadeniz' };
  // adım kısa adları (`baglam.kisa_adlar`; harita etiketleri ve cümleler)
  const KISA_ADIM: Record<string, Record<string, string>> = {
    RTD5: { 1: 'Brif', 2: 'Marka kiti', 3: 'TestFlight bağlantısı', 4: 'App Store onayı', 5: 'Metin', 6: 'Görsel', 7: 'Onay', 8: 'Yayın onayı', 9: 'Yayın', 10: 'Rapor' },
  };
  for (const a of T.akis) if (KISA_ADIM[a.kisa_kod]) a.baglam = { ...(a.baglam || {}), kisa_adlar: KISA_ADIM[a.kisa_kod] };
  for (const a of T.akis) if (KISA[a.kisa_kod]) a.baglam = { ...(a.baglam || {}), kisa_ad: KISA[a.kisa_kod] };
  // Berkin'in anahtarı (dökümde token_hash yok)
  const berkinAnahtar = T.anahtar.find((k) => k.kullanici_id === BERKIN_ALAN && k.kisi === 'Berkin')!;
  berkinAnahtar.token_hash = await sha256(BERKIN_ANAHTAR);
  const uye = (auth_id: string, eposta: string, kullanici_id: string, kisi: string, rol: string, kapsam: string | null = null, created_at = '2026-10-12T14:31:16Z') =>
    T.uye.push({ id: crypto.randomUUID(), auth_id, eposta, kullanici_id, kisi, rol, kapsam, created_at, son_giris: null });
  if (senaryo === 'berkin' || senaryo === 'iki-alan') uye('sahte-berkin', 'berkin@ornek.com', BERKIN_ALAN, 'Berkin', 'sahip');
  if (senaryo === 'iki-alan') uye('sahte-berkin', 'berkin@ornek.com', '42bfd48c-a3af-4ca7-bc87-07acdb14f045', 'Berkin', 'ekip', null, '2026-10-13T09:00:00Z');
  if (senaryo === 'bos') {
    // yeni sahip: ilk girişte boş çalışma alanı (A2 · 5 dakikada ilk akış)
    T.kullanici.push({ id: 'bos-alan', ad: 'Berkin · çalışma alanı', created_at: '2026-10-14T06:55:00Z' });
    uye('sahte-berkin-yeni', 'berkin@ornek.com', 'bos-alan', 'Berkin', 'sahip', null, '2026-10-14T06:55:00Z');
  }
  if (senaryo === 'davetli') T.davet.push({ id: crypto.randomUUID(), kullanici_id: BERKIN_ALAN, eposta: 'emre@ornek.com', kisi: 'Emre', rol: 'dis', kapsam: 'Emre (Test Bank)', davet_eden: 'Berkin', durum: 'bekliyor', created_at: '2026-10-14T06:40:00Z' });

  const kimlik = async (jwt: string) => {
    const m = /^sahte:([^:]+):(.+)$/.exec(jwt);
    return m ? { id: m[1], email: m[2] } : null;
  };
  return {
    db,
    /** Saati ilerletir (yazmaların sırası olay kaydında korunur). */
    ilerlet(ms = 60_000) { saat += ms; },
    async istek(req: Request): Promise<Response> {
      if (req.method !== 'GET') saat += 1000;
      return handle(req, db as any, saat, { taban: TABAN, kimlik });
    },
  };
}
