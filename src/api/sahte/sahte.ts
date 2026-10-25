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
    U422: { 15: 'Sızma testi raporu', 14: 'IP izin listesi', 2: 'Güvenlik değerlendirmesi' },
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
  // I3 · Ege'de 6 dosya (§10: dosya adları ve boyutları kurgu)
  const ege = T.akis.find((x) => x.kisa_kod === 'GKX8');
  if (ege) ([['sozlesme-ozcay-imzali.pdf', 2.1, 'application/pdf'], ['urun-listesi-ege.xlsx', .4, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], ['vitrin-fotograflari-1.jpg', 3.8, 'image/jpeg'], ['vitrin-fotograflari-2.jpg', 4.1, 'image/jpeg'], ['vitrin-fotograflari-3.jpg', 3.9, 'image/jpeg'], ['sozlesme-tire-imzali.pdf', 4.1, 'application/pdf']] as [string, number, string][]).forEach(([ad, mb, tur], i) => {
    const id = `0000001${i}-7a7a-4c4c-8d8d-e0e0e0e0e0e0`, yol = `${BERKIN_ALAN}/${ege.id}/${i < 2 ? 9 : 11}/${id}/${ad}`, boyut = Math.round(mb * 1e6);
    sahteDepo.set(yol, { boyut, tur });
    T.dosya.push({ id, ws_id: BERKIN_ALAN, akis_id: ege.id, adim_no: i < 2 ? 9 : 11, yol, ad, tur, boyut, kim: 'Berkin', kim_tip: 'insan', durum: 'yuklendi', created_at: `2026-10-12T18:${String(20 + i).padStart(2, '0')}:00Z` });
  });
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
  // Bildirimler (el notu 18): ekipten son hareketler (kurgu; durum değiştirmeyen olaylar, Berkin'in görünümü için)
  if (senaryo === 'berkin') {
    const ak = (k: string) => T.akis.find((x) => x.kisa_kod === k)?.id;
    const ol: [string, number, string, string, string, string, string][] = [
      ['4BZC', 4, 'Otel / mekan temsilcisi', 'dis', 'not', 'İki otelden teklif geldi; üçüncüsü pazartesi.', '2026-10-13T11:05:00+03:00'],
      ['U422', 14, 'Emre (Test Bank)', 'dis', 'not', 'IP listesi bankanın ağ ekibinde; cuma dönüş bekleniyor.', '2026-10-13T16:30:00+03:00'],
      ['RTD5', 6, 'Claude', 'agent', 'not', 'Kapak fotoğrafları gelince carousel’i tamamlayacağım.', '2026-10-13T18:05:00+03:00'],
      ['U422', 3, 'Ölçüm planı agent\'ı', 'agent', 'guncelleme', 'ilerleme: Event taksonomisinde 42 olay listelendi.', '2026-10-14T07:15:00+03:00'],
      ['U422', 15, 'Selin', 'insan', 'guncelleme', 'ilerleme: Raporun ilk taslağı hazır; bulgular güvenlik ekibine gidiyor.', '2026-10-14T08:40:00+03:00'],
      ['U422', 15, 'Selin', 'insan', 'cikti', 'Adım 15 · çıktı: Sızma testi özeti', '2026-10-14T08:42:00+03:00'],
    ];
    ol.forEach(([k, no, kim, kim_tip, tip, ozet, at], i) => { const id = ak(k); if (id) T.olay.push({ id: 950001 + i, akis_id: id, adim_no: no, kim, kim_tip, arac: kim_tip === 'agent' ? 'Claude' : null, tip, ozet, veri: {}, created_at: new Date(at).toISOString() }); });
  }
  // K1–K3 · ekip hali (§10): Selin katıldı, Emre'nin daveti bekliyor; Berkin'in ikinci alanı (Kapsama testi, gerçek) ve Misafir daveti (kurgu)
  if (o.hal === 'ekip' && senaryo === 'berkin') {
    uye('sahte-selin', 'selin@ornek.com', BERKIN_ALAN, 'Selin', 'ekip', null, '2026-10-12T15:10:00Z');
    T.uye[T.uye.length - 1].son_giris = '2026-10-13T16:20:00Z';
    T.davet.push({ id: crypto.randomUUID(), kullanici_id: BERKIN_ALAN, eposta: 'emre@ornek.com', kisi: 'Emre', rol: 'dis', kapsam: 'Emre (Test Bank)', davet_eden: 'Berkin', durum: 'bekliyor', created_at: '2026-10-14T06:40:00Z' });
    uye('sahte-berkin', 'berkin@ornek.com', '0a95cfe3-5281-4332-bd01-a90156398867', 'Berkin', 'sahip', null, '2026-10-13T13:40:48Z');
    T.davet.push({ id: crypto.randomUUID(), kullanici_id: '42bfd48c-a3af-4ca7-bc87-07acdb14f045', eposta: 'berkin@ornek.com', kisi: 'Berkin', rol: 'ekip', kapsam: null, davet_eden: 'Misafir', durum: 'bekliyor', created_at: '2026-10-13T20:00:00Z' });
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

  // F1–F3 · Test Bank'ta Emre'nin kişisel bağlantısı (G1: 12 Eki'de üretildi; örnek veride katılımcı yok, kurgu)
  const u422 = T.akis.find((x) => x.kisa_kod === 'U422');
  if (u422) T.katilimci.push({ id: crypto.randomUUID(), akis_id: u422.id, ad: 'Emre (Test Bank)', rol: 'Test Bank BT', iletisim: null, link_token: EMRE_BAGLANTI, created_at: '2026-10-12T15:02:00Z' });

  // J1 · ölçek (sentetik): 16 aktif + 4 kapanan akış; gerçek akışların zamanı kaydırılmış kopyaları
  if (o.hal === 'olcek') halOlcek(T);
  // J2 · ölçek (sentetik): 30 adım, 8 kişi
  if (o.hal === 'olcek30') halOtuz(T);

  // hal örnekleri (§10): gerçek sunucu koduyla yazılır, sonra saat halin bugününe gelir
  // Yazan kişi kimlik bilgisinden belirlenir (S-C1): insanın yazması kendi e-postalı oturumuyla (anahtarla gelen istek
  // agent sayılır); agent yazması MCP üzerinden Berkin'in anahtarıyla gider ("Claude (Berkin adına)").
  const kimlik = async (jwt: string) => {
    const m = /^sahte:([^:]+):(.+)$/.exec(jwt);
    return m ? { id: m[1], email: m[2] } : null;
  };
  const oturumOf = (kisi: string) => {
    const ad = kisi || 'Berkin';
    let u = T.uye.find((x) => x.kullanici_id === BERKIN_ALAN && x.kisi === ad);
    if (!u) {
      const n = T.uye.length + 1;
      T.uye.push({ id: crypto.randomUUID(), auth_id: `sahte-hal-${n}`, eposta: `hal${n}@ornek.com`, kullanici_id: BERKIN_ALAN, kisi: ad, rol: ad === 'Berkin' ? 'sahip' : 'ekip', kapsam: null, created_at: '2026-10-12T14:31:16Z', son_giris: null });
      u = T.uye[T.uye.length - 1];
    }
    return `sahte:${u.auth_id}:${u.eposta}`;
  };
  const yaz: Yaz = async (an, yol, govde: any) => {
    saat = Date.parse(an);
    const { kim, kim_tip, ...g } = govde || {};
    const m = /^\/api\/v1\/akis\/([^/]+)\/adim\/(\d+)$/.exec(yol);
    if (kim_tip === 'agent' && m) {
      const body = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'devir_adim_guncelle', arguments: { akis: m[1], no: Number(m[2]), ...g } } };
      const r = await handle(new Request(`${TABAN}/${BERKIN_ANAHTAR}`, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Claude' }, body: JSON.stringify(body) }), db as any, saat, { taban: TABAN, depo });
      return r.json();
    }
    const r = await handle(new Request(TABAN + yol, { method: 'POST', headers: { authorization: `Bearer ${oturumOf(kim)}`, 'content-type': 'application/json', 'x-devir-alan': BERKIN_ALAN }, body: JSON.stringify(g) }), db as any, saat, { taban: TABAN, kimlik, depo });
    return r.json();
  };
  if (o.hal === 'karar') await halKarar(yaz);
  if (o.hal === 'uydu') await halUydu(yaz);
  if (o.hal === 'gecikme') await halGecikme(yaz);
  if (o.hal === 'alt') await halAlt(yaz);
  if (o.hal && HAL_SAAT[o.hal]) saat = Date.parse(HAL_SAAT[o.hal]);

  return {
    db,
    /** Saati ilerletir (yazmaların sırası olay kaydında korunur). */
    ilerlet(ms = 60_000) { saat += ms; },
    async istek(req: Request): Promise<Response> {
      if (req.method !== 'GET') saat += 1000;
      // taslak motoru LLM ister; sahte kipte örnek veride açık duran Karadeniz taslağı döner (kredi harcanmaz)
      if (req.method === 'POST' && new URL(req.url).pathname.endsWith('/api/v1/tasla')) {
        await new Promise((r) => setTimeout(r, 1200));
        const t = await handle(new Request(TABAN + '/api/v1/taslak/TEURX', { headers: req.headers }), db as any, saat, { taban: TABAN, kimlik, depo });
        return new Response(JSON.stringify({ mesaj: 'Taslak TEURX hazır.', taslak: await t.json() }), { headers: { 'content-type': 'application/json' } });
      }
      return handle(req, db as any, saat, { taban: TABAN, kimlik, depo });
    },
  };
}

