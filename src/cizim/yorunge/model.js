// Kişi Yörüngeleri · model (13 Kas, sentez): zaman içinde adım durumu, kişi durumu, hamle. Prototipten taşındı
// (design-competition/harita-12kas/lejant-arac/sentez/prototip/model.js); renk tek kaynaktan (cizim/hamle).
import { kisiRengi } from '../hamle';
export const ALARM = '#FF5A5A', ISIK = '#FFF6E0', MUREKKEP = '#08222E';
export const SA = 36e5, GUN = 864e5, TSI = 3 * SA;
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const HAFTA = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const ms = (s) => (s ? Date.parse(s.length <= 10 ? s + 'T23:59:00+03:00' : s) : null);
const tsi = (t) => new Date(t + TSI);
const pad = (n) => String(n).padStart(2, '0');
export const gunAy = (t) => { const d = tsi(t); return `${d.getUTCDate()} ${AY[d.getUTCMonth()]}`; };
export const saatYaz = (t) => { const d = tsi(t); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
export const gunBasi = (t) => { const d = tsi(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - TSI; };
export const tarihKisa = (t, an) => {
  if (an != null && gunBasi(t) === gunBasi(an)) return 'bugün ' + saatYaz(t);
  if (an != null && gunBasi(t) === gunBasi(an) + GUN) return 'yarın';
  return gunAy(t);
};
export const anYaz = (t) => { const d = tsi(t); return `${d.getUTCDate()} ${AY[d.getUTCMonth()]} ${HAFTA[d.getUTCDay()]} · ${saatYaz(t)}`; };

// ---------- durum ----------
export const BITMIS = ['tamam', 'atlandi', 'ertelendi'];
const GORSEL = { tamam: 'lit', suruyor: 'run', hazir: 'wait', sirada: 'dark', engelli: 'block', ertelendi: 'ertele', atlandi: 'ghost' };
const sahibiAddan = (ad) => { const m = /^(.+?)['’](n?[iıuü]n)\s/.exec(ad || ''); return m ? m[1] : null; };

/** Bir kesitten model kurar. bakan: haritaya bakan kişinin adı. */
export function kur(ham, bakan, o = {}) {
  const A = ham.akis, simdi = ms(ham.simdi);
  const adimlar = A.adimlar.map((a) => ({ ...a }));
  const byNo = {}; adimlar.forEach((a) => (byNo[a.no] = a));
  // agent sahibi: addan (D10 düzeltmesi), yoksa alandan
  adimlar.forEach((a) => { if (a.sahip_tip === 'agent') a.sahibi = a.agent_sahibi || sahibiAddan(a.sahip); });
  // rutin_var (0.36.0): yalnız açık agent işinde anlamlı; alan gelmediyse rutin var sayılır
  adimlar.forEach((a) => { a.rutin_var = a.sahip_tip === 'agent' && !BITMIS.includes(a.durum) ? a.rutin_var !== false : null; });
  // kişiler: sahipler sırası (katılış), sonra adımlarda geçen diğerleri
  const kisiMap = new Map();
  const agSahibi = {}; adimlar.forEach((a) => { if (a.sahip_tip === 'agent' && a.sahibi && !agSahibi[a.sahip]) agSahibi[a.sahip] = a.sahibi; });
  const ekle = (ad, tip, sahibi) => { if (ad && !kisiMap.has(ad)) kisiMap.set(ad, { ad, tip, sahibi: tip === 'agent' ? sahibi || agSahibi[ad] || sahibiAddan(ad) : null, katilis: kisiMap.size }); };
  (A.sahipler || []).forEach((s) => ekle(s.ad, s.tip, null));
  adimlar.forEach((a) => { ekle(a.sahip, a.sahip_tip, a.sahibi); (a.ortak_sahipler || []).forEach((o) => ekle(o, byNo[a.no].sahip === o ? a.sahip_tip : 'insan')); });
  const dis = new Set((A.katilimcilar || []).map((k) => k.ad));
  let kisiler = [...kisiMap.values()];
  kisiler.forEach((k) => { if (dis.has(k.ad) && k.tip !== 'agent') k.tip = 'dis'; if (k.tip !== 'agent' && k.tip !== 'dis') k.tip = 'insan'; });
  // renk: kartlar ve diğer sayfalarla aynı kaynak (cizim/hamle kisiRengi); agent sahibinin açık tonu
  kisiler.forEach((k) => { k.renk = kisiRengi(k.ad, { tip: k.tip, sahibi: k.tip === 'agent' && k.sahibi !== k.ad ? k.sahibi : null, renkler: o.renkler }); });
  const ad2 = Object.fromEntries(kisiler.map((k) => [k.ad, k]));
  // yörünge sırası: insan/dış katılış sırasıyla, her birinin agent'ı hemen dışında (ay yörüngesi)
  const sira = [];
  kisiler.filter((k) => k.tip !== 'agent').forEach((k) => { sira.push(k); kisiler.filter((g) => g.tip === 'agent' && g.sahibi === k.ad).forEach((g) => sira.push(g)); });
  kisiler.filter((k) => k.tip === 'agent' && !sira.includes(k)).forEach((g) => sira.push(g));
  kisiler = sira; kisiler.forEach((k, i) => (k.i = i));

  // geçişler (olaylardan) + son durum
  const gecis = {}; adimlar.forEach((a) => (gecis[a.no] = []));
  (A.olaylar || []).forEach((o) => { if (o.durum && gecis[o.adim_no]) gecis[o.adim_no].push([ms(o.zaman), o.durum]); });
  const sentetik = [];
  adimlar.forEach((a) => {
    const g = gecis[a.no].sort((x, y) => x[0] - y[0]);
    const t = ms(a.durum_at);
    const son = g.length ? g[g.length - 1][1] : 'sirada';
    if (a.durum !== 'sirada' && son !== a.durum && t != null && t <= simdi + 1) {
      g.push([Math.max(t, g.length ? g[g.length - 1][0] : t), a.durum]);
      if (!(A.olaylar || []).some((o) => o.adim_no === a.no)) sentetik.push({ zaman: new Date(t).toISOString(), kim: a.sahip, kim_tip: a.sahip_tip, tip: 'durum', adim_no: a.no, durum: a.durum, ozet: '' });
    }
    a.gecis = g;
  });
  // plan anları
  adimlar.forEach((a) => {
    a.tPlan = BITMIS.includes(a.durum) ? ms(a.durum_at) : ms(a.en_erken_bitis);
    a.tarihsiz = !!a.tarih_bilinmiyor || a.tPlan == null;
    a.tSon = a.son_tarih ? ms(a.son_tarih) : null;
    const run = a.gecis.find((g) => g[1] === 'suruyor');
    a.tRun = run ? run[0] : null;
    const hz = a.gecis.find((g) => g[1] === 'hazir');
    a.tHazir = hz ? hz[0] : null;
  });
  // tahmini hazır/başlangıç (gelecek): bağımlıların bitişinden
  const bitis = (no, seen = new Set()) => {
    const a = byNo[no]; if (!a) return simdi;
    if (BITMIS.includes(a.durum)) return a.tPlan ?? simdi;
    return a.tPlan ?? simdi;
  };
  adimlar.forEach((a) => {
    if (BITMIS.includes(a.durum)) return;
    const dep = (a.bagimli || []).filter((d) => byNo[d]);
    const hz = Math.max(simdi, ...dep.map((d) => bitis(d)));
    if (a.durum === 'sirada') { a.tHazirP = hz; a.tRunP = Math.max(hz, (a.tPlan || hz) - (a.sure_tahmin_gun || 1) * GUN * .8); }
    if (a.durum === 'hazir') { a.tRunP = Math.max(simdi, (a.tPlan || simdi) - (a.sure_tahmin_gun || 1) * GUN * .8); }
  });
  // ortak görev: alt görev sahipleri ya da ortak_sahipler
  adimlar.forEach((a) => {
    const o = new Set(a.ortak_sahipler || []);
    a.ortak = [...o].filter((x) => x !== a.sahip);
    a.altlar = (a.alt_gorevler && a.alt_gorevler.length ? a.alt_gorevler.map((x) => (typeof x === 'object' ? x.no : x)) : adimlar.filter((b) => b.ust_adim === a.no).map((b) => b.no)).filter((n) => byNo[n]);
    a.sahipKisi = ad2[a.sahip];
    a.insan = a.sahip_tip === 'agent' ? a.sahibi || a.sahip : a.sahip;
  });
  // her kişinin adımları (ortak paylar dahil)
  kisiler.forEach((k) => { k.adimlar = adimlar.filter((a) => a.sahip === k.ad || a.ortak.includes(k.ad)).map((a) => a.no); k.kendi = adimlar.filter((a) => a.sahip === k.ad).map((a) => a.no); });

  const olaylar = [...(A.olaylar || []), ...sentetik].map((o) => ({ ...o, t: ms(o.zaman) })).sort((a, b) => a.t - b.t);
  const hedef = ms(A.hedef_tarih) || ms(A.en_erken_bitis);
  const ilk = Math.min(...adimlar.map((a) => (a.gecis[0] ? a.gecis[0][0] : Infinity)), simdi);
  const sonT = Math.max(hedef || 0, ...adimlar.map((a) => a.tPlan || 0), ms(A.bitis && A.bitis.aralik && A.bitis.aralik[1]) || 0);
  const M = { ham, A, simdi, hedef, hedefsiz: !A.hedef_tarih, adimlar, byNo, kisiler, kisi: ad2, olaylar, bakan, aralik: [gunBasi(ilk), gunBasi(sonT) + 2 * GUN], kritik: new Set(A.kritik_yol || []), kritikSira: A.kritik_yol || [] };
  const dz = A.karar_ozeti && A.karar_ozeti.darbogaz; M.darbogaz = dz ? dz.no : null; M.darbogazTut = dz ? dz.tuttugu : 0;
  // dış katılımcı: yalnız kendi adımları + onları tutan/bekleyen işler
  const bk = ad2[bakan];
  M.bakanTip = bk ? bk.tip : 'insan';
  if (bk && bk.tip === 'dis') {
    const g = new Set(bk.adimlar);
    bk.adimlar.forEach((n) => { (byNo[n].bagimli || []).forEach((d) => g.add(d)); (byNo[n].bekleyenler || []).forEach((d) => g.add(d)); });
    M.gorunur = g;
  } else M.gorunur = null;
  return M;
}

// ---------- an'a göre ----------
/** Adımın an'daki durumu: {g: lit|run|wait|dark|block|ertele|ghost|tahmin, d: ham durum, oto, isik (0..1), tahmin} */
export function adimAn(M, a, an) {
  const simdi = M.simdi;
  let d, tahmin = false, oto = null;
  if (an <= simdi) {
    d = 'sirada'; let ti = -1;
    a.gecis.forEach((g, i) => { if (g[0] <= an) { d = g[1]; ti = i; } });
    const sonMu = ti === a.gecis.length - 1 && d === a.durum;
    if (a.oto) oto = sonMu && a.oto_durum ? (a.oto_durum === 'tetiklendi' ? 'calisiyor' : a.oto_durum) : d === 'suruyor' ? 'calisiyor' : 'sirada';
  } else {
    d = a.durum;
    if (!BITMIS.includes(d) && a.oto && a.rutin_var === false && ['sirada', 'hazir'].includes(d)) {
      // rutin yok: kendiliğinden başlamaz; önü açılınca sırası gelir ve orada kalır
      if (a.tHazirP != null && an >= a.tHazirP) { d = 'hazir'; tahmin = d !== a.durum; }
    } else if (!BITMIS.includes(d)) {
      if (a.tPlan != null && an >= a.tPlan) { d = 'tamam'; tahmin = true; }
      else if (d === 'sirada') { if (a.tRunP != null && an >= a.tRunP) { d = 'suruyor'; tahmin = true; } else if (a.tHazirP != null && an >= a.tHazirP) { d = 'hazir'; tahmin = true; } }
      else if (d === 'hazir' && a.tRunP != null && an >= a.tRunP) { d = 'suruyor'; tahmin = true; }
    }
    if (a.oto) oto = !tahmin && a.oto_durum ? (a.oto_durum === 'tetiklendi' ? 'calisiyor' : a.oto_durum) : d === 'suruyor' ? 'calisiyor' : 'sirada';
  }
  let g = GORSEL[d] || 'dark';
  if (tahmin && d === 'tamam') g = 'tahmin';
  // ışık: sürekli
  const tRun = a.tRun ?? a.tRunP, tEnd = a.tPlan;
  let isik = 0;
  const runIsik = (t) => (tRun != null && tEnd != null && tEnd > tRun ? .2 + .55 * Math.max(0, Math.min(1, (t - tRun) / (tEnd - tRun))) : .45);
  if (g === 'run' || g === 'block' && tRun != null) isik = runIsik(an);
  if (g === 'lit' || g === 'tahmin') { const t0 = tEnd ?? an; const once = tRun != null ? .75 : 0; isik = once + (1 - once) * Math.max(0, Math.min(1, (an - t0) / (3 * SA))); }
  // nabız: hazır olduktan sonraki 2 saatte yavaşça belirir
  const tH = a.tHazir ?? a.tHazirP;
  const nabiz = g === 'wait' ? (tH != null ? Math.max(.25, Math.min(1, (an - tH) / (2 * SA))) : 1) : 0;
  return { g, d, oto, isik, nabiz, tahmin };
}

const ONCELIK = ['engel', 'ai_hata', 'karar', 'ai_onay', 'ai_rutinsiz', 'calisiyor', 'ai_calisiyor', 'sira', 'ai_sirada'];
/** kisiDurumu (src/cizim/kisi-durumu.ts) taşıması; öncelik sırası brif 2.5'e göre. */
export function kisiDurumu(M, k, an, S) {
  const kendi = k.adimlar.filter((n) => !M.byNo[n].tarihsiz || true);
  const t = (n) => M.byNo[n].tPlan ?? 1e15;
  const acik = kendi.filter((n) => ['run', 'wait', 'block', 'dark'].includes(S[n].g)).sort((a, b) => t(a) - t(b));
  const gecGun = (n) => { const ts = M.byNo[n].tSon; return ts != null && an > ts ? Math.ceil((an - ts) / GUN) : 0; };
  const rutinsiz = kendi.filter((n) => M.byNo[n].rutin_var === false && ['wait', 'dark'].includes(S[n].g));
  if (!acik.length) {
    const son = kendi.filter((n) => S[n].g !== 'ghost').sort((a, b) => t(b) - t(a))[0] ?? null;
    return { durum: 'bitti', no: son, tutan: null, gecGun: 0, acik: [] };
  }
  const tur = (n) => {
    const a = M.byNo[n], s = S[n];
    if (a.oto && a.sahip === k.ad) {
      if (s.g === 'block' || s.oto === 'hata') return 'ai_hata';
      if (s.oto === 'bakilacak') return 'ai_onay';
      if (s.g === 'run' || s.oto === 'calisiyor') return 'ai_calisiyor';
      if (s.g === 'wait') return a.rutin_var === false ? 'ai_rutinsiz' : 'ai_sirada';
      return null;
    }
    if (s.g === 'block') return 'engel';
    if (s.g === 'wait' && a.karar_adimi) return 'karar';
    if (s.g === 'run') return 'calisiyor';
    if (s.g === 'wait') return 'sira';
    return null;
  };
  const aday = acik.map((n) => ({ n, d: tur(n) })).filter((x) => x.d).sort((x, y) => ONCELIK.indexOf(x.d) - ONCELIK.indexOf(y.d) || t(x.n) - t(y.n));
  if (aday.length) return { durum: aday[0].d, no: aday[0].n, tutan: null, gecGun: gecGun(aday[0].n), acik, rutinsiz };
  const sonraki = acik[0], a = M.byNo[sonraki];
  const tutanlar = (a.bagimli || []).filter((d) => M.byNo[d] && !['lit', 'ghost', 'ertele', 'tahmin'].includes(S[d].g));
  const tutan = tutanlar.sort((x, y) => t(y) - t(x))[0] ?? null;
  // gelecek: kişinin hiçbir işi henüz başlamamış/bitmemiş (ilk işinin zamanı gelmedi)
  const basladi = kendi.some((n) => !['dark'].includes(S[n].g) && S[n].g !== 'ghost' || false);
  if (!basladi || tutan == null) {
    const tH = a.tHazirP ?? a.tRunP ?? a.tPlan;
    return { durum: 'gelecek', no: sonraki, tutan, gecGun: 0, gun: tH ? Math.max(1, Math.ceil((tH - an) / GUN)) : null, acik, rutinsiz };
  }
  return { durum: 'bekliyor', no: sonraki, tutan, gecGun: 0, acik, rutinsiz };
}

const ETIKET = { bitir: 'Bitir', karar: 'Karar ver', onayla: 'Onayla', engel: 'Engeli kaldır', kur: 'AI yapsın’ı kur' };
/** hamle (src/cizim/hamle.ts) taşıması, an'daki duruma göre. */
export function hamleAn(M, a, s, o = {}) {
  if (['lit', 'tahmin', 'ghost', 'ertele', 'dark'].includes(s.g)) return null;
  if (s.tahmin) return null; // gelecekte tahmini durum için hamle yok
  const agent = a.sahip_tip === 'agent', insan = agent ? a.sahibi || a.sahip : a.sahip;
  const ai = a.oto ? s.oto || 'sirada' : null;
  let tur = null;
  if (ai === 'bakilacak') tur = 'onayla';
  else if (s.g === 'block' || ai === 'hata') tur = 'engel';
  else if (ai) tur = a.rutin_var === false && o.ben === insan && s.g === 'wait' && ai === 'sirada' ? 'kur' : null;
  else if (a.karar_adimi) tur = 'karar';
  else if (s.g === 'wait' || s.g === 'run') tur = 'bitir';
  if (!tur) return null;
  const kim = tur === 'onayla' || tur === 'kur' || (tur === 'engel' && ai === 'hata') ? insan : agent && tur === 'bitir' ? insan : a.sahip;
  return { tur, kim, no: a.no, etiket: ETIKET[tur] };
}

export const KISI_DURUM_AD = { gelecek: 'sırası gelecek', bekliyor: 'bekliyor', sira: 'sırası geldi', calisiyor: 'çalışıyor', karar: 'karar verecek', engel: 'takıldı', bitti: 'işi bitti', ai_sirada: 'AI sırada', ai_calisiyor: 'AI çalışıyor', ai_onay: 'onay bekliyor', ai_hata: 'AI yapamadı', ai_rutinsiz: 'rutin yok' };
export const ADIM_DURUM_AD = { lit: 'bitti', run: 'sürüyor', wait: 'sırası geldi', dark: 'sırada', block: 'takıldı', ertele: 'ertelendi', ghost: 'atlandı', tahmin: 'bitmiş sayılır (tahmin)' };

/** an'daki bütün durum: adımlar, kişiler, hamleler. */
export function durumAn(M, an, o = {}) {
  const S = {}; M.adimlar.forEach((a) => (S[a.no] = adimAn(M, a, an)));
  const H = {}; M.adimlar.forEach((a) => { const h = hamleAn(M, a, S[a.no], { ben: M.bakan }); if (h) H[a.no] = h; });
  const K = {}; M.kisiler.forEach((k) => { K[k.ad] = kisiDurumu(M, k, an, S); K[k.ad].hamleler = Object.values(H).filter((h) => h.kim === k.ad).sort((x, y) => ['engel', 'karar', 'onayla', 'bitir', 'kur'].indexOf(x.tur) - ['engel', 'karar', 'onayla', 'bitir', 'kur'].indexOf(y.tur)); });
  return { S, H, K };
}

