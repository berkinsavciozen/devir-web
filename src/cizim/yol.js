// Tasarım kaynağından (d3-son/kaynak/yol-ciz.js, galaksi-v3.js clusterBadge, son-ortak.js uydular) taşındı.
// Geometrinin tamamı src/geometri/galaksi-geometri.ts (kur) modülünden gelir; bu dosya yalnız çizer.
// Fark: girdi API detayından kurulur (akisModeli); üye renkleri ada göre değil role göre seçilir.
import { apidenAkis } from '../geometri/galaksi-geometri';
import { olcekliKur, TAU } from '../geometri/zaman-olcegi';
import { C, f, pill, planet, ship, kapi, yildiz } from './ortak.js';

export const GUN = 864e5;
const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
export const tl = (ms) => new Date(ms + 3 * 36e5);
export const gunAy = (ms) => { const d = tl(ms); return `${d.getUTCDate()} ${AY[d.getUTCMonth()]}`; };
export const gunAyHafta = (ms) => { const d = tl(ms); return `${d.getUTCDate()} ${AY[d.getUTCMonth()]} ${DOW[d.getUTCDay()]}`; };
export const saat = (ms) => { const d = tl(ms); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const sans = (x, y, t, o = {}) => `<text x="${x}" y="${y}" font-family="Inter" font-size="${o.fs || 12}" font-weight="${o.fw || 500}" fill="${o.col || C.ink2}" ${o.anchor ? `text-anchor="${o.anchor}"` : ''} ${o.ls ? `letter-spacing="${o.ls}"` : ''}>${esc(t)}</text>`;
export function kart(x, y, w, h, o = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx || 22}" fill="${o.fill || '#120B2C'}" fill-opacity="${o.op ?? .72}" stroke="${o.stroke || '#FFFFFF'}" stroke-opacity="${o.sop ?? .08}"/>`;
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
    steps: detay.adimlar.map((a) => ({ no: a.no, ad: a.ad, sahip: a.sahip, tip: a.sahip_tip, durum: a.durum, dep: a.bagimli || [], karar: !!a.karar_adimi, cikti: (a.cikti_sayisi || 0) > 0 })),
    // sunucunun darboğazı (R11): haritadaki taç en az ışıklı
    darbogaz: k.karar_ozeti?.darbogaz?.no ?? null,
  };
  const AK = apidenAkis(detay, { sahip: o.sahip });
  if (o.haric) AK.haric = o.haric;
  return { F, AK, sahip: o.sahip, detay };
}
const byNoOf = (F) => F.steps.reduce((m, s) => (m[s.no] = s, m), {});

/**
 * Üye rengi (plan 27 Eki, 3.C): yeşil artık yalnız "tamam" demek, kişilere verilmez.
 * Akış sahibi şeftali, Claude lila, dış katılımcı pembe; öteki herkes sırayla kendi rengini alır.
 * 6 kişiyi aşan akışta ötekiler tek takım rengine düşer, gemideki baş harf ayırır.
 */
export const UYE_PALET = ['#8EC5FF', '#FFE08A', '#D9B3FF', '#7FD6E8', '#F5B3A3', '#C7B8FF'];
export const TAKIM_RENGI = '#C9C2E8';
export function uyeRenkleri(G, sahip) {
  const r = {}, kalabalik = G.uyeler.length > 6;
  let i = 0;
  for (const u of G.uyeler) r[u.ad] = u.ad === sahip ? '#FFC9A3' : u.tip === 'agent' && /^Claude\b/i.test(u.ad) ? '#B9A6F2' : u.tip === 'dis' ? '#F2B8D8' : kalabalik ? TAKIM_RENGI : UYE_PALET[i++ % UYE_PALET.length];
  return r;
}
export const kisaAd = (ad) => ad.replace(/\s*\(.*\)$/, '').replace(/ agent’ı| agent'ı/, '').split(' ')[0];
export const yolD = (pts) => pts.length < 2 ? '' : pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ',' + f(p[1])).join('');
const PRI = { block: 0, wait: 1, run: 1, dark: 2, lit: 3, ertele: 4, ghost: 4, tahmin: 3 };
const SONUK = ['lit', 'ghost', 'ertele'];

