// Tasarım kaynağından (d3-son/kaynak/yol-ciz.js, galaksi-v3.js clusterBadge, son-ortak.js uydular) taşındı.
// Geometrinin tamamı src/geometri/galaksi-geometri.ts (kur) modülünden gelir; bu dosya yalnız çizer.
// Fark: girdi API detayından kurulur (akisModeli); üye renkleri ada göre değil role göre seçilir.
import { apidenAkis } from '../geometri/galaksi-geometri';
import { ilerleme } from '../api/ilerleme';
import { olcekliKur, TAU } from '../geometri/zaman-olcegi';
import { kurKol } from '../geometri/kol-geometri';
import { kolHarita } from '../geometri/kol-bayrak';
import { C, destekGemisi, f, pill, planet, ship, kapi, yildiz } from './ortak.js';
import { hamle as hamleOf, damla, kisiRengi } from './hamle';

export const GUN = 864e5;
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const tl = (ms) => new Date(ms + 3 * 36e5);
export const gunAy = (ms) => { const d = tl(ms); return `${d.getUTCDate()} ${AY[d.getUTCMonth()]}`; };
export const gunAyHafta = (ms) => { const d = tl(ms); return `${d.getUTCDate()} ${AY[d.getUTCMonth()]} ${DOW[d.getUTCDay()]}`; };
export const saat = (ms) => { const d = tl(ms); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const sans = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-family="Bricolage" font-size="${o.fs || 12}" font-weight="${o.fw || 500}" fill="${o.col || C.ink2}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.ls ? `letter-spacing="${o.ls}"` : ''}>${esc(t)}</text>`;
export function kart(x, y, w, h, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 22}" fill="${o.fill || '#061A24'}" fill-opacity="${o.op ?? .72}" stroke="${o.stroke || '#FFFFFF'}" stroke-opacity="${o.sop ?? .08}"/>`;
}
const BIT = (d) => ['tamam', 'atlandi', 'ertelendi'].includes(d);

/**
 * API akış detayından (GET /akis/:kod) çizim modeli: F (adımların durum/sahip/bağımlılık özeti) + AK (geometri girdisi).
 * sahip: akışın sahibi (üye sırasında ilk, yolu kuruluşta başlar); yoksa oturumdaki kişi.
 */
export function akisModeli(detay0, o = {}) {
  // W5: alt görevler gezegen değil, üst görevinin uyduları (cumleler.uydular); model yalnız ana görevlerle kurulur
  const ana = detay0.adimlar.filter((a) => a.ust_adim == null), anaNo = new Set(ana.map((a) => a.no));
  const detay = ana.length === detay0.adimlar.length ? detay0 : { ...detay0, adimlar: ana, kritik_yol: (detay0.kritik_yol || []).filter((n) => anaNo.has(n)) };
  const k = detay.akis;
  const F = {
    kod: k.kod, baslik: k.baslik, kapandi: k.kapandi_at ? Date.parse(k.kapandi_at) : null,
    steps: detay.adimlar.map((a) => ({ no: a.no, ad: a.ad, sahip: a.sahip, tip: a.sahip_tip, durum: a.durum, dep: a.bagimli || [], karar: !!a.karar_adimi, cikti: (a.cikti_sayisi || 0) > 0, agentSahibi: a.agent_sahibi || null, oto: otoRozet(a), sahipKisiId: a.sahip_kisi_id || null })),
    // sunucunun darboğazı (R11): haritadaki taç en az ışıklı
    darbogaz: k.karar_ozeti?.darbogaz?.no ?? null,
  };
  const AK = apidenAkis(detay, { sahip: o.sahip });
  if (o.haric) AK.haric = o.haric;
  return { F, AK, sahip: o.sahip, detay };
}
const byNoOf = (F) => F.steps.reduce((m, s) => (m[s.no] = s, m), {});

/**
 * Üye rengi (W7, 6 Kas, "Kimin Hamlesi"): durum renksiz olduğu için renk yalnız kişiyi söyler; kişinin kayıtlı rengi
 * (renkler; Ayarlar'dan) yoksa addan sabit bir palet rengi. Agent sahibinin açık tonudur. Görev kartındaki düğme ve
 * haritadaki damla aynı rengi kullanır (hamle.ts kisiRengi).
 */
export const UYE_PALET = ['#8EC5FF', '#FFE08A', '#D9B3FF', '#7FD6E8', '#F5B3A3', '#C7B8FF'];
export const TAKIM_RENGI = '#C9C2E8';
export function uyeRenkleri(G, sahip, ajanSahibi = {}, renkler = {}) {
  const r = {};
  for (const u of G.uyeler) r[u.ad] = kisiRengi(u.ad, { tip: u.tip, sahibi: ajanSahibi[u.ad] && ajanSahibi[u.ad] !== u.ad ? ajanSahibi[u.ad] : null, renkler });
  return r;
}
/** agent adı → sahibi (adımların agent_sahibi alanından; ilk yazan kazanır) */
export function ajanSahipleri(steps) {
  const m = {};
  for (const s of steps) if (s.tip === 'agent' && s.agentSahibi && !m[s.sahip]) m[s.sahip] = s.agentSahibi;
  return m;
}
export const kisaAd = (ad) => ad.replace(/\s*\(.*\)$/, '').replace(/ agent’ı| agent'ı/, '').split(' ')[0];
/** AI yapsın rozeti durumu (0.29.0): sunucunun oto_durum alanından. */
export const otoRozet = (a) => (!a.oto ? null : a.oto_durum === 'tetiklendi' ? 'calisiyor' : a.oto_durum === 'bakilacak' ? 'bakilacak' : a.oto_durum === 'hata' ? 'hata' : 'bekliyor');
export const yolD = (pts) => pts.length < 2 ? '' : pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ',' + f(p[1])).join('');
const PRI = { block: 0, wait: 1, run: 1, dark: 2, lit: 3, ertele: 4, ghost: 4, tahmin: 3 };
const SONUK = ['lit', 'ghost', 'ertele'];

/**
 * Küçük işaretler (plan 27 Eki, 3.A): altın elmas = kritik yol, belge = çıktı; bayrak (karar) planet() içinde.
 * Darboğaz tacı: 1 ışıklı, 2 nabız atan (dongu-tac); 0'da taç yok.
 */
export function tac(x, y, r, k, sekilVar = k === 2) {
  if (!k) return '';
  // 2 Kas: mercan yalnız engel demek; taç lila ışık. Taç şekli yalnız asıl darboğazda (sunucunun darboğazı ya da 2. kademe),
  // her ışıklı adımda değil; yoksa harita taçla dolar
  const w = Math.max(5, r * .9), h = w * .62, ty = -r - h * .35 - 2;
  const sekil = `<path d="M${f(-w / 2)},${f(ty + h / 2)} L${f(-w / 2)},${f(ty - h / 2)} L${f(-w / 4)},${f(ty)} L0,${f(ty - h * .7)} L${f(w / 4)},${f(ty)} L${f(w / 2)},${f(ty - h / 2)} L${f(w / 2)},${f(ty + h / 2)}Z" fill="#F4EEFF" stroke="#2A1D4F" stroke-width=".8" stroke-linejoin="round"/>`;
  return `<g transform="translate(${f(x)},${f(y)})"${k === 2 ? ' class="dongu-tac"' : ''}><circle r="${f(r * 2.4)}" fill="url(#glowLilac)" opacity="${k === 2 ? 1 : .7}"/>${k === 2 ? `<circle r="${f(r + 7)}" fill="none" stroke="#E9DEFF" stroke-width="1" opacity=".6"/>` : ''}${sekilVar ? sekil : ''}</g>`;
}
export const elmas = (x, y, s = 1) => `<path d="M${f(x)},${f(y - 4.2 * s)} L${f(x + 3.2 * s)},${f(y)} L${f(x)},${f(y + 4.2 * s)} L${f(x - 3.2 * s)},${f(y)}Z" fill="#FFD27A" stroke="#2A1D4F" stroke-width=".8"/>`;
export const belge = (x, y, s = 1) => `<g transform="translate(${f(x)},${f(y)}) scale(${f(s)})"><path d="M-3,-4 H1.6 L3.4,-2.2 V4 H-3Z" fill="#E2D6F5" stroke="#2A1D4F" stroke-width=".7"/><path d="M-1.6,-.6 H1.8 M-1.6,1.4 H1.8" stroke="#2A1D4F" stroke-width=".6"/></g>`;

