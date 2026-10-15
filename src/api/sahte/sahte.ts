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

/** Sahte dosya deposu (Supabase Storage yerine): yol → boyut, tür. Yükleme istemcide taklit edilir (src/api/dosya.ts). */
export const sahteDepo = new Map<string, { boyut: number; tur: string }>();
const depo = {
  async yuklemeAdresi(yol: string) { return { url: 'sahte-depo:' + yol, token: 'sahte' }; },
  async indirmeAdresi(yol: string) { return 'data:text/plain;charset=utf-8,' + encodeURIComponent('Sahte dosya: ' + yol); },
  async bilgi(yol: string) { return sahteDepo.get(yol) || null; },
  async sil(yollar: string[]) { for (const y of yollar) sahteDepo.delete(y); },
};

export async function sahteSunucu(senaryo: Senaryo = 'berkin', o: { webAdresi?: string; acikKayit?: boolean; hal?: string | null } = {}) {
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
    RTD5: { 1: 'Brif', 2: 'Marka kiti', 3: 'TestFlight bağlantısı', 4: 'App Store onayı', 5: 'Metin', 6: 'Post görseli', 7: 'Onay', 8: 'Yayın onayı', 9: 'Yayın', 10: 'Rapor' },
    U422: { 15: 'Sızma testi raporu' },
    XPVZ: { 3: 'Belge modeli', 6: 'Yetki belgesi', 17: 'Vergi levhası', 5: 'Görüşme', 7: 'Belgeler', 9: 'Çiftçi kabul kararı', 11: 'Ürünler', 12: 'Profil' },
    GKX8: { 7: 'Çiftçi kabul kararı' },
  };
  // engelin kısa adı (0.10.0: devir_adim_guncelle engel_kisa → `baglam.engel_kisa`)
  const ENGEL_KISA: Record<string, Record<string, string>> = { RTD5: { 6: 'kapak fotoğraflarını' } };
  for (const a of T.akis) if (ENGEL_KISA[a.kisa_kod]) a.baglam = { ...(a.baglam || {}), engel_kisa: ENGEL_KISA[a.kisa_kod] };
  for (const a of T.akis) if (KISA_ADIM[a.kisa_kod]) a.baglam = { ...(a.baglam || {}), kisa_adlar: KISA_ADIM[a.kisa_kod] };
  for (const a of T.akis) if (KISA[a.kisa_kod]) a.baglam = { ...(a.baglam || {}), kisa_ad: KISA[a.kisa_kod] };
  // Hasat postu 6. adım (B8): Berkin'in eklediği iki fotoğraf + Claude'un bağlantı çıktısı
  const rtd = T.akis.find((x) => x.kisa_kod === 'RTD5');
  if (rtd) {
    T.cikti.push({ id: 9001, ws_id: BERKIN_ALAN, akis_id: rtd.id, adim_no: 6, ad: 'Carousel taslağı', ozet: '6 slaytlık carousel; 3 fotoğraf yeri boş.', url: 'https://claude.ai/artifact/D4h558LfBgr9pyBK3aM8y9', kaynak: 'Design canvas', surum: 1, durum: 'taslak', paylasim: 'ekip', kim: 'Berkin', arac: 'Claude', created_at: '2026-10-12T17:50:47Z' });
    [['tarif-kapak-1.jpg', 2_400_000], ['tarif-kapak-2.jpg', 2_300_000]].forEach(([ad, boyut], i) => {
      const id = `0000000${i + 1}-6a6a-4b4b-8c8c-d0d0d0d0d0d0`, yol = `${BERKIN_ALAN}/${rtd.id}/6/${id}/${ad}`;
      sahteDepo.set(yol, { boyut: boyut as number, tur: 'image/jpeg' });
      T.dosya.push({ id, ws_id: BERKIN_ALAN, akis_id: rtd.id, adim_no: 6, yol, ad, tur: 'image/jpeg', boyut, kim: 'Berkin', kim_tip: 'insan', durum: 'yuklendi', created_at: '2026-10-14T06:12:00Z' });
      T.cikti.push({ id: 9002 + i, ws_id: BERKIN_ALAN, akis_id: rtd.id, adim_no: 6, ad, ozet: 'Kapak fotoğrafı', url: 'dosya:' + id, kaynak: 'Devir dosya', surum: 1, durum: 'taslak', paylasim: 'ekip', kim: 'Berkin', arac: null, created_at: '2026-10-14T06:12:00Z' });
    });
  }
  // geçerli kararların kısa adları (C2 takımyıldızı; `karar.kisa` sütunu yok, §9 notu)
  const KARAR_KISA: [RegExp, string][] = [[/komisyon/i, 'Komisyon %12'], [/fatura/i, 'Faturalı satış'], [/organik/i, 'Organik ibaresi yok'], [/hayvansal/i, 'Hayvansal yok']];
  for (const k of T.karar) { const m = KARAR_KISA.find(([r]) => r.test(k.karar)); if (m) k.kisa = m[1]; }
  // Karadeniz 9. adımın karar kriteri (tasarımdaki kısa hali)
  const xpvz = T.akis.find((x) => x.kisa_kod === 'XPVZ'), gkx8 = T.akis.find((x) => x.kisa_kod === 'GKX8');
  const x9 = xpvz && T.adim.find((x) => x.akis_id === xpvz.id && x.no === 9);
  if (x9) x9.karar_kriteri = '5 çiftçi, en az 3’ü fatura kesebilir';
  // Ege 7. adım (C2): yapılandırılmış karar (§9-6) — Claude önerdi, Berkin hepsini kabul etti
  const g7 = gkx8 && T.adim.find((x) => x.akis_id === gkx8.id && x.no === 7);
  if (gkx8 && g7) {
    const ege = [['Ödemiş Kooperatifi', 'İzmir/Ödemiş · patates'], ['Tire Bahçe', 'İzmir/Tire · sebze'], ['Bergama Zeytin', 'İzmir/Bergama · zeytinyağı'], ['Kemalpaşa Kiraz', 'İzmir/Kemalpaşa · kiraz'], ['Torbalı Sebze', 'İzmir/Torbalı · sebze']];
    gkx8.baglam = { ...(gkx8.baglam || {}), kararlar: { 7: {
      tur: 'çiftçi', secenekler: ege.map(([ad, alt]) => ({ ad, alt, etiket: 'faturalı', uyari: false })),
      oneri: { kim: 'Claude', secim: ege.map(([ad]) => ad), ozet: '5’ini de kabul et', gerekce: 'Beşi de faturalı', at: g7.durum_at },
      secim: { secim: ege.map(([ad]) => ad), kim: 'Berkin', at: g7.durum_at },
    } } };
  }
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

  // E1 · Karadeniz 3. adımın tarihi mali müşavirin dönüşüne bağlı (§10: veride capa_soru yok, kurgu)
  if (o.hal === 'tarih' && xpvz) {
    const x3 = T.adim.find((x) => x.akis_id === xpvz.id && x.no === 3);
    if (x3) Object.assign(x3, { capa_soru: 'mali_donus', son_tarih: null, tarih_sabit: false });
    xpvz.baglam = { ...(xpvz.baglam || {}), bekleyen: { ...(xpvz.baglam?.bekleyen || {}), mali_donus: { soru: 'Mali müşavir hangi gün dönüş yapacak?', kisa: 'mali müşavir dönüş günü verince', tip: 'tarih', adim_no: null, kaynak: 'sonra' } } };
  }
  // E2, E3 · faturayı kim kesecek: 6. adım (kooperatif keserse) ile yeni 17. adım (her çiftçi keserse) koşullu dal
  if (o.hal === 'dal' && xpvz) {
    const x6 = T.adim.find((x) => x.akis_id === xpvz.id && x.no === 6);
    if (x6) {
      x6.kosul = { soru: 'fatura', deger: 'kooperatif' };
      T.adim.push({ ...x6, id: crypto.randomUUID(), no: 17, ad: 'Çiftçilerden vergi levhası iste', sahip: 'Çiftçi', kosul: { soru: 'fatura', deger: 'ciftci' }, kaynak: 'plan' });
      xpvz.baglam = { ...(xpvz.baglam || {}), bekleyen: { ...(xpvz.baglam?.bekleyen || {}), fatura: {
        soru: 'Kooperatif üyesi çiftçiler için faturayı kim kesecek?', kisa: 'Faturayı kimin keseceği', tip: 'secim', adim_no: null, kaynak: 'sonra',
        secenekler: [{ deger: 'kooperatif', etiket: 'Kooperatif adına toplu fatura', kisa: 'Kooperatif keserse', sonuc: 'Yetki belgesi adımı kalır' }, { deger: 'ciftci', etiket: 'Her çiftçi kendi adına', kisa: 'Her çiftçi keserse', sonuc: 'Çiftçilerden vergi levhası istenir' }],
      } } };
    }
  }

  // hal örnekleri (§10): gerçek sunucu koduyla yazılır, sonra saat halin bugününe gelir
  if (o.hal === 'karar') await halKarar(async (an, yol, govde) => { saat = Date.parse(an); await handle(new Request(TABAN + yol, { method: 'POST', headers: { authorization: `Bearer ${BERKIN_ANAHTAR}`, 'content-type': 'application/json' }, body: JSON.stringify(govde) }), db as any, saat, { taban: TABAN, depo }); });
  if (o.hal === 'uydu') await halUydu(async (an, yol, govde) => { saat = Date.parse(an); const r = await handle(new Request(TABAN + yol, { method: 'POST', headers: { authorization: `Bearer ${BERKIN_ANAHTAR}`, 'content-type': 'application/json' }, body: JSON.stringify(govde) }), db as any, saat, { taban: TABAN, depo }); return r.json(); });
  if (o.hal && HAL_SAAT[o.hal]) saat = Date.parse(HAL_SAAT[o.hal]);

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
      return handle(req, db as any, saat, { taban: TABAN, kimlik, depo });
    },
  };
}