/**
 * Küçük işaretler (plan 27 Eki, 3.A): altın elmas = kritik yol, belge = çıktı; bayrak (karar) planet() içinde.
 * Darboğaz tacı: 1 ışıklı, 2 nabız atan (dongu-tac); 0'da taç yok.
 */
export function tac(x, y, r, k) {
  if (!k) return '';
  return `<g transform="translate(${f(x)},${f(y)})"${k === 2 ? ' class="dongu-tac"' : ''}><circle r="${f(r * 2.6)}" fill="url(#glowCoral)" opacity="${k === 2 ? .8 : .45}"/>${k === 2 ? `<circle r="${f(r + 8)}" fill="none" stroke="#FF8A78" stroke-width="1" opacity=".55"/>` : ''}</g>`;
}
export const elmas = (x, y, s = 1) => `<path d="M${f(x)},${f(y - 4.2 * s)} L${f(x + 3.2 * s)},${f(y)} L${f(x)},${f(y + 4.2 * s)} L${f(x - 3.2 * s)},${f(y)}Z" fill="#FFD27A" stroke="#2A1D4F" stroke-width=".8"/>`;
export const belge = (x, y, s = 1) => `<g transform="translate(${f(x)},${f(y)}) scale(${f(s)})"><path d="M-3,-4 H1.6 L3.4,-2.2 V4 H-3Z" fill="#E2D6F5" stroke="#2A1D4F" stroke-width=".7"/><path d="M-1.6,-.6 H1.8 M-1.6,1.4 H1.8" stroke="#2A1D4F" stroke-width=".6"/></g>`;

// küme rozeti: öndeki gezegen + arkasında silik eşleri + sayı rozeti (renge değil sayıya dayanır)
export function clusterBadge(x, y, members, radOf, stOf, ps = 1) {
  const ms = members.slice().sort((a, b) => PRI[stOf(a)[0]] - PRI[stOf(b)[0]] || radOf(b) - radOf(a));
  const fr = ms[0], r = Math.max(radOf(fr), 11 * ps);
  let s = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r + 9 * ps)}" fill="#120B2C" fill-opacity=".55" stroke="#D9CCFF" stroke-width="1" stroke-dasharray="1.5 3"/>`;
  ms.slice(1).forEach((no, i) => { const a = (-40 + i * 50) * Math.PI / 180; s += `<g opacity=".8">${planet(x + Math.cos(a) * r * .8, y + Math.sin(a) * r * .8, r * .62, stOf(no)[0] === 'ghost' ? 'dark' : stOf(no)[0], {})}</g>`; });
  s += planet(x, y, r, stOf(fr)[0], stOf(fr)[1]);
  const bx = x - r * .8 - 3 * ps, by = y - r * .8 - 3 * ps;
  s += `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(8.5 * ps)}" fill="#FFF1DC" stroke="#2A1D4F" stroke-width="1.2"/><text x="${f(bx)}" y="${f(by + 3.8 * ps)}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${f(10.5 * ps)}" fill="#2A1D4F">${members.length}</text>`;
  return s;
}