// küme rozeti: öndeki gezegen + arkasında silik eşleri + sayı rozeti (renge değil sayıya dayanır)
export function clusterBadge(x, y, members, radOf, stOf, ps = 1) {
  const ms = members.slice().sort((a, b) => PRI[stOf(a)[0]] - PRI[stOf(b)[0]] || radOf(b) - radOf(a));
  const fr = ms[0], r = Math.max(radOf(fr), 11 * ps);
  let s = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r + 9 * ps)}" fill="#061A24" fill-opacity=".55" stroke="#D9CCFF" stroke-width="1" stroke-dasharray="1.5 3"/>`;
  ms.slice(1).forEach((no, i) => { const a = (-40 + i * 50) * Math.PI / 180; s += `<g opacity=".8">${planet(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8, r * .62, stOf(no)[0] === 'ghost' ? 'dark' : stOf(no)[0], {})}</g>`; });
  s += planet(x, y, r, stOf(fr)[0], stOf(fr)[1]);
  const bx = x - r * .8 - 3 * ps, by = y - r * .8 - 3 * ps;
  // 2 Kas: krem daire yalnız merkezdeki bitti sayısında; küme rozeti koyu, "+n" = öndekinin arkasındaki adım sayısı
  s += `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(8.5 * ps)}" fill="#08222E" stroke="#D9CCFF" stroke-width="1.2"/><text x="${f(bx)}" y="${f(by + 3.6 * ps)}" text-anchor="middle" font-family="Bricolage" font-weight="800" font-size="${f(9.5 * ps)}" fill="#FFF3E8">+${members.length - 1}</text>`;
  return s;
}