const HAL_SAAT: Record<string, string> = { karar: '2026-11-07T12:00:00+03:00', uydu: '2026-11-04T12:00:00+03:00', gecikme: '2026-11-04T12:00:00+03:00' };
type Yaz = (an: string, yol: string, govde: unknown) => Promise<any>;
const AJAN = { kim: 'Hazırlık agent\'ı', kim_tip: 'agent', arac: 'Claude' };

/** C1 · 7 Kas: Karadeniz'de çiftçi kabul kararının sırası geldi; Claude 5 çiftçi önerdi. */
async function halKarar(yaz: Yaz) {
  const a = (no: number) => `/api/v1/akis/XPVZ/adim/${no}`;
  await yaz('2026-10-15T11:00:00+03:00', a(1), { durum: 'tamam', ...AJAN, cikti: { ad: 'Teklif paketi', ozet: '%12 komisyon, 7 gün ödeme' } });
  await yaz('2026-10-16T15:00:00+03:00', a(16), { durum: 'tamam', not: 'Kargo: Rize ve Trabzon toplama noktası' });
  await yaz('2026-10-17T10:00:00+03:00', a(4), { durum: 'suruyor' });
  await yaz('2026-10-21T17:00:00+03:00', a(4), { durum: 'tamam', not: '4 kooperatif yönetimiyle görüşüldü' });
  await yaz('2026-10-22T10:00:00+03:00', a(3), { durum: 'tamam', kim: 'Mali müşavir', not: 'Belge modeli netleşti' });
  await yaz('2026-10-23T10:00:00+03:00', a(5), { durum: 'suruyor' });
  await yaz('2026-10-29T18:00:00+03:00', a(5), { durum: 'tamam', not: '6 adayla görüşüldü' });
  await yaz('2026-11-03T12:00:00+03:00', a(7), { durum: 'tamam', kim: 'Çiftçi', not: 'Belgeler geldi; Çayeli vergi kaydı bekleniyor' });
  await yaz('2026-11-05T16:00:00+03:00', a(8), { durum: 'tamam', ...AJAN, not: 'Özçay organik sertifikası geçerli' });
  await yaz('2026-11-06T18:30:00+03:00', a(9), {
    kim: 'Claude', kim_tip: 'agent', arac: 'Claude',
    karar: {
      tur: 'çiftçi',
      secenekler: [
        { ad: 'Özçay Kooperatifi', alt: 'Trabzon/Of · organik çay', etiket: 'faturalı' },
        { ad: 'Hopa Çay', alt: 'Artvin/Hopa · çay', etiket: 'faturalı' },
        { ad: 'Hemşin Koop', alt: 'Rize/Hemşin · çay', etiket: 'faturalı' },
        { ad: 'Çayeli Kadın Girişimi', alt: 'Rize/Çayeli · teyit bekliyor', etiket: 'faturasız?', uyari: true },
        { ad: 'Ortakbahçe Koop', alt: 'Ordu · fındık', etiket: 'faturalı' },
      ],
      oneri: { secim: ['Özçay Kooperatifi', 'Hopa Çay', 'Hemşin Koop', 'Çayeli Kadın Girişimi', 'Ortakbahçe Koop'], ozet: '5’ini de kabul et', gerekce: '4’ü faturalı; Çayeli’nin vergi kaydı teyit bekliyor' },
    },
  });
}