// uydular (eski düzen): evren kartlarındaki mini kalem halkası; galaksi haritası uyduSistemi() kullanır
export function uydular(x, y, r, kalemler, ps = 1, o = {}) {
  const n = kalemler.length, orR = r + (o.gap ?? 15) * ps;
  let s = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(orR)}" fill="none" stroke="#D9CCFF" stroke-width="1" stroke-dasharray="1.5 3" opacity=".75"/>`;
  if (!n) return s;
  const done = kalemler.filter((k) => k.durum === 'tamam').length;
  if (done) { const a1 = -90 + done / n * 360, p = (a) => [x + Math.cos(a * Math.PI / 180) * orR, y + Math.sin(a * Math.PI / 180) * orR]; const [x0, y0] = p(-90), [x1, y1] = p(Math.min(a1, 269.9)); s += `<path d="M${f(x0)},${f(y0)} A${f(orR)},${f(orR)} 0 ${a1 + 90 > 180 ? 1 : 0} 1 ${f(x1)},${f(y1)}" fill="none" stroke="#FFD27A" stroke-width="2" stroke-linecap="round"/>`; }
  kalemler.forEach((k, i) => {
    const a = (-90 + (i + .5) / n * 360) * Math.PI / 180, mx = x + Math.cos(a) * orR, my = y + Math.sin(a) * orR, mr = (o.mr ?? 4.6) * ps;
    // ip: ana gezegene bağlı olduğu görülsün (alt adım, ayrı gezegen değil)
    if (o.ip) s += `<path d="M${f(x + Math.cos(a) * (r + 1))},${f(y + Math.sin(a) * (r + 1))} L${f(mx - Math.cos(a) * mr)},${f(my - Math.sin(a) * mr)}" stroke="#D9CCFF" stroke-width="1" opacity=".55"/>`;
    if (k.durum === 'tamam') s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr * 2.4)}" fill="url(#glowGold)" opacity=".8"/><circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="url(#pLit2)"/>`;
    else if (k.durum === 'suruyor' || k.durum === 'hazir') s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr + 2.6)}" fill="none" stroke="#FFD27A" stroke-width="1" stroke-dasharray="2 1.6"/><circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="#2A2452"/><path d="M${f(mx)},${f(my - mr)} A${f(mr)},${f(mr)} 0 0 1 ${f(mx)},${f(my + mr)}Z" fill="#FFE29A"/>`;
    else if (k.durum === 'engelli') s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="url(#pBlock)"/><path d="M${f(mx - mr * .6)},${f(my - mr * .6)} L${f(mx + mr * .6)},${f(my + mr * .6)}" stroke="#1A1238" stroke-width="1.6"/>`;
    else s += `<circle cx="${f(mx)}" cy="${f(my)}" r="${f(mr)}" fill="#1A1238" stroke="#B9A6F2" stroke-width="1.2"/>`;
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
  const done = ks.filter((k) => k.durum === 'tamam').length, kalem = ks.some((k) => k.kalem);
  if (!o.yakin) {
    const rx = r * 1.95 + 2 * ps, ry = rx * .32, aci = -18 * Math.PI / 180, ca = Math.cos(aci), sa = Math.sin(aci);
    const nok = (th) => [x + rx * Math.cos(th) * ca - ry * Math.sin(th) * sa, y + rx * Math.cos(th) * sa + ry * Math.sin(th) * ca];
    const yay = (a0, a1) => { const P = []; for (let i = 0; i <= 28; i++) P.push(nok(a0 + (a1 - a0) * i / 28)); return yolD(P); };
    const cizgi = kalem ? `stroke-dasharray="0 ${f(3.2 * ps)}" stroke-linecap="round" stroke-width="${f(2.2 * ps)}"` : `stroke-width="${f(1.3 * ps)}"`;
    let s = `<path class="uydu-halka" d="${yay(0, Math.PI * 2)}" fill="none" stroke="#D9CCFF" opacity=".7" ${cizgi}/>`;
    if (done) s += `<path d="${yay(Math.PI, Math.PI + done / n * Math.PI * 2)}" fill="none" stroke="#FFD27A" ${kalem ? cizgi : `stroke-width="${f(2 * ps)}" stroke-linecap="round"`}/>`;
    const [tx, ty] = nok(0);
    return s + sans(f(tx + 4 * ps), f(ty + 3.5 * ps), `${done}/${n}`, { fs: 9 * Math.max(1, ps), fw: 750, col: '#FFE6B0' });
  }
  // adlar yazılınca (Z3) aralık yazı satırı kadar açılır
  const mr = Math.max(2.6 * ps, r * .5), ara = Math.max(2 * mr * 1.25, o.adlar ? 17 : 0), b = ara / (2 * Math.PI);
  const sira = ks.map((k, i) => ({ k, i })).sort((p, q) => (p.k.t ?? p.i) - (q.k.t ?? q.i) || p.i - q.i);
  let th = -Math.PI / 2, s = '', yol = [];
  const rho = (t) => r + mr + (o.bosluk ?? 7) * ps + b * (t + Math.PI / 2);
  const P = sira.map(() => { const p = [x + Math.cos(th) * rho(th), y + Math.sin(th) * rho(th)]; th += ara / rho(th); return p; });
  for (let t = -Math.PI / 2; t <= th - ara / rho(th) + .01; t += .12) yol.push([x + Math.cos(t) * rho(t), y + Math.sin(t) * rho(t)]);
  if (yol.length > 1) s += `<path d="${yolD(yol)}" fill="none" stroke="#D9CCFF" stroke-width="${f(.8 * ps)}" stroke-dasharray="1.5 2.5" opacity=".6"/>`;
  sira.forEach(({ k }, i) => {
    const [mx, my] = P[i];
    s += planet(mx, my, mr, UYDU_DURUM[k.durum] || 'dark', { life: false, mini: true, waitRings: 1 });
    if (o.ini && !o.adlar) s += sans(f(mx), f(my + mr * .45), esc((k.ad[0] || '').toLocaleUpperCase('tr')), { fs: Math.max(7, mr * 1.2), fw: 800, col: '#FFF3E8', anchor: 'middle' });
    // ad dışa doğru: gezegenin solundaki uydu sola, sağındaki sağa yazılır
    if (o.adlar) { const sol = mx < x; s += sans(f(mx + (sol ? -1 : 1) * (mr + 3 * ps)), f(my + 3.5), esc(kisalt(k.ad, 18)), { fs: 10, fw: 600, col: C.ink2, anchor: sol ? 'end' : 'start' }); }
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
export function yolCiz(M, o = {}) {
  const F = M.F, NOWx = o.now, X = o.x ?? NOWx, ps = o.ps ?? 1, kucuk = o.lod === 'kucuk';
  const AK = M.AK;
  // zaman ölçeği (plan 27 Eki, D): bugünü büyütür; o.tau = 0 doğrusal
  const G = olcekliKur(AK, { cx: o.cx ?? 195, cy: o.cy ?? 312, R: o.R ?? 140, ps, simdi: NOWx, sira: o.sira, spin: o.spin, haric: o.haric || AK.haric, tau: o.tau ?? TAU });
  const RENK = uyeRenkleri(G, M.sahip);
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
      if (k === 'lit' || k === 'tahmin') s += `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r * 2.6)}" fill="url(#glowGold)" opacity=".7"/><circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r)}" fill="url(#pLit2)"/>`;
      else if (k === 'ghost') s += `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(pr * .6)}" fill="none" stroke="#A99BDB" stroke-width=".7" stroke-dasharray="1.5 1.5"/>`;
      else if (k === 'wait') s += `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r + 2)}" fill="none" stroke="#FFD27A" stroke-width=".9" stroke-dasharray="2 2"/><circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r)}" fill="url(#pWait)"/>`;
      else if (k === 'block') s += `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r * 3)}" fill="url(#glowCoral)"/><circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r * 1.1)}" fill="url(#pBlock)"/><circle cx="${f(g.x + r * .45)}" cy="${f(g.y + r * .2)}" r="${f(r * .9)}" fill="#1A1238" opacity=".9"/>`;
      else s += `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r)}" fill="url(#pDark)" stroke="#8E80D6" stroke-width=".6"/>`;
    }
    if (G.kule && o.kule !== false) s += `<circle cx="${f(G.kule.x)}" cy="${f(G.kule.y)}" r="${f(Math.max(1.6, pr * .8))}" fill="${F.kapandi ? '#FFE29A' : '#FFD27A'}" stroke="#2A1D4F" stroke-width=".5"/>`;
    return { svg: s, G, P, radOf, stOf, RENK };
  }

  // ---------- ayrıntılı ----------
  s += `<ellipse cx="${f(G.cx)}" cy="${f(G.cy)}" rx="${f(G.R * 1.4)}" ry="${f(G.R * 1.35)}" fill="url(#glowLilac)" opacity=".32"/>`;
  s += `<circle cx="${f(G.cx)}" cy="${f(G.cy)}" r="${f(G.R * .22)}" fill="url(#bloom)" opacity=".9"/>`;
  const L = {}; for (const u of G.uyeler) L[u.ad] = '';
  const tSolid = F.kapandi ? tEnd : Math.min(X, NOWx);
  const m13 = Math.min(ps, 1.3);
  for (const u of G.uyeler) {
    const col = o.sis && o.focus !== u.ad ? '#9C8BE0' : UYE_RENK(u), tum = u.yol.map((p) => [p.x, p.y]);
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
    if (gec.length > 1) {
      t += `<path d="${yolD(gec)}" fill="none" stroke="#FFB47F" stroke-width="${f(5 * m13)}" opacity=".26" filter="url(#blur6)" stroke-linecap="round"/>`;
      t += `<path d="${yolD(gec)}" fill="none" stroke="${o.allLit ? '#FFD9B8' : col}" stroke-width="${f(1.6 * m13)}" stroke-linecap="round"/>`;
    }
    if (X > NOWx && !F.kapandi) {
      const th = G.kesit(u.ad, NOWx, X);
      if (th.length > 1) t += `<path d="${yolD(th)}" fill="none" stroke="${col}" stroke-width="${f(1.4 * m13)}" stroke-dasharray="6 4" stroke-linecap="round" opacity=".95"/>`;
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
  const ex = (no) => ({ karar: !o.ikonAyri && byNo[no].karar && !SONUK.includes(stOf(no)), waitRings: 1, life: radOf(no) > 10, cloudGap: o.ikonAyri ? Math.max(30, 44 - radOf(no)) : 4, kenar: !!o.minR });
  const ikonlar = [];
  const pl = (no) => {
    const g = G.gezegen[no], k = stOf(no), r = k === 'dark' && o.minR ? Math.max(radOf(no), o.minR * ps) : radOf(no);
    let t = '';
    // darboğaz tacı: açık adımda; sunucunun darboğazı en az ışıklı (R11)
    if (!SONUK.includes(k) && k !== 'tahmin') t += tac(g.x, g.y, r, Math.max(g.korona || 0, F.darbogaz === +no ? 1 : 0));
    if (k === 'tahmin') t += `<g opacity=".55">${planet(g.x, g.y, r, 'lit', { life: false })}</g><circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r + 4)}" fill="none" stroke="#FFD27A" stroke-width="1.2" stroke-dasharray="2 3"/>`;
    else t += planet(g.x, g.y, r, k, ex(no));
    if (o.ikonAyri && k === 'block') ikonlar.push({ tur: 'bulut', no: +no, x: g.x + radOf(no) * .15, y: g.y - radOf(no) - ex(no).cloudGap - 3 });
    // lejant satırından vurgu (3.G): kısa süre yanıp söner
    if (o.parla && o.parla.has(+no)) t += `<circle class="dongu-parla" cx="${f(g.x)}" cy="${f(g.y)}" r="${f(r + 9)}" fill="none" stroke="#FFF3E8" stroke-width="2.2"/>`;
    // kritik yol (açık): altın elmas sol üstte; çıktı: belge sağ altta
    if (g.kritik && !SONUK.includes(k)) t += elmas(g.x - r * .85 - 2, g.y - r * .85 - 2, Math.min(1.3, Math.max(.8, r / 9)));
    if (byNo[no].cikti) t += belge(g.x + r * .9 + 2, g.y + r * .8 + 2, Math.min(1.3, Math.max(.8, r / 9)));
    if (o.ikonAyri && byNo[no].karar && !SONUK.includes(k)) {
      const D = Math.max(44, radOf(no) + 30), a = 35 * Math.PI / 180, bx = g.x + Math.sin(a) * D, by = g.y - Math.cos(a) * D;
      t += `<path d="M${f(g.x + Math.sin(a) * (r + 3))},${f(g.y - Math.cos(a) * (r + 3))} L${f(g.x + Math.sin(a) * (D - 12))},${f(g.y - Math.cos(a) * (D - 12))}" stroke="#FFD27A" stroke-width="1" stroke-dasharray="1.5 3" opacity=".8"/>`;
      t += `<circle cx="${f(bx)}" cy="${f(by)}" r="12" fill="#1A1238" stroke="#FFD27A" stroke-width="1.2"/><g transform="translate(${f(bx - 2)},${f(by + 6)})"><rect x="-.6" y="-12" width="1.2" height="12" fill="#FFF1E0"/><path d="M.6,-12 L7.5,-9.6 L.6,-7.2Z" fill="#FFD27A"/></g>`;
      ikonlar.push({ tur: 'bayrak', no: +no, x: bx, y: by });
    }
    // ortak gezegen (3.11): halka kişilerin renginde dilimlere bölünür
    if (g.ortak && !o.sis && g.uyeler.length > 1) {
      const n = g.uyeler.length, R2 = r + 3.2, bos = .28;
      g.uyeler.forEach((ad, i) => {
        const a0 = -Math.PI / 2 + i * 2 * Math.PI / n + bos / 2, a1 = a0 + 2 * Math.PI / n - bos;
        t += `<path d="M${f(g.x + Math.cos(a0) * R2)},${f(g.y + Math.sin(a0) * R2)} A${f(R2)},${f(R2)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f(g.x + Math.cos(a1) * R2)},${f(g.y + Math.sin(a1) * R2)}" fill="none" stroke="${UYE_RENK(G.uyeOf[ad])}" stroke-width="${f(2 * m13)}" stroke-linecap="round"/>`;
      });
    }
    // uydu sistemi v2 (3.B): uzakta Satürn halkası, Z2'den itibaren mini sarmal, Z3'te adlar (etkin aşama kuralı kalktı, 3.23a)
    if (o.sats && o.sats[no]) t += uyduSistemi(g.x, g.y, r, o.sats[no], ps, { yakin: !!o.satYakin, adlar: !!o.satAdlar && o.sats[no].length <= 6, ini: o.sats[no].length <= 8 });
    return t;
  };
  const sahipGrubu = (no) => o.focus && G.gezegen[no].uyeler.includes(o.focus) ? o.focus : byNo[no].sahip;
  // durum odağı (plan 27 Eki, 2.C): uymayan gezegen söner
  const durumda = (no) => !o.durumOdak || o.durumOdak(+no);
  for (const no of vis) if (!inCl.has(no)) L[sahipGrubu(no)] += durumda(no) ? pl(no) : `<g opacity=".16">${pl(no)}</g>`;
  for (const c of cl) { const g = G.gezegen[c[0]]; L[o.focus && c.some((n) => G.gezegen[n].uyeler.includes(o.focus)) ? o.focus : byNo[c[0]].sahip] += clusterBadge(g.x, g.y, c, radOf, (n) => [stOf(n) === 'tahmin' ? 'lit' : stOf(n), ex(n)], ps * .9); }
  const gemiler = [];
  if (o.ships !== false && !F.kapandi) for (const u of G.uyeler) {
    if (u.hayalet || (o.sis && o.focus !== u.ad)) continue;
    const acik = u.ziyaret.some((no) => !BIT(byNo[no].durum)) || X < u.tSon;
    const p = G.konumAn(u.ad, X); if (!p || !acik) continue;
    if (p.demir && X >= u.tSon && !u.kendi.some((no) => !BIT(byNo[no].durum))) continue;
    const kind = u.tip === 'agent' ? 'agent' : u.tip === 'dis' ? 'dis' : 'insan';
    const sc = (o.shipSc ?? .78) * Math.min(ps, 1.4) * OK;
    gemiler.push({ ad: u.ad, tip: kind, x: p.x, y: p.y - (kind === 'dis' ? 6 * sc : 0), sc });
    L[u.ad] += `<g opacity="${X > NOWx ? .75 : 1}">` + ship(p.x, p.y - (kind === 'dis' ? 6 * sc : 0), kind === 'dis' ? 0 : p.yon * 180 / Math.PI, kind, kind === 'dis' ? '' : kisaAd(u.ad)[0], o.sis && o.focus !== u.ad ? '#9C8BE0' : UYE_RENK(u), sc, { flame: kind !== 'dis' && X <= NOWx }) + '</g>';
  }
  for (const u of G.uyeler) { const d = dim(u.ad); if (d) s += `<g opacity="${o.sel ? Math.min(d, .55) : d}" ${o.sis && o.focus !== u.ad ? 'filter="url(#blur2)"' : ''}>${L[u.ad]}</g>`; }
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
      if (ch.length > 1) secim = `<path d="${yolD(ch)}" fill="none" stroke="#FFD27A" stroke-width="1.2" stroke-dasharray="1 3" stroke-linecap="round" opacity=".9"/>` + secim;
    }
    secim += `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(radOf(o.sel) + 15)}" fill="none" stroke="#FFF3E8" stroke-width="1.6" opacity=".55"/>` + planet(g.x, g.y, radOf(o.sel), stOf(o.sel), ex(o.sel));
    if (!o.selTop) s += secim;
  }
  if (o.labels) for (const [no, text, dx, dy, col, st] of o.labels) { const g = G.gezegen[no]; if (g) s += pill(g.x + dx * ps * YK, g.y + dy * ps * YK, esc(text), { fs: 11 * m13 * YK, fw: 650, col: col || C.ink, stroke: st }); }
  return { svg: s, G, P, radOf, stOf, clusters: cl, secim, RENK, gemiler, ikonlar };
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
  s += `<g transform="translate(${x + 22 * ps},${y})"><circle r="${22 * ps}" fill="#1E1645" stroke="#FFD27A" stroke-opacity=".7"/>`;
  s += o.oynuyor ? `<rect x="${-6 * ps}" y="${-8 * ps}" width="${4.2 * ps}" height="${16 * ps}" rx="1.5" fill="#FFD27A"/><rect x="${1.8 * ps}" y="${-8 * ps}" width="${4.2 * ps}" height="${16 * ps}" rx="1.5" fill="#FFD27A"/>` : `<path d="M${-5 * ps},${-8.5 * ps} L${9 * ps},0 L${-5 * ps},${8.5 * ps}Z" fill="#FFD27A"/>`;
  s += `</g>`;
  s += `<rect x="${x0}" y="${y - 4 * ps}" width="${x1 - x0}" height="${8 * ps}" rx="${4 * ps}" fill="#120B2C" stroke="#8E80D6" stroke-opacity=".45"/>`;
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
  s += pill(px, y - 22 * ps, esc(et), { fs: 11 * ps, fw: 750, bg: X > NOWx ? '#1A1440' : '#FFD27A', bgo: 1, col: X > NOWx ? '#FFE6B0' : '#2A1D4F', stroke: X > NOWx ? '#FFD27A' : 'none' });
  return { svg: s, xOf, tOf, x0, x1, t0, t1 };
}