// uydular (eski düzen): evren kartlarındaki mini kalem halkası; galaksi haritası uyduSistemi() kullanır
export function uydular(x, y, r, kalemler, ps = 1, o = {}) {
  const n = kalemler.length, orR = r + (o.gap ?? 15) * ps;
  let s = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(orR)}" fill="none" stroke="#D9CCFF" stroke-width="1" stroke-dasharray="1.5 3" opacity=".75"/>`;
  if (!n) return s;
  // sayım sunucuyla aynı (ilerleme, m6): atlanan ve ertelenen kalem toplamdan düşer; kalanların hepsi bitince yay tam
  const { tamam: done, toplam } = ilerleme(kalemler);
  if (done && toplam) { const a1 = -90 + done / toplam * 360, p = (a) => [x + Math.cos(a * Math.PI / 180) * orR, y + Math.sin(a * Math.PI / 180) * orR]; const [x0, y0] = p(-90), [x1, y1] = p(Math.min(a1, 269.9)); s += `<path d="M${f(x0)},${f(y0)} A${f(orR)},${f(orR)} 0 ${a1 + 90 > 180 ? 1 : 0} 1 ${f(x1)},${f(y1)}" fill="none" stroke="#FFD27A" stroke-width="2" stroke-linecap="round"/>`; }
  kalemler.forEach((k, i) => {
    const a = (-90 + (i + .5) / n * 360) * Math.PI / 180, mx = x + Math.cos(a) * orR, my = y + Math.sin(a) * orR, mr = (o.mr ?? 4.6) * ps;
    // ip: ana gezegene bağlı olduğu görülsün (alt adım, ayrı gezegen değil)
    if (o.ip) s += `<path d="M${f(x + Math.cos(a) * (r + 1))},${f(y + Math.sin(a) * (r + 1))} L${f(mx - Math.cos(a) * mr)},${f(my - Math.sin(a) * mr)}" stroke="#D9CCFF" stroke-width="1" opacity=".55"/>`;
    if (k.durum === 'tamam') s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr * 2.4)}" fill="url(#glowMint)" opacity=".8"/><circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="url(#pGreen)"/>`;
    else if (k.durum === 'suruyor') s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr + 2.2)}" fill="none" stroke="#DCE8FF" stroke-width="1"/><circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="url(#pRun)"/>`;
    else if (k.durum === 'hazir') s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr + 2.2)}" fill="none" stroke="#FFB547" stroke-width="1"/><circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="url(#pAmber)"/>`;
    else if (k.durum === 'engelli') s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="url(#pBlock)"/><path d="M${f(mx - mr * .6)},${f(my - mr * .6)} L${f(mx + mr * .6)},${f(my + mr * .6)}" stroke="#08222E" stroke-width="1.6"/>`;
    else if (k.durum === 'atlandi' || k.durum === 'ertelendi') s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr * .8)}" fill="none" stroke="#A99BDB" stroke-width=".9" stroke-dasharray="1.5 1.5" opacity=".8"/>`;
    else s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="#08222E" stroke="#B9A6F2" stroke-width="1.2"/>`;
    if (o.ini) s += sans(f(mx + Math.cos(a) * 13 * ps), f(my + Math.sin(a) * 13 * ps + 3.5), k.ad[0], { fs: 9.5 * ps, fw: 750, col: C.ink2, anchor: 'middle' });
  });
  return s;
}


const UYDU_DURUM = { tamam: 'lit', suruyor: 'run', hazir: 'wait', engelli: 'block', atlandi: 'ghost', ertelendi: 'ertele' };
/**
 * Uydu sistemi v2 (plan 27 Eki, 3.B): alt görev ya da kalemi olan gezegen.
 * Uzakta (o.yakin yok): Satürn halkası; altın yay biten oranı, yanında "k/n". Kalem (tekrar) halkası boncuklu.
 * Yakında: uydular gezegenin çevresinde Arşimet sarmalına zaman sırasıyla dizilir (en erken en içte); uydu gezegenin
 * yarısı boyunda sabit, sayısı artınca küçülmez, sarmal uzar. Uydu küçük bir gezegendir: aynı durum dili.
 * ks: [{ ad, durum, t?, kalem? }]
 */
export function uyduSistemi(x, y, r, ks, ps = 1, o = {}) {
  const n = ks.length; if (!n) return '';
  // k/n sunucunun ilerleme kuralıyla (m6): atlanan ve ertelenen uydu toplamdan düşer. Böylece bitmiş üst görevin halkası tam
  // dolar (ör. 12 kalemden biri atlandıysa 11/11, 11/12 değil); hepsi atlandıysa sayı yazılmaz
  const { tamam: done, toplam } = ilerleme(ks), kalem = ks.some((k) => k.kalem);
  if (!o.yakin) {
    const rx = r * 1.95 + 2 * ps, ry = rx * .32, aci = -18 * Math.PI / 180, ca = Math.cos(aci), sa = Math.sin(aci);
    const nok = (th) => [x + rx * Math.cos(th) * ca - ry * Math.sin(th) * sa, y + rx * Math.cos(th) * sa + ry * Math.sin(th) * ca];
    const yay = (a0, a1) => { const P = []; for (let i = 0; i <= 28; i++) P.push(nok(a0 + (a1 - a0) * i / 28)); return yolD(P); };
    const cizgi = kalem ? `stroke-dasharray="0 ${f(3.2 * ps)}" stroke-linecap="round" stroke-width="${f(2.2 * ps)}"` : `stroke-width="${f(1.3 * ps)}"`;
    let s = `<path class="uydu-halka" d="${yay(0, Math.PI * 2)}" fill="none" stroke="#D9CCFF" opacity=".7" ${cizgi}/>`;
    if (done && toplam) s += `<path d="${yay(Math.PI, Math.PI + done / toplam * Math.PI * 2)}" fill="none" stroke="#FFD27A" ${kalem ? cizgi : `stroke-width="${f(2 * ps)}" stroke-linecap="round"`}/>`;
    if (!toplam) return s;
    const [tx, ty] = nok(0);
    // en kötü açık durumun boncuğu (plan 2 Kas, durum dili 2): engel uzaktan da görünsün; engelli > sırası geldi > sürüyor
    const kotu = ['engelli', 'hazir', 'suruyor'].find((d) => ks.some((k) => k.durum === d));
    const BONCUK = { engelli: '#FF8A78', hazir: '#FFB547', suruyor: '#A8C4FF' };
    if (kotu) s += `<circle class="uydu-boncuk" data-durum="${kotu}" cx="${f(tx)}" cy="${f(ty)}" r="${f(2.8 * ps)}" fill="${BONCUK[kotu]}" stroke="#08222E" stroke-width="${f(.8 * ps)}"/>`;
    return s + sans(f(tx + (kotu ? 6 : 4) * ps), f(ty + 3.5 * ps), `${done}/${toplam}`, { fs: 9 * Math.max(1, ps), fw: 750, col: '#FFE6B0' });
  }
  // adlar yazılınca (Z3) aralık yazı satırı kadar açılır
  // dokunulur uydular (o.hedef, plan 28 Eki B4): 44 px hedefler birbirine ve gezegenin hedefine binmesin diye aralık açılır
  const mr = Math.max(2.6 * ps, r * .5), ara = Math.max(2 * mr * 1.25, o.adlar ? 17 : 0, o.hedef ? 46 : 0), b = ara / (2 * Math.PI);
  const bosluk = o.hedef ? Math.max((o.bosluk ?? 7) * ps, Math.max(22, r + 6) + 23 - r - mr) : (o.bosluk ?? 7) * ps;
  const sira = ks.map((k, i) => ({ k, i })).sort((p, q) => (p.k.t ?? p.i) - (q.k.t ?? q.i) || p.i - q.i);
  let th = -Math.PI / 2, s = '', yol = [];
  const rho = (t) => r + mr + bosluk + b * (t + Math.PI / 2);
  const P = sira.map(() => { const p = [x + Math.cos(th) * rho(th), y + Math.sin(th) * rho(th)]; th += ara / rho(th); return p; });
  for (let t = -Math.PI / 2; t <= th - ara / rho(th) + .01; t += .12) yol.push([x + Math.cos(t) * rho(t), y + Math.sin(t) * rho(t)]);
  if (yol.length > 1) s += `<path d="${yolD(yol)}" fill="none" stroke="#D9CCFF" stroke-width="${f(.8 * ps)}" stroke-dasharray="1.5 2.5" opacity=".6"/>`;
  sira.forEach(({ k }, i) => {
    const [mx, my] = P[i];
    s += planet(mx, my, mr, UYDU_DURUM[k.durum] || 'dark', { life: false, mini: true, waitRings: 1 });
    // dokunma hedefleri için uydunun yeri (plan 28 Eki, B4)
    if (o.yerler && k.no != null) o.yerler.push({ no: k.no, ust: o.ust, x: mx, y: my, r: mr });
    if (o.ini && !o.adlar) s += sans(f(mx), f(my + mr * .45), esc((k.ad[0] || '').toLocaleUpperCase('tr')), { fs: Math.max(7, mr * 1.2), fw: 800, col: '#FFF3E8', anchor: 'middle' });
    // ad dışa doğru: gezegenin solundaki uydu sola, sağındaki sağa yazılır
    // dokunulur sarmalda (o.hedef) ad gezegenden dışa doğru, uydunun açısında (komşu uydunun adına binmez)
    if (o.adlar && o.hedef) {
      const ux = (mx - x) / Math.hypot(mx - x, my - y), uy = (my - y) / Math.hypot(mx - x, my - y), dd = mr + 4 * ps;
      const anchor = ux > .35 ? 'start' : ux < -.35 ? 'end' : 'middle';
      s += sans(f(mx + ux * dd), f(my + uy * dd + (anchor === 'middle' ? (uy > 0 ? 9 : -2) : 3.5)), esc(kisalt(k.ad, 18)), { fs: 10, fw: 600, col: C.ink2, anchor });
    } else if (o.adlar) { const sol = mx < x; s += sans(f(mx + (sol ? -1 : 1) * (mr + 3 * ps)), f(my + 3.5), esc(kisalt(k.ad, 18)), { fs: 10, fw: 600, col: C.ink2, anchor: sol ? 'end' : 'start' }); }
  });
  return s;
}
const kisalt = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);

// fenerler bir nokta dizisi boyunca (14 px aralık)
function fenerDizisi(pts, ps = 1, aralik = 14) {
  let s = '', acc = 0, n = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0);
    let d = aralik - acc;
    while (d <= L) { const x = x0 + (x1 - x0) * d / L, y = y0 + (y1 - y0) * d / L; s += `<g transform="translate(${f(x)},${f(y)}) scale(${ps})"><g class="dongu-fener" style="animation-delay:${(n++ % 8) * 120}ms"><circle r="6" fill="url(#glowGold)" opacity=".8"/><rect x="-2.3" y="-2.9" width="4.6" height="5.8" rx="1.5" fill="#FFE29A" stroke="#C98A4E" stroke-width=".6"/></g></g>`; d += aralik; }
    acc = (acc + L) % aralik;
  }
  return s;
}

/**
 * Sarmal harita. M: akisModeli(). o: { cx, cy, R, ps, now, x (sürgü anı), focus (üye adı), durumOdak (no → bool), sel (adım no), labels, states, sats, haric,
 *   ships, lod: 'detay'|'kucuk', allLit, sira, spin, sis, ip, fener, kule, kuleEtiket, kuleDx, tw, shipSc, rk, rad, pr,
 *   ok (öğe katsayısı: gemi, gezegen), rf (gezegen yarıçap işlevi; verilirse ok yerine), yk (yazı katsayısı) }
 */
/**
 * Kol haritasının tarih halkaları (9 Kas): her gün ince halka, pazartesi belirgin ve tarihli; hedef halkası pirinç,
 * bugün halkası şeftali ve kesik (içi yapılmış iş). Halkalar sabittir: ölçek o anki süreye göre değişmez.
 */
function kolHalkalari(G, now, m, yk, kapali) {
  let s = '';
  const g0 = Math.ceil((G.T0 - 3 * 36e5) / GUN) * GUN + 21 * 36e5, son = G.T0 + (G.RS > G.RH ? (G.hedef - G.T0) * 1.6 : 0);
  for (let t = g0; G.rT(t) < G.RS - .5 && t < son + 60 * GUN; t += GUN) {
    const r = G.rT(t), pzt = tl(t).getUTCDay() === 1;
    s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(r)}" fill="none" stroke="#B9A6F2" stroke-width="${pzt ? .7 : .35}" ${pzt ? '' : 'stroke-dasharray="1 4"'} opacity="${pzt ? .34 : .2}"/>`;
    if (pzt && Math.abs(t - G.hedef) > 2 * GUN) s += sans(f(G.cx + 3 * m), f(G.cy - r + 10 * m), gunAy(t), { fs: 9 * m * yk, fw: 600, col: C.ink3 });
  }
  s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(G.RH)}" fill="none" stroke="url(#brass)" stroke-width="${f(1.8 * m)}" opacity=".85"/>`;
  if (G.RS > G.RH + 2) s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(G.RS)}" fill="none" stroke="#FF8A78" stroke-width=".8" stroke-dasharray="2 5" opacity=".45"/>`;
  if (!kapali) {
    const rb = G.rT(now);
    s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(rb)}" fill="url(#glowPeach)" opacity=".06"/>`;
    s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(rb)}" fill="none" stroke="#FFC9A3" stroke-width="${f(1.6 * m)}" stroke-dasharray="${f(7 * m)} ${f(5 * m)}" opacity=".9"/>`;
    s += pill(G.cx, G.cy + rb, 'Bugün · ' + gunAy(now), { fs: 9.5 * m * yk, fw: 700, col: '#2A1D4F', bg: '#FFC9A3', bgo: 1 });
  }
  return s;
}