/** Sahte kipte Emre'nin bağlantısı: /l/k7Q2emreTestBank00wP9 */
export const EMRE_BAGLANTI = 'k7Q2emreTestBank00wP9';
const HAL_SAAT: Record<string, string> = { karar: '2026-11-07T12:00:00+03:00', uydu: '2026-11-04T12:00:00+03:00', gecikme: '2026-11-04T12:00:00+03:00', alt: '2026-10-14T10:00:00+03:00' };
type Yaz = (an: string, yol: string, govde: unknown) => Promise<any>;
const AJAN = { kim_tip: 'agent', arac: 'Claude' };

const GUNMS = 864e5;
const kayIso = (t: string | null | undefined, d: number) => (t ? new Date(Date.parse(t) + d).toISOString() : t);
const kayGun = (t: string | null | undefined, d: number) => (t ? new Date(Date.parse(t + 'T12:00:00+03:00') + d).toISOString().slice(0, 10) : t);
let klonNo = 0;
/** Akışın zamanı kaydırılmış kopyası (tasarım son-ortak.js kaydir): akış, adımlar ve olaylar birlikte kayar. */
function klonla(T: Record<string, any[]>, kod: string, gun: number, o: { ad?: string; kapandi?: string; karar?: boolean } = {}) {
  const A = T.akis.find((x) => x.kisa_kod === kod); if (!A) return;
  const d = gun * GUNMS, id = crypto.randomUUID(), kk = `K${String(++klonNo).padStart(3, '0')}`;
  const ad = o.ad || A.baglam?.kisa_ad || kod;
  T.akis.push({ ...JSON.parse(JSON.stringify(A)), id, kisa_kod: kk, created_at: kayIso(A.created_at, d), hedef_tarih: kayGun(A.hedef_tarih, d), durum: o.kapandi ? 'kapandi' : 'aktif', kapandi_at: o.kapandi || null, baglam: { ...(A.baglam || {}), kisa_ad: ad }, kurallar: { ...(A.kurallar || {}), karar_insanda: !!o.karar } });
  const adimlar = T.adim.filter((x) => x.akis_id === A.id).map((x) => ({ ...JSON.parse(JSON.stringify(x)), id: crypto.randomUUID(), akis_id: id, created_at: kayIso(x.created_at, d), durum_at: kayIso(x.durum_at, d), son_tarih: kayGun(x.son_tarih, d), ...(o.kapandi && x.durum !== 'atlandi' ? { durum: 'tamam' } : {}) }));
  if (o.karar) { const h = adimlar.find((x) => x.durum === 'hazir'); if (h) h.karar_kriteri = 'Seçim kullanıcıda'; }
  T.adim.push(...adimlar);
  T.olay.push(...T.olay.filter((x) => x.akis_id === A.id && x.tip !== 'akis_kapandi').map((x) => ({ ...JSON.parse(JSON.stringify(x)), id: 900000 + T.olay.length, akis_id: id, created_at: kayIso(x.created_at, d) })));
  if (o.kapandi) T.olay.push({ id: 900000 + T.olay.length, akis_id: id, adim_no: null, kim: 'Berkin', kim_tip: 'insan', arac: null, tip: 'akis_kapandi', ozet: 'Akış kapandı', veri: {}, created_at: o.kapandi });
}
function halOlcek(T: Record<string, any[]>) {
  const kl: [string, number, string, boolean][] = [['RTD5', 18, '', false], ['4BZC', 30, 'Eğitim', true], ['NESR', -4, '', false], ['U422', -14, 'Ankara', false], ['XPVZ', -40, '', false], ['RTD5', 34, '', false], ['4BZC', 44, '', true], ['NESR', -20, '', false], ['RTD5', 8, '', false], ['U422', 12, '', false], ['4BZC', 10, '', false]];
  const adlar: Record<string, number> = {};
  for (const [k, g, ad, karar] of kl) { const temel = T.akis.find((x) => x.kisa_kod === k)?.baglam?.kisa_ad || k; adlar[temel] = (adlar[temel] || 1) + 1; klonla(T, k, g, { ad: ad || `${temel} ${adlar[temel]}`, karar }); }
  klonla(T, 'RTD5', -9, { kapandi: '2026-10-04T09:00:00Z', ad: 'Hasat ekim' });
  klonla(T, 'NESR', -60, { kapandi: '2026-10-08T09:00:00Z', ad: 'İzmir yaz' });
  klonla(T, '4BZC', -30, { kapandi: '2026-10-10T15:00:00Z', ad: 'Offsite eylül' });
}
/** J2 · 30 adım, 8 kişi; bağımlılık yok (tasarım son-ekranlar-3.js sentetik30). */
function halOtuz(T: Record<string, any[]>) {
  const NOW = Date.parse('2026-10-14T10:00:00+03:00'), t0 = NOW - 10 * GUNMS, id = crypto.randomUUID();
  const kisiler: [string, string][] = [['Berkin', 'insan'], ['Claude', 'agent'], ['Selin', 'insan'], ['Ayşe', 'dis'], ['Emre', 'dis'], ['Mali müşavir', 'dis'], ['Hazırlık agent’ı', 'agent'], ['Kooperatif', 'dis']];
  let sd = 30 >>> 0; const rr = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const A = T.akis.find((x) => x.kisa_kod === 'RTD5')!;
  const st: any[] = [];
  for (let i = 1; i <= 30; i++) {
    const [sahip, tip] = kisiler[(i * 3 + (i > 20 ? 1 : 0)) % 8];
    const gun = Math.round(-9 + (i / 30) * 52 + (rr() - .5) * 6), ef = t0 + 10 * GUNMS + gun * GUNMS + (i % 3 === 0 ? 0 : 3 * 36e5);
    st.push({ id: crypto.randomUUID(), akis_id: id, no: i, ad: `Adım ${i}`, sahip, sahip_tip: tip, durum: ef < NOW ? 'tamam' : 'sirada', durum_at: new Date(ef < NOW ? ef : t0).toISOString(), son_tarih: new Date(ef + 3 * 36e5).toISOString().slice(0, 10), sure_tahmin_gun: ef < NOW ? 1 : Math.max(.5, (ef - NOW) / GUNMS), bagimli: [], ciktilar: [], kaynak: 'sablon', created_at: new Date(t0).toISOString(), ...(i % 9 === 0 ? { karar_kriteri: 'Seçim kullanıcıda' } : {}) });
  }
  const gor = new Set<string>();
  for (const x of st.slice().sort((a, b) => a.son_tarih.localeCompare(b.son_tarih))) if (x.durum === 'sirada' && !gor.has(x.sahip)) { gor.add(x.sahip); x.durum = 'hazir'; x.durum_at = new Date(NOW - 36e5).toISOString(); }
  const e = st.find((x) => x.durum === 'hazir' && x.sahip === 'Ayşe'); if (e) { e.durum = 'engelli'; e.engel = 'Belge eksik'; }
  T.akis.push({ ...JSON.parse(JSON.stringify(A)), id, kisa_kod: 'OLC8', baslik: 'Ölçek sınaması', created_at: new Date(t0).toISOString(), hedef_tarih: new Date(t0 + 62 * GUNMS + 3 * 36e5).toISOString().slice(0, 10), durum: 'aktif', kapandi_at: null, taslak_id: null, baglam: { kisa_ad: 'Ölçek sınaması' } });
  T.adim.push(...st);
  T.olay.push({ id: 990000, akis_id: id, adim_no: null, kim: 'Berkin', kim_tip: 'insan', arac: null, tip: 'akis_olustu', ozet: 'Akış kuruldu', veri: {}, created_at: new Date(t0).toISOString() });
}

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
    kim_tip: 'agent', arac: 'Claude',
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