/** D1, D2 · 4 Kas: Karadeniz'de görüşme, belgeler, ürünler ve profil 5 çiftçi için alt akışlarda yürüyor. */
async function halUydu(yaz: Yaz) {
  const a = (k: string, no: number) => `/api/v1/akis/${k}/adim/${no}`;
  await yaz('2026-10-15T11:00:00+03:00', a('XPVZ', 1), { durum: 'tamam', ...AJAN, cikti: { ad: 'Teklif paketi', ozet: '%12 komisyon, 7 gün ödeme' } });
  await yaz('2026-10-17T10:00:00+03:00', a('XPVZ', 4), { durum: 'suruyor' });
  await yaz('2026-10-19T17:00:00+03:00', a('XPVZ', 4), { durum: 'tamam', not: '4 kooperatif yönetimiyle görüşüldü' });
  await yaz('2026-10-19T17:30:00+03:00', a('XPVZ', 3), { durum: 'suruyor', kim: 'Mali müşavir' });
  const r = await yaz('2026-10-20T10:00:00+03:00', '/api/v1/akis/XPVZ/tekrar', { adimlar: [5, 7, 11, 12], kalemler: ['Özçay Kooperatifi', 'Hopa Çay', 'Hemşin Koop', 'Çayeli Kadın Girişimi', 'Ortakbahçe Koop'], kalem_turu: 'çiftçi', kalem_sahibi_adimlar: [7, 11] });
  const kod = (ad: string) => r.tekrar?.[0]?.kalemler?.find((k: any) => k.ad === ad)?.akis as string;
  const no = async (k: string, ustNo: number) => { const d = (r.tekrar[0].kalemler.find((x: any) => x.akis === k)?.adimlar || []).find((x: any) => x.ust_no === ustNo); return d?.no as number; };
  const ilerlet = async (ad: string, ustNo: number, an: string, govde: any) => { const k = kod(ad); if (!k) return; await yaz(an, a(k, await no(k, ustNo)), govde); };
  for (const [ad, g0] of [['Özçay Kooperatifi', 21], ['Hopa Çay', 22], ['Hemşin Koop', 23], ['Çayeli Kadın Girişimi', 27]] as [string, number][]) {
    await ilerlet(ad, 5, `2026-10-${g0}T11:00:00+03:00`, { durum: 'tamam', not: 'Görüşüldü; ilgili' });
  }
  await ilerlet('Ortakbahçe Koop', 5, '2026-11-02T10:00:00+03:00', { durum: 'suruyor' });
  await ilerlet('Özçay Kooperatifi', 7, '2026-10-29T15:00:00+03:00', { durum: 'tamam', kim: 'Çiftçi', not: 'Kimlik, vergi levhası, IBAN' });
  await ilerlet('Hopa Çay', 7, '2026-11-01T12:00:00+03:00', { durum: 'tamam', kim: 'Çiftçi', not: 'Kimlik, vergi levhası, IBAN' });
  await ilerlet('Hemşin Koop', 7, '2026-11-02T16:00:00+03:00', { durum: 'engelli', engel: 'IBAN eksik', engel_kisa: 'IBAN', kim: 'Çiftçi' });
  await ilerlet('Çayeli Kadın Girişimi', 7, '2026-11-03T10:00:00+03:00', { durum: 'suruyor', kim: 'Çiftçi' });
}