export function yolCiz(M, o = {}) {
  const F = M.F, NOWx = o.now, X = o.x ?? NOWx, ps = o.ps ?? 1, kucuk = o.lod === 'kucuk';
  const AK = M.AK;
  // zaman ölçeği (plan 27 Eki, D): bugünü büyütür; o.tau = 0 doğrusal
  // kol haritası (9 Kas, bayrakla): kol = kişi, halka = tarih; çizim aynı, yalnız yerleşim değişir
  const geo = { cx: o.cx ?? 195, cy: o.cy ?? 312, R: o.R ?? 140, ps, simdi: NOWx, sira: o.sira, spin: o.spin, haric: o.haric || AK.haric, R0: o.R0 };
  const G = (o.kol ?? kolHarita()) ? kurKol(AK, { ...geo, ajanSahibi: ajanSahipleri(F.steps) }) : olcekliKur(AK, { ...geo, tau: o.tau ?? TAU });
  const RENK = uyeRenkleri(G, M.sahip, ajanSahipleri(F.steps), o.renkler || {});
  const BEN = o.ben ?? M.sahip;
  const UYE_RENK = (u) => RENK[u.ad] || TAKIM_RENGI;
  const byNo = byNoOf(F), P = {}; for (const no in G.gezegen) P[no] = [G.gezegen[no].x, G.gezegen[no].y];
  const stOf = (no) => (o.states && o.states[no]) || (o.allLit ? (byNo[no].durum === 'atlandi' ? 'ghost' : 'lit') : G.durumAn(+no, X)) || 'dark';
  const OK = o.ok ?? 1, YK = o.yk ?? 1;
  const radOf = (no) => { const r = (o.rad && o.rad[no] ? o.rad[no] * ps : G.gezegen[no].r) * (o.rk ?? 1); return o.rf ? o.rf(r) : r * OK; };
  const dim = (ad) => (o.focus && o.focus !== ad) ? (o.sis ? .3 : .16) : 1;
  const tEnd = Math.max(G.hedef, G.tSon);
  let s = '';
  if (kucuk) {
    const n = F.steps.length || 1, lit = F.steps.filter((x) => BIT(x.durum)).length / n;
    s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(G.R * 1.3)}" fill="url(#${lit > .5 ? 'bloom' : 'glowLilac'})" opacity="${f(.25 + lit * .7)}"/>`;
    for (const u of G.uyeler) {
      const col = UYE_RENK(u), tum = u.yol.map((p) => [p.x, p.y]);
      s += `<path d="${yolD(tum)}" fill="none" stroke="${u.hayalet ? '#6B5FB0' : '#B9A6F2'}" stroke-width=".8" opacity="${u.hayalet ? .35 : .55}" stroke-linecap="round"/>`;
      const gec = G.kesit(u.ad, u.t0, F.kapandi ? tEnd : NOWx);
      if (!u.hayalet && gec.length > 1) s += `<path d="${yolD(gec)}" fill="none" stroke="${F.kapandi ? '#FFD9B8' : col}" stroke-width="${f(Math.max(1, G.R * .03))}" stroke-linecap="round"/>`;
    }
    if (G.kuyruk) s += `<path d="${yolD(G.kuyruk.pts.map((p) => [p.x, p.y]))}" fill="none" stroke="#FFD27A" stroke-width=".8" stroke-dasharray="1 2" opacity=".7"/>`;
    s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(Math.max(1.4, G.R * .05))}" fill="#FFF1DC"/>`;
    const pr = (o.pr || Math.max(1.6, G.R * .05)) * .62;
    for (const no in G.gezegen) {
      const g = G.gezegen[no], k = stOf(no), r = Math.max(pr * .8, Math.min(pr * 1.8, pr * g.r / (8 * ps)));
      // W7: renksiz ışık; kırmızı yalnız engel
      const c = `cx="${f(g.x)}" cy="${f(g.y)}"`;
      if (k === 'lit' || k === 'tahmin') s += `<circle ${c} r="${f(r * 2.6)}" fill="url(#glowBeyaz)" opacity=".75"/><circle ${c} r="${f(r)}" fill="url(#pKrem)"/>`;
      else if (k === 'run') s += `<circle ${c} r="${f(r)}" fill="url(#pDark)"/><path d="M${f(g.x)},${f(g.y - r)} A${f(r)},${f(r)} 0 0 1 ${f(g.x)},${f(g.y + r)}Z" fill="#FFF6E0"/>`;
      else if (k === 'ghost') s += `<circle ${c} r="${f(pr * .6)}" fill="none" stroke="#9AA3B5" stroke-width=".7" stroke-dasharray="1.5 1.5"/>`;
      else if (k === 'ertele') s += `<circle ${c} r="${f(r * .7)}" fill="#3B4258" stroke="#9AA3B5" stroke-width=".6"/>`;
      else if (k === 'wait') s += `<circle ${c} r="${f(r + 2)}" fill="none" stroke="#FFF6E0" stroke-width=".9"/><circle ${c} r="${f(r)}" fill="url(#pDark)"/><circle ${c} r="${f(r * .42)}" fill="#FFF6E0"/>`;
      else if (k === 'block') s += `<circle ${c} r="${f(r * 3)}" fill="url(#glowAlarm)"/><circle ${c} r="${f(r * 1.1)}" fill="url(#pDark)" stroke="#FF5A5A" stroke-width="${f(Math.max(.8, r * .3))}"/>`;
      else s += `<circle ${c} r="${f(r)}" fill="url(#pDark)" stroke="#8E80D6" stroke-width=".6"/>`;
    }
    if (G.kule && o.kule !== false) s += `<circle cx="${f(G.kule.x)}" cy="${f(G.kule.y)}" r="${f(Math.max(1.6, pr * .8))}" fill="${F.kapandi ? '#FFE29A' : '#FFD27A'}" stroke="#2A1D4F" stroke-width=".5"/>`;
    return { svg: s, G, P, radOf, stOf, RENK };
  }

  // ---------- ayrıntılı ----------
  s += `<ellipse cx="${f(G.cx)}" cy="${f(G.cy)}" rx="${f(G.R * 1.4)}" ry="${f(G.R * 1.35)}" fill="url(#glowLilac)" opacity=".32"/>`;
  s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(G.R * .22)}" fill="url(#bloom)" opacity=".9"/>`;
  if (G.kol && o.halkalar !== false) s += kolHalkalari(G, NOWx, Math.min(ps, 1.3), o.yk ?? 1, !!F.kapandi);
  const L = {}; for (const u of G.uyeler) L[u.ad] = '';
  const tSolid = F.kapandi ? tEnd : Math.min(X, NOWx);
  const m13 = Math.min(ps, 1.3);
  for (const u of G.uyeler) {
    // B21 (W7): yol merkezden değil, kişinin ilk işinin başladığı yerden başlar (başlangıç simgesi); merkez–r₀ arası çizilmez
    const col = o.sis && o.focus !== u.ad ? '#9C8BE0' : UYE_RENK(u), tum = u.yol.filter((p) => p.t >= u.t0).map((p) => [p.x, p.y]);
    let t = '';
    if (u.hayalet) { t += `<path d="${yolD(tum)}" fill="none" stroke="#A99BDB" stroke-width="1" stroke-dasharray="1.5 4" opacity=".6"/>`; L[u.ad] += t; continue; }
    t += `<path d="${yolD(tum)}" fill="none" stroke="#9C8BE0" stroke-width="${f(G.R * .07)}" opacity=".08" stroke-linecap="round" filter="url(#blur6)"/>`;
    t += `<path d="${yolD(tum)}" fill="none" stroke="${col}" stroke-width="${f(.9 * m13)}" stroke-dasharray="3 4" opacity="${o.allLit ? 0 : .7}"/>`;
    // hafta çentikleri (3.E): bugünden uzaklaştıkça sıklaşır; sıkışan zaman kalınlıkla değil yoğunlukla okunur
    if (!o.allLit && o.cetik !== false) for (let tw = NOWx + 7 * GUN * Math.ceil((u.t0 - NOWx) / (7 * GUN)); tw < u.tSon; tw += 7 * GUN) {
      const q = G.konumAn(u.ad, tw); if (!q || q.demir) continue;
      const nx = -Math.sin(q.yon) * 3 * m13, ny = Math.cos(q.yon) * 3 * m13;
      t += `<path d="M${f(q.x - nx)},${f(q.y - ny)} L${f(q.x + nx)},${f(q.y + ny)}" stroke="${col}" stroke-width=".8" opacity=".55"/>`;
    }
    const gec = G.kesit(u.ad, u.t0, tSolid);
    // W7: agent yolu kesik; geçmiş yol beyaz parlar (gecikme kırmızısı aşağıda, G.gec)
    const kesik = u.tip === 'agent' ? ` stroke-dasharray="${f(5 * m13)} ${f(4 * m13)}"` : '';
    if (gec.length > 1) {
      t += `<path d="${yolD(gec)}" fill="none" stroke="#FFF6E0" stroke-width="${f(5 * m13)}" opacity=".22" filter="url(#blur6)" stroke-linecap="round"/>`;
      t += `<path d="${yolD(gec)}" fill="none" stroke="${o.allLit ? '#FFD9B8' : col}" stroke-width="${f(1.8 * m13)}" stroke-linecap="round"${kesik}/>`;
    }
    if (X > NOWx && !F.kapandi) {
      const th = G.kesit(u.ad, NOWx, X);
      if (th.length > 1) t += `<path d="${yolD(th)}" fill="none" stroke="${col}" stroke-width="${f(1.4 * m13)}" stroke-dasharray="6 4" stroke-linecap="round" opacity=".95"/>`;
    }
    // başlangıç simgesi: koyu daire içinde kişinin renginde ok (agent'ta kesik daire); bitiş: yola dik çizgi ve küçük kare
    if (!o.allLit && tum.length > 1 && o.baslangic !== false) {
      const [x0, y0] = tum[0], [x1, y1] = tum[Math.min(3, tum.length - 1)], a = Math.atan2(y1 - y0, x1 - x0), k = m13, kes = u.tip === 'agent' ? ' stroke-dasharray="2 2"' : '';
      t += `<g transform="translate(${f(x0)},${f(y0)}) rotate(${f(a * 180 / Math.PI)}) scale(${f(k)})"><circle r="5.6" fill="#061A24" stroke="${col}" stroke-width="1.5"${kes}/><path d="M-2,-2.7 L3,0 L-2,2.7Z" fill="${col}"/></g>`;
      const [xn, yn] = tum[tum.length - 1], [xp, yp] = tum[Math.max(0, tum.length - 4)], b = Math.atan2(yn - yp, xn - xp), nx = -Math.sin(b) * 5 * k, ny = Math.cos(b) * 5 * k;
      if (u.tSon < tEnd || u.tip === 'agent') t += `<path d="M${f(xn - nx)},${f(yn - ny)} L${f(xn + nx)},${f(yn + ny)}" stroke="${col}" stroke-width="${f(2 * k)}" stroke-linecap="round"/><rect x="${f(xn + nx - 1.8 * k)}" y="${f(yn + ny - 1.8 * k)}" width="${f(3.6 * k)}" height="${f(3.6 * k)}" fill="${col}"/>`;
    }
    L[u.ad] += t;
  }
  // devir ipi (plan 27 Eki, 3.11): görevin sahibinin renginden devralanın rengine geçen ince ok
  if (o.ip !== false) G.ipler.forEach((ip, i) => {
    const p = G.konumAn(ip.uye, ip.t), g = G.gezegen[ip.no]; if (!p || !g) return;
    const L0 = Math.hypot(p.x - g.x, p.y - g.y); if (L0 < 6) return;
    // ok kısa kalır (en çok 34 px): devralanın yönünü gösterir, haritayı boydan boya kesmez
    const ux = (p.x - g.x) / L0, uy = (p.y - g.y) / L0, r0 = radOf(ip.no) + 2, ok = 4.5 * m13, Lok = Math.min(L0 - 3, r0 + 34 * m13);
    if (Lok <= r0 + 4) return;
    const ax = g.x + ux * r0, ay = g.y + uy * r0, bx = g.x + ux * Lok, by = g.y + uy * Lok, id = `ip-${F.kod}-${i}`;
    const c0 = UYE_RENK(G.uyeOf[byNo[ip.no]?.sahip] || { ad: byNo[ip.no]?.sahip }), c1 = UYE_RENK(G.uyeOf[ip.uye]);
    L[ip.uye] += `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(ax)}" y1="${f(ay)}" x2="${f(bx)}" y2="${f(by)}"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient></defs>`
      + `<path d="M${f(ax)},${f(ay)} L${f(bx)},${f(by)}" stroke="url(#${id})" stroke-width="1.1" opacity=".9"/>`
      + `<path d="M${f(bx)},${f(by)} L${f(bx - ux * ok - uy * ok * .6)},${f(by - uy * ok + ux * ok * .6)} L${f(bx - ux * ok + uy * ok * .6)},${f(by - uy * ok - ux * ok * .6)}Z" fill="${c1}"/>`;
  });
  // merkez = başlangıç yıldızı (plan 27 Eki, 3.G)
  let ust = yildiz(G.cx, G.cy, .8 * m13);
  // Z3 (3.D): merkezin altında başlangıç tarihi
  if (o.merkezTarih) ust += pill(G.cx, G.cy + 16 * m13, gunAy(G.T0), { fs: 10 * m13 * YK, fw: 650, col: C.ink2, bgo: .75 });
  if (G.kuyruk && !F.kapandi) {
    const kp = G.kuyruk.pts.map((p) => [p.x, p.y]);
    ust += `<path d="${yolD(kp)}" fill="none" stroke="#FFD27A" stroke-width="${f(1.1 * m13)}" stroke-dasharray="2 5" opacity=".8"/>`;
    // R17: kuyruk kesilmez (zaman ölçeği uzağı sıkıştırır); pay yazıyla. Sayı tek kaynaktan (sunucunun karar özeti):
    // o.payEtiket ör. "24 gün pay"; verilmezse yazı yok
    let kpL = 0; for (let i = 1; i < kp.length; i++) kpL += Math.hypot(kp[i][0] - kp[i - 1][0], kp[i][1] - kp[i - 1][1]);
    if (o.payEtiket && kpL > 70 * m13) { const m = kp[Math.floor(kp.length * .45)]; ust += pill(m[0], m[1] - 10 * m13, esc(o.payEtiket), { fs: 9.5 * m13 * YK, fw: 650, col: '#FFD27A', bgo: .75 }); }
    if (G.kuyruk.kirik && kp.length > 2) {
      const i0 = Math.floor(kp.length * .55), m = kp[i0], n2 = kp[i0 + 1] || m, a = Math.atan2(n2[1] - m[1], n2[0] - m[0]) + Math.PI / 2, q = 6 * m13;
      for (const d of [-3, 3]) { const cx_ = m[0] + Math.cos(a - Math.PI / 2) * d, cy_ = m[1] + Math.sin(a - Math.PI / 2) * d; ust += `<path d="M${f(cx_ - Math.cos(a - .5) * q)},${f(cy_ - Math.sin(a - .5) * q)} L${f(cx_ + Math.cos(a - .5) * q)},${f(cy_ + Math.sin(a - .5) * q)}" stroke="#FFD27A" stroke-width="1.6" stroke-linecap="round"/>`; }
    }
  }
  if (G.gec) {
    const kp = G.kesit(G.kuleUye, G.hedef, G.tSon);
    ust += `<path d="${yolD(kp)}" fill="none" stroke="#FF8A78" stroke-width="10" opacity=".3" filter="url(#blur6)"/><path d="${yolD(kp)}" fill="none" stroke="#FF8A78" stroke-width="2.4" stroke-dasharray="5 3"/>`;
  }
  // fenerler kalktı (3.G): kritik yol gezegendeki altın elmasla ve seçimde zincirle görünür; o.fener: true eskisini çizer
  if (o.fener === true && !F.kapandi) {
    const ch = (AK.kritik_yol || []).filter((no) => G.gezegen[no]).sort((a, b) => G.gezegen[a].t - G.gezegen[b].t);
    for (let i = 1; i < ch.length; i++) {
      const a = G.gezegen[ch[i - 1]], b = G.gezegen[ch[i]], ad = byNo[ch[i]].sahip, t0 = Math.max(a.t, X);
      if (b.t <= t0) continue;
      ust += fenerDizisi(G.kesit(ad, t0, b.t), m13);
    }
  }
  const vis = Object.keys(G.gezegen).map(Number);
  const cl = G.kumeler(o.kumeRad || ((no) => radOf(no)), vis), inCl = new Set(cl.flat());
  // ikonAyri (yakınlaşınca): bulut ve bayrak gezegenden ayrılır, kendi dokunma alanları olur
  // W7: halka kişinin rengi (ortak görevde paylara bölünür); bitende sonuç rozeti: karar terazi, çıktı belge, yoksa tik
  const ex = (no) => {
    const g = G.gezegen[no], ortak = g.ortak && !o.sis && g.uyeler.length > 1;
    return { halka: ortak ? g.uyeler.map((ad) => UYE_RENK(G.uyeOf[ad] || { ad })) : UYE_RENK(G.uyeOf[byNo[no].sahip] || { ad: byNo[no].sahip }), sonuc: byNo[no].karar ? 'terazi' : byNo[no].cikti ? 'belge' : 'tik', life: radOf(no) > 10, kenar: !!o.minR };
  };
  // hamle damlası: işin düştüğü kişinin renginde; bakan kişininki büyük ve zıplar
  const hamleAdim = (no) => { const a = byNo[no]; return hamleOf({ durum: a.durum, sahip: a.sahip, sahip_tip: a.tip, agent_sahibi: a.agentSahibi, oto: !!a.oto, oto_durum: a.oto, karar_adimi: a.karar }, { renkler: Object.fromEntries(G.uyeler.map((u) => [u.ad, UYE_RENK(u)])) }); };
  // darboğaz: açık işi bekleyen açık iş sayısı (yakında yazılır)
  const bekleyen = (no) => F.steps.filter((x) => (x.dep || []).includes(+no) && !BIT(x.durum)).length;
  const ikonlar = [], uyduYer = [];
  const pl = (no) => {
    const g = G.gezegen[no], k = stOf(no), r = k === 'dark' && o.minR ? Math.max(radOf(no), o.minR * ps) : radOf(no);
    let t = '';
    if (k === 'tahmin') t += `<g opacity=".55">${planet(g.x, g.y, r, 'lit', { life: false })}</g><circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r + 4)}" fill="none" stroke="#FFD27A" stroke-width="1.2" stroke-dasharray="2 3"/>`;
    else t += planet(g.x, g.y, r, k, ex(no));
    // darboğaz (orta yakınlıktan): altında onu bekleyen iş sayısı
    const bek = !SONUK.includes(k) && F.darbogaz === +no ? bekleyen(no) : 0;
    if (bek && !o.uzak) { const yz = `${bek}${o.ikonAyri ? ' bekliyor' : ''}`, w = o.ikonAyri ? 50 : 14; t += `<g transform="translate(${f(g.x)},${f(g.y + r + 11 * m13)}) scale(${f(m13)})"><rect x="${-w / 2}" y="-6.5" width="${w}" height="13" rx="6.5" fill="#08222E" stroke="#FFF6E0" stroke-width="1"/><text y="3.4" text-anchor="middle" font-family="Bricolage" font-size="8.5" font-weight="800" fill="#FFF6E0">${yz}</text></g>`; }
    // hamle damlası (gezegenin tam üstünde)
    const h = hamleAdim(no);
    if (h) {
      const ben = h.kim === BEN, sc = (ben ? 1.1 : .82) * Math.min(1.4, Math.max(.8, r / 9)), dy = r + (ben ? 16 : 13) * sc;
      t += ben ? `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r + 6.5)}" fill="none" stroke="${h.renk}" stroke-width="1" opacity=".55" class="dongu-nabiz"/>` : '';
      t += `<g${ben ? ' class="dongu-zipla"' : ''}>${damla(h, f(g.x), f(g.y - dy), f(sc))}</g>`;
      if (o.ikonAyri) ikonlar.push({ tur: 'damla', no: +no, x: g.x, y: g.y - dy, etiket: h.etiket });
    }
    // lejant satırından vurgu (3.G): kısa süre yanıp söner
    if (o.parla && o.parla.has(+no)) t += `<circle class="dongu-parla" cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r + 9)}" fill="none" stroke="#FFF3E8" stroke-width="2.2"/>`;
    // uydu sistemi v2 (3.B): uzakta Satürn halkası, Z2'den itibaren mini sarmal, Z3'te adlar (etkin aşama kuralı kalktı, 3.23a)
    if (o.sats && o.sats[no]) t += uyduSistemi(g.x, g.y, r, o.sats[no], ps, { yakin: !!o.satYakin, adlar: !!o.satAdlar && o.sats[no].length <= 6, ini: o.sats[no].length <= 8, yerler: uyduYer, ust: +no, hedef: !!o.satHedef });
    return t;
  };
  const sahipGrubu = (no) => o.focus && G.gezegen[no].uyeler.includes(o.focus) ? o.focus : byNo[no].sahip;
  // durum odağı (plan 27 Eki, 2.C): uymayan gezegen söner
  const durumda = (no) => !o.durumOdak || o.durumOdak(+no);
  for (const no of vis) if (!inCl.has(no)) L[sahipGrubu(no)] += durumda(no) ? pl(no) : `<g opacity=".16">${pl(no)}</g>`;
  for (const c of cl) { const g = G.gezegen[c[0]]; L[o.focus && c.some((n) => G.gezegen[n].uyeler.includes(o.focus)) ? o.focus : byNo[c[0]].sahip] += clusterBadge(g.x, g.y, c, radOf, (n) => [stOf(n) === 'tahmin' ? 'lit' : stOf(n), ex(n)], ps * .9); }
  const gemiler = [], GEMI = {};
  // W2 (4 Kas, K1): agent kişinin desteğidir; sahibinin gemisi haritadaysa robot ona kısa bir kolla yapışık çizilir
  const destek = ajanSahipleri(F.steps), gorunen = {};
  if (o.ships !== false && !F.kapandi) for (const u of G.uyeler) {
    if (u.hayalet || (o.sis && o.focus !== u.ad)) continue;
    const acik = u.ziyaret.some((no) => !BIT(byNo[no].durum)) || X < u.tSon;
    const p0 = G.konumAn(u.ad, X); if (!p0 || !acik) continue;
    // B22, C33 (W7): yön yolun kısa bir aralığından (±8 saat) okunur; ara noktalarda gemi titremez
    const pa = G.konumAn(u.ad, X - 8 * 36e5) || p0, pb = G.konumAn(u.ad, X + 8 * 36e5) || p0;
    const p = { ...p0, yon: Math.hypot(pb.x - pa.x, pb.y - pa.y) > .5 ? Math.atan2(pb.y - pa.y, pb.x - pa.x) : p0.yon };
    if (p.demir && X >= u.tSon && !u.kendi.some((no) => !BIT(byNo[no].durum))) continue;
    gorunen[u.ad] = { u, p };
  }
  // B22 (W5, 4 Kas): gemi gezegenlerden ve simgelerden en az bir dokunma hedefi (44 px) uzakta durur. Yolun üstünde, gezegene
  // varmışken bile gezegenin dışına, ondan uzağa itilir; birkaç turda en yakın çakışan çözülür (çizim ve dokunma hedefi aynı yerde)
  const engeller = vis.filter((no) => !inCl.has(no)).map((no) => ({ x: G.gezegen[no].x, y: G.gezegen[no].y, d: Math.max(22, radOf(no)) + 22 }))
    .concat(cl.map((c) => ({ x: G.gezegen[c[0]].x, y: G.gezegen[c[0]].y, d: Math.max(22, radOf(c[0]) + 12) + 22 })), ikonlar.map((k) => ({ x: k.x, y: k.y, d: 44 })));
  // B22 (W7): itme sürekli: her engel yalnız içine girildiği kadar iter (yumuşak), en yakını değiştiğinde gemi zıplamaz
  const uzaklas = (p) => {
    let x = p.x, y = p.y;
    for (let tur = 0; tur < 8; tur++) {
      let dx = 0, dy = 0;
      for (const e of engeller) {
        let ex = x - e.x, ey = y - e.y, n = Math.hypot(ex, ey);
        const a = e.d - n; if (a <= 0) continue;
        if (n < 1e-3) { ex = -Math.sin(p.yon || 0); ey = Math.cos(p.yon || 0); n = 1; }
        dx += ex / n * a * .5; dy += ey / n * a * .5;
      }
      if (Math.hypot(dx, dy) < .05) break;
      x += dx; y += dy;
    }
    return x === p.x && y === p.y ? p : { ...p, x, y };
  };
  if (o.gemiAyrik !== false) for (const ad of Object.keys(gorunen)) gorunen[ad].p = uzaklas(gorunen[ad].p);
  for (const ad of Object.keys(gorunen)) {
    const { u, p } = gorunen[ad];
    const kind = u.tip === 'agent' ? 'agent' : u.tip === 'dis' ? 'dis' : 'insan';
    const sc = (o.shipSc ?? .78) * Math.min(ps, 1.4) * OK;
    const ev = kind === 'agent' && destek[u.ad] && destek[u.ad] !== u.ad ? gorunen[destek[u.ad]] : null;
    if (ev && ev.u.tip !== 'agent') continue; // sahibinin gemisiyle birlikte çizilir
    const yapisik = G.uyeler.filter((a) => a.tip === 'agent' && destek[a.ad] === u.ad && gorunen[a.ad]);
    const renk = o.sis && o.focus !== u.ad ? '#9C8BE0' : UYE_RENK(u);
    gemiler.push({ ad: u.ad, tip: kind, x: p.x, y: p.y - (kind === 'dis' ? 6 * sc : 0), sc });
    let g = ship(p.x, p.y - (kind === 'dis' ? 6 * sc : 0), kind === 'dis' ? 0 : p.yon * 180 / Math.PI, kind, kind === 'dis' ? '' : kisaAd(u.ad)[0], renk, sc, { flame: kind !== 'dis' && X <= NOWx });
    yapisik.forEach((a, i) => {
      // 5 Kas (Berkin): agent kendi sarmalındaki yerinde gider; sahibinin gemisine iple bağlıdır. İp, ikisinin yerine göre
      // uzar, kısalır ve yön değiştirir. İkisi üst üste gelirse robot kuyruğun üst yanına (eski yapışık yer) kadar açılır.
      const k = sc / .78, q = gorunen[a.ad].p, yx = Math.cos(p.yon || 0), yy = Math.sin(p.yon || 0);
      let dx = q.x - p.x, dy = q.y - p.y;
      const enAz = 20 * k, d = Math.hypot(dx, dy);
      if (d < enAz) {
        if (d > 1e-3) { dx = dx / d * enAz; dy = dy / d * enAz; }
        else { const ger = -17 - i * 15, yan = -15; dx = (ger * yx - yan * yy) * k; dy = (ger * yy + yan * yx) * k; }
      }
      gemiler.push({ ad: a.ad, tip: 'agent', x: p.x + dx, y: p.y + dy, sc: sc * .72, destek: u.ad });
      g = destekGemisi(p.x, p.y, dx, dy, o.sis && o.focus !== a.ad ? '#9C8BE0' : UYE_RENK(a), sc, { ip: true, yon: q.yon, alev: X <= NOWx }) + g;
    });
    GEMI[u.ad] = (GEMI[u.ad] || '') + `<g opacity="${X > NOWx ? .75 : 1}">` + g + '</g>';
  }
  // W7: kritik yol beyaz noktalı zincir (açık gezegenler zaman sırasıyla); uzakta çizilmez
  if (!o.uzak && !F.kapandi && o.kritikZincir !== false) {
    const ch = (AK.kritik_yol || []).filter((no) => G.gezegen[no] && !SONUK.includes(stOf(no))).sort((a, b) => G.gezegen[a].t - G.gezegen[b].t).map((no) => [G.gezegen[no].x, G.gezegen[no].y]);
    if (ch.length > 1) s += `<path d="${yolD(ch)}" fill="none" stroke="#FFF6E0" stroke-width="${f(1.3 * m13)}" stroke-dasharray="1 ${f(4 * m13)}" stroke-linecap="round" opacity=".55"/>`;
  }
  for (const u of G.uyeler) { const d = dim(u.ad); if (d) s += `<g opacity="${o.sel ? Math.min(d, .55) : d}" ${o.sis && o.focus !== u.ad ? 'filter="url(#blur2)"' : ''}>${L[u.ad]}</g>`; }
  // katman (B22): gemi > gezegen > spiral; gemiler bütün gezegenlerin üstünde
  for (const u of G.uyeler) { const d = dim(u.ad); if (d && GEMI[u.ad]) s += `<g opacity="${o.sel ? Math.min(d, .55) : d}">${GEMI[u.ad]}</g>`; }
  s += ust;
  if (G.kule && o.kule !== false) {
    const lit = !!F.kapandi;
    s += `<circle cx="${f(G.kule.x)}" cy="${f(G.kule.y)}" r="${f(4 * m13)}" fill="#FFD27A"/>` + kapi(G.kule.x, G.kule.y - 3, (o.tw ?? .24) * 1.9 * Math.min(ps, 1.5), lit);
    if (o.kuleEtiket !== false) s += pill(G.kule.x + (o.kuleDx ?? 0), G.kule.y + 16 * m13, o.kuleEtiket || gunAy(G.hedef - 12 * 36e5), { fs: 11 * Math.min(ps, 1.2) * YK, fw: 650, col: C.ink });
  }
  let secim = '';
  if (o.sel && G.gezegen[o.sel]) {
    const S = byNo[o.sel], g = G.gezegen[o.sel];
    const bek = (S.dep || []).filter((d) => G.gezegen[d] && byNo[d] && byNo[d].durum !== 'atlandi');
    const tut = F.steps.filter((x) => (x.dep || []).includes(+o.sel) && G.gezegen[x.no] && x.durum !== 'atlandi').map((x) => x.no);
    const parca = (ad, ta, tb) => { const k = G.kesit(ad, ta, tb); return k.length > 1 ? k : null; };
    for (const d of bek) {
      const k = parca(S.sahip, G.gezegen[d].t, g.t) || [[G.gezegen[d].x, G.gezegen[d].y], [g.x, g.y]];
      secim += `<path d="${yolD(k)}" fill="none" stroke="#FFD9B8" stroke-width="7" opacity=".22" filter="url(#blur2)"/><path d="${yolD(k)}" fill="none" stroke="#FFD9B8" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    for (const h of tut) {
      const k = parca(byNo[h].sahip, g.t, G.gezegen[h].t) || [[g.x, g.y], [G.gezegen[h].x, G.gezegen[h].y]];
      secim += `<path d="${yolD(k)}" fill="none" stroke="#FF8A78" stroke-width="7" opacity=".22" filter="url(#blur2)"/><path d="${yolD(k)}" fill="none" stroke="#FF9F8F" stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round"/>`;
    }
    for (const no of [...bek, ...tut]) { const q = G.gezegen[no]; secim += planet(q.x, q.y, radOf(no), stOf(no) === 'tahmin' ? 'lit' : stOf(no), ex(no)) + `<circle cx="${f(q.x)}" cy="${f(q.y)}" r="${f(radOf(no) + 6)}" fill="none" stroke="${tut.includes(no) ? '#FF9F8F' : '#FFD9B8'}" stroke-width="1.4" ${tut.includes(no) ? 'stroke-dasharray="3 3"' : ''}/>`; }
    // seçimde kritik zincir (3.G, 3.H): kritik yoldaki açık gezegenler zaman sırasıyla ince altın çizgiyle birleşir
    if (G.gezegen[o.sel].kritik) {
      const ch = (AK.kritik_yol || []).filter((no) => G.gezegen[no]).sort((a, b) => G.gezegen[a].t - G.gezegen[b].t).map((no) => [G.gezegen[no].x, G.gezegen[no].y]);
      if (ch.length > 1) secim = `<path d="${yolD(ch)}" fill="none" stroke="#FFF6E0" stroke-width="1.4" stroke-dasharray="1 3" stroke-linecap="round" opacity=".95"/>` + secim;
    }
    secim += `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(radOf(o.sel) + 15)}" fill="none" stroke="#FFF3E8" stroke-width="1.6" opacity=".55"/>` + planet(g.x, g.y, radOf(o.sel), stOf(o.sel), ex(o.sel));
    if (!o.selTop) s += secim;
  }
  if (o.labels) for (const [no, text, dx, dy, col, st] of o.labels) { const g = G.gezegen[no]; if (g) s += pill(g.x + dx * ps * YK, g.y + dy * ps * YK, esc(text), { fs: 11 * m13 * YK, fw: 650, col: col || C.ink, stroke: st }); }
  return { svg: s, G, P, radOf, stOf, clusters: cl, secim, RENK, gemiler, ikonlar, uydular: uyduYer };
}