/** I2 · 4 Kas: Hasat postunda TestFlight, görsel ve onay bitti; App Store onayı bekleniyor, hedef 3 gün geçti. */
async function halGecikme(yaz: Yaz) {
  const a = (no: number) => `/api/v1/akis/RTD5/adim/${no}`;
  await yaz('2026-10-17T12:00:00+03:00', a(3), { durum: 'tamam', not: 'TestFlight bağlantısı gönderildi' });
  await yaz('2026-10-21T15:00:00+03:00', a(6), { durum: 'tamam', kim_tip: 'agent', arac: 'Claude', cikti: { ad: 'Post görseli', ozet: 'Kapak ve 3 tarif slaytı' } });
  await yaz('2026-10-23T11:00:00+03:00', a(7), { durum: 'tamam', not: 'Görsel onaylandı' });
  // App Store incelemesi 31 Eki'de başladı (tasarım: en erken 7 Kas)
  await yaz('2026-10-31T10:00:00+03:00', a(4), { durum: 'suruyor', not: 'İncelemeye gönderildi' });
}

/** D1, D2 · 4 Kas: Karadeniz'de görüşme, belgeler, ürünler ve profil 5 çiftçi için alt akışlarda yürüyor. */
/** W5: RTD5'in 10. adımı (ilk 48 saat raporu) üç alt göreve bölünmüş; biri erkenden bitmiş. */
async function halAlt(yaz: Yaz) {
  await yaz('2026-10-14T09:00:00+03:00', '/api/v1/akis/RTD5/adim/10/alt', { alt_gorevler: [{ ad: 'Ölçüm tablosunu kur' }, { ad: 'Instagram içgörülerini çek' }, { ad: 'Raporu yaz', sahip: 'Claude', sahip_tip: 'agent' }] });
  await yaz('2026-10-14T09:40:00+03:00', '/api/v1/akis/RTD5/adim/11', { durum: 'tamam', zorla: true, not: 'Tablo hazır; yayından önce kuruldu' });
}
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