/**
 * Zaman sürgüsü: oynat/durdur (44 px), sürüklenen baş (tarih hapı), bugün çentiği, kule (hedef).
 */
export function zamanCubugu(x, y, w, G, X, o = {}) {
  const NOWx = o.now, ps = o.ps ?? 1;
  const t0 = G.T0, t1 = G.kapandi ? G.kapandi : Math.max(G.hedef, G.tSon) + (G.gec ? GUN : 0), kisa = (t1 - t0) < 2 * GUN;
  const x0 = x + 56 * ps, x1 = x + w - 12 * ps, xOf = (t) => x0 + (x1 - x0) * (t - t0) / (t1 - t0);
  const tOf = (px) => t0 + (t1 - t0) * (px - x0) / (x1 - x0);
  let s = '';
  s += `<g transform="translate(${x + 22 * ps},${y})"><circle r="${22 * ps}" fill="#0A2838" stroke="#FFD27A" stroke-opacity=".7"/>`;
  s += o.oynuyor ? `<rect x="${-6 * ps}" y="${-8 * ps}" width="${4.2 * ps}" height="${16 * ps}" rx="1.5" fill="#FFD27A"/><rect x="${1.8 * ps}" y="${-8 * ps}" width="${4.2 * ps}" height="${16 * ps}" rx="1.5" fill="#FFD27A"/>` : `<path d="M${-5 * ps},${-8.5 * ps} L${9 * ps},0 L${-5 * ps},${8.5 * ps}Z" fill="#FFD27A"/>`;
  s += `</g>`;
  s += `<rect x="${x0}" y="${y - 4 * ps}" width="${x1 - x0}" height="${8 * ps}" rx="${4 * ps}" fill="#061A24" stroke="#8E80D6" stroke-opacity=".45"/>`;
  s += `<rect x="${x0}" y="${y - 4 * ps}" width="${f(Math.max(0, xOf(Math.min(G.kapandi ? t1 : NOWx, t1)) - x0))}" height="${8 * ps}" rx="${4 * ps}" fill="url(#brass)"/>`;
  if (X > NOWx) s += `<rect x="${f(xOf(NOWx))}" y="${y - 2.5 * ps}" width="${f(xOf(X) - xOf(NOWx))}" height="${5 * ps}" rx="${2.5 * ps}" fill="none" stroke="#FFD27A" stroke-width="1.3" stroke-dasharray="4 3"/>`;
  const d0 = Math.ceil((t0 + 3 * 36e5) / GUN) * GUN - 3 * 36e5, gun = (t1 - t0) / GUN, adim = Math.max(1, Math.ceil(gun / 7 / 5));
  let wk = 0;
  if (kisa) { const h0 = Math.ceil(t0 / 36e5) * 36e5; for (let t = h0; t <= t1; t += 36e5 / 4) { const xx = xOf(t), tam = t % 36e5 === 0; s += `<line x1="${f(xx)}" y1="${y + 7 * ps}" x2="${f(xx)}" y2="${y + (tam ? 13 : 10) * ps}" stroke="#B9A6F2" stroke-width="${tam ? 1.2 : .6}" opacity="${tam ? .9 : .5}"/>`; if (tam && xx > x0 + 14 && xx < x1 - 26) s += sans(f(xx), y + 25 * ps, saat(t), { fs: 10 * ps, fw: 600, col: C.ink3, anchor: 'middle' }); } }
  else for (let t = d0; t <= t1; t += GUN) {
    const xx = xOf(t), pzt = tl(t).getUTCDay() === 1;
    s += `<line x1="${f(xx)}" y1="${y + 7 * ps}" x2="${f(xx)}" y2="${y + (pzt ? 13 : 10) * ps}" stroke="#B9A6F2" stroke-width="${pzt ? 1.2 : .6}" opacity="${pzt ? .9 : .5}"/>`;
    if (pzt) { if (wk % adim === 0 && xx > x0 + 14 && xx < x1 - 26) s += sans(f(xx), y + 25 * ps, gunAy(t), { fs: 10 * ps, fw: 600, col: C.ink3, anchor: 'middle' }); wk++; }
  }
  const xn = xOf(NOWx);
  if (!G.kapandi) s += `<line x1="${f(xn)}" y1="${y - 10 * ps}" x2="${f(xn)}" y2="${y + 10 * ps}" stroke="#FFC9A3" stroke-width="2"/>`;
  const xk = xOf(G.kapandi ? t1 : G.hedef);
  s += kapi(xk, y - 4 * ps, .22 * ps, !!G.kapandi);
  if (G.gec) s += `<rect x="${f(xk)}" y="${y - 4 * ps}" width="${f(xOf(G.tSon) - xk)}" height="${8 * ps}" rx="${4 * ps}" fill="#FF8A78" opacity=".85"/>`;
  const xh = xOf(X);
  s += `<circle cx="${f(xh)}" cy="${y}" r="${14 * ps}" fill="url(#glowGold)"/><circle cx="${f(xh)}" cy="${y}" r="${9 * ps}" fill="#FFF1DC" stroke="#2A1D4F" stroke-width="1.5"/><circle cx="${f(xh)}" cy="${y}" r="${3.2 * ps}" fill="#2A1D4F"/>`;
  const et = o.etiket || (Math.abs(X - NOWx) < 36e5 ? 'Bugün · ' + gunAy(X) : gunAyHafta(X) + (X > NOWx ? ' · tahmin' : ''));
  const pw = Math.round(et.length * 11 * .56 + 16) * ps, px = Math.min(Math.max(xh, x0 + pw / 2 - 20), x1 - pw / 2 + 6);
  s += pill(px, y - 22 * ps, esc(et), { fs: 11 * ps, fw: 750, bg: X > NOWx ? '#0A2736' : '#FFD27A', bgo: 1, col: X > NOWx ? '#FFE6B0' : '#2A1D4F', stroke: X > NOWx ? '#FFD27A' : 'none' });
  return { svg: s, xOf, tOf, x0, x1, t0, t1 };
}
