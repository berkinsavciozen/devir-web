// Kişi Yörüngeleri · harita motoru (13 Kas, sentez). Prototipten taşındı (lejant-arac/sentez/prototip/harita.js).
// İlke: DOM yalnız kurulumda (akış / bakan değişince) yaratılır. Zaman değişince yalnız öznitelikler (transform, d, r, sınıf),
// yakınlaşmada yalnız kameranın transform'u ve kökteki --ik değişkeni değişir. Her harita kendi örneğidir (yorungeHaritasi()).
import { GUN, SA, TSI, ALARM, KISI_DURUM_AD, tarihKisa, gunBasi, gunAy, anYaz, ms } from './model.js';
import { f, DEFS, gezegen, arac, kenet } from './cizim.js';

const kisa = (ad) => String(ad || '').replace(/\s*\(.*\)$/, '');
let SAYAC = 0;
const RAD = Math.PI / 180;
// açı = zaman (balıkgözü): bugün tepede (0), gelecek saat yönünde. 1 gün ≈ 25°, 7 gün ≈ 103°, 14 gün ≈ 135°; geçmiş solda.
// Zaman → açı (U7b): çerçeve akışın kendisidir. Akışın başlangıcı çerçevenin geri ucuna (-AP), bitişi ileri ucuna (AF) denk gelir;
// harita akıştan uzun bir süreyi kapsamaz. İğne (an) hep tepede. Yakınlaşma uçları oynatmaz, iğnenin çevresini açar (KZ büyür).
// Değerler örneğe aittir; modül değişkeni paylaşıldığı için her örnek kullanmadan önce olcek() ile yazar.
let AF = 150 * RAD, AP = 120 * RAD, DF = 7, DP = 7, KZ = 1.6;
const balik = (x) => (KZ < 1e-3 ? x : (1 - Math.exp(-KZ * x)) / (1 - Math.exp(-KZ)));
const aci = (dt) => { const d = dt / GUN; return d >= 0 ? AF * balik(Math.min(d / DF, 1.05)) : -AP * balik(Math.min(-d / DP, 1.05)); };
const GEO = {
  // telefon (sentez): daireye yakın, ekrandan büyük kadran; açılışta 1:1, iğne ve kişi sütunu ortada; kaydırarak dolaşılır.
  // 1 gün ≈ 8°: dış yörüngede ≈ 125 px/gün, iç yörüngede ≈ 85 px/gün.
  tel: { rxIn: 600, ryIn: 600, rxOut: 860, ryOut: 920, cOut: -60, gun: 7, coreR: 540, xCol: 178, acilis: true, gunP: 6.5, yildiz: 900 },
  mas: { rxIn: 88, ryIn: 88, rxOut: 330, ryOut: 272, cOut: -112, gun: 25, gunP: 26.67, xCol: 272, yildiz: 140 },
};
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const NS = 'http://www.w3.org/2000/svg';
const GECIS = 14 * 36e5; // biten iş aracın altından 14 saatte (doğrusal) geçer: 3 saatlik adımda ≤ 24 px


/** Bir harita örneği: kur(M, o) → guncelle(an, D); kamera, seçim ve vurgu aynı örnekte. */
export function yorungeHaritasi() {
  const H0 = 'ky' + (++SAYAC) + '-';
  let H = null; // harita durumu

  function halkalar(M, geo, kisiler) {
    const W = kisiler.map((k) => (k.tip === 'agent' ? .62 : 1));
    const top = W.reduce((a, b) => a + b, 0) + .7;
    let c = 0;
    const R = kisiler.map((k, i) => { const u = c / top; c += W[i]; return { k, u, w: W[i], rx: lerp(geo.rxIn, geo.rxOut, u), ry: lerp(geo.ryIn, geo.ryOut, u), cy: lerp(0, geo.cOut, u), i }; });
    const sinir = { u: 1, rx: geo.rxOut, ry: geo.ryOut, cy: geo.cOut };
    R.forEach((h, i) => { h.dis = R[i + 1] || sinir; h.ic = R[i - 1] || null; h.ust = h.cy - h.ry; h.bant = (h.cy - h.ry) - (h.dis.cy - h.dis.ry); });
    return { R, sinir };
  }
  const nokta = (h, t, off = 0) => [(h.rx + off) * Math.sin(t), h.cy - (h.ry + off) * Math.cos(t)];
  const hiz = (h, t) => Math.hypot(h.rx * Math.cos(t), h.ry * Math.sin(t));
  function yay(h, t0, t1, off = 0, adim = 2 * RAD) {
    const n = Math.max(2, Math.ceil(Math.abs(t1 - t0) / adim));
    let d = '';
    for (let j = 0; j <= n; j++) { const [x, y] = nokta(h, lerp(t0, t1, j / n), off); d += (j ? 'L' : 'M') + f(x) + ',' + f(y); }
    return d;
  }
  function yayBoy(h, t0, t1, off = 0) { let L = 0, p = nokta(h, t0, off); const n = 80; for (let j = 1; j <= n; j++) { const q = nokta(h, lerp(t0, t1, j / n), off); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; } return L; }
  const el = (tag, at = {}, html) => { const e = document.createElementNS(NS, tag); for (const k in at) e.setAttribute(k, at[k]); if (html != null) e.innerHTML = html; return e; };

  /** Kurulum. M: model, o: {cihaz, svg, bakan, sonBakis, yeni (adım→renk), renkOf} */
  function kur(M, o) {
    const svg = o.svg; svg.innerHTML = '';
    const geo = { ...GEO[o.cihaz] };
    // çerçeve (zaman yörüngesi) alanı doldurur: geniş düzende alan dikse elips dikleşir, alt kenar yerinde kalır (U6)
    if (!geo.acilis) {
      const W0 = svg.clientWidth || 700, H0 = svg.clientHeight || 600, en = Math.max(1, W0 - 110), boy = Math.max(1, H0 - 72);
      const ry = Math.max(geo.ryOut, Math.min(430, geo.rxOut * boy / en)); // alan dik: elips dikleşir
      geo.cOut += geo.ryOut - ry; geo.ryOut = ry;
      geo.rxOut = Math.max(geo.rxOut, Math.min(440, geo.ryOut * en / boy)); // alan yatık: elips genişler
    }
    // telefonda kadran ekrandan büyük: çerçevenin görünen yayı akışı taşır (uçlar ekranın iki kenarı)
    const AF0 = geo.acilis ? Math.asin(183 / geo.rxOut) : 150 * RAD, AP0 = geo.acilis ? AF0 : 120 * RAD, K0 = geo.acilis ? 2 : 1.6;
    AF = AF0; AP = AP0; KZ = K0;
    DF = Math.max(2, (M.aralik[1] - M.simdi) / GUN); DP = Math.max(2, (M.simdi - M.aralik[0]) / GUN);
    const ek = AF0 / (150 * RAD); // küçük açı payları yayın boyuna göre
    const gor = (a) => !M.gorunur || M.gorunur.has(a.no);
    // bakan kişi (ve agent'ı) en dış, en geniş yörüngede: kendi şeridi en uzun, "bana düşen" en kolay okunur
    const benim = (k) => k.ad === M.bakan || (k.tip === 'agent' && k.sahibi === M.bakan);
    const kisiler0 = M.kisiler.filter((k) => !M.gorunur || k.adimlar.some((n) => M.gorunur.has(n)));
    const kisiler = [...kisiler0.filter((k) => !benim(k)), ...kisiler0.filter(benim)];
    const { R, sinir } = halkalar(M, geo, kisiler);
    const halkaOf = Object.fromEntries(R.map((h) => [h.k.ad, h]));
    // öğe boyu (U6): araç ve işler komşu yörüngeye binmeyecek kadar büyür (en dar bant belirler), en çok 1,7 kat
    R.forEach((h) => { h.ob = Math.max(1, Math.min(1.7, h.bant * .84 / (h.k.tip === 'agent' ? 24 : 28))); });
    const OB = 1.6; // işler: yerel bant ve aynı yörüngedeki komşu ayrıca sınırlar (guncelle)
    const disBakan = M.bakanTip === 'dis';
    const defs = el('defs', {}, DEFS + R.map((h) => {
      const off = h.k.tip === 'agent' ? 8.2 : 10.8;
      return `<path id="${H0}serL${h.i}" d="${yay(h, -85 * RAD, 0, off, 1 * RAD)}"/><path id="${H0}serR${h.i}" d="${yay(h, 0, 115 * RAD, off, 1 * RAD)}"/>`;
    }).join('')); svg.appendChild(defs);
    // gök (kameranın dışında: zoomla değişmez)
    // gök uygulamanın sahnesinden gelir (Sahne); burada zemin çizilmez
    const kam = el('g', { class: 'kamera' }); svg.appendChild(kam);
    // içerik (yörüngeler, işler, araçlar) yakınlaşır; çerçeve (zaman yörüngesi, günler, hedef bayrağı, iğne) yerinde kalır
    defs.appendChild(el('clipPath', { id: H0 + 'cer' }, `<ellipse cx="0" cy="${f(sinir.cy)}" rx="${f(sinir.rx)}" ry="${f(sinir.ry)}"/>`));
    const zkap = el('g', { class: 'k-icerik' }); kam.appendChild(zkap);
    const zg = el('g', { class: 'k-zoom' }); zkap.appendChild(zg);
    const kat = {};
    ['dilim', 'halka', 'hedef', 'kuyruk', 'rota', 'kopru', 'bag', 'gezegen', 'serit', 'kenet', 'arac', 'cekirdek'].forEach((n) => { kat[n] = el('g', { class: 'k-' + n }); zg.appendChild(kat[n]); });
    ['cerceve', 'gun', 'isaret', 'igne'].forEach((n) => { kat[n] = el('g', { class: 'k-' + n }); kam.appendChild(kat[n]); });
    // yörüngeler (statik): geçmiş yayı soluk, gelecek yayı belirgin; tür = çizgi biçimi
    R.forEach((h) => {
      const k = h.k, ben = k.ad === M.bakan;
      const dash = k.tip === 'agent' ? '1.2 3.4' : k.tip === 'dis' ? '7 3.5' : '';
      const w = ben ? 2.4 : k.tip === 'agent' ? 1.3 : 1.5;
      kat.halka.appendChild(el('path', { d: yay(h, -AP - .12 * ek, 0), fill: 'none', stroke: k.renk, 'stroke-width': w * .8, 'stroke-dasharray': dash, 'stroke-linecap': 'round', opacity: .26, class: 'yorunge', 'data-kisi': k.ad }));
      kat.halka.appendChild(el('path', { d: yay(h, 0, AF + .14 * ek), fill: 'none', stroke: k.renk, 'stroke-width': w, 'stroke-dasharray': dash, 'stroke-linecap': 'round', opacity: ben ? .85 : .55, class: 'yorunge', 'data-kisi': k.ad }));
    });
    // sınır (gün çentikleri burada)
    kat.cerceve.appendChild(el('path', { d: yay(sinir, -AP - .12 * ek, AF + .14 * ek), fill: 'none', stroke: '#FFF6E0', 'stroke-width': 1, opacity: .3, class: 'cerceve' }));
    // dikiş: geçmişle geleceğin buluştuğu alt bölge
    const [dx1, dy1] = nokta(sinir, AF + .2 * ek, 8), [dx2, dy2] = nokta(sinir, -AP - .18 * ek, 8);
    kat.cerceve.appendChild(el('text', { x: f(dx1), y: f(dy1 + 12), class: 'dikis', 'text-anchor': 'start' }, '→ ileri'));
    kat.cerceve.appendChild(el('text', { x: f(dx2), y: f(dy2 + 12), class: 'dikis', 'text-anchor': 'end' }, 'geri ←'));

    // gün çentikleri (havuz)
    const gunler = [];
    for (let j = 0, n = Math.min(240, Math.round((M.aralik[1] - M.aralik[0]) / GUN) + 2); j < n; j++) { const g = el('g', { class: 'gun-c' }); g.innerHTML = `<line y1="0" y2="-6" stroke="#FFF6E0" stroke-width="1"/><text class="gun-t" y="-10" text-anchor="middle"></text>`; kat.gun.appendChild(g); gunler.push({ g, t: g.querySelector('text'), gun: null }); }

    // son bakış dilimi
    const dilim = el('path', { class: 'dilim', fill: '#FFF6E0', 'fill-opacity': .055 }); kat.dilim.appendChild(dilim);
    const dilimKenar = el('path', { class: 'dilim-k', fill: 'none', stroke: '#FFF6E0', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: .55 }); kat.dilim.appendChild(dilimKenar);
    const dilimYazi = el('text', { class: 'dilim-t', 'text-anchor': 'end' }, 'son bakış'); kat.dilim.appendChild(dilimYazi);
    // hedef çizgisi
    const hedefYol = el('path', { fill: 'none', stroke: '#FFF6E0', 'stroke-width': 1.4, 'stroke-dasharray': '5 3.5', opacity: .75 }); kat.hedef.appendChild(hedefYol);
    const hedefBayrak = el('g', { class: 'bayrak' }); hedefBayrak.innerHTML = `<rect x="-2" y="-9" width="62" height="16" rx="8" fill="#0A2736" stroke="#FFF6E0" stroke-width=".9" opacity=".95"/><text x="29" y="2.6" text-anchor="middle" class="bayrak-t"></text>`; kat.isaret.appendChild(hedefBayrak);
    const bugunIsaret = el('g', { class: 'bugun-i' }); bugunIsaret.innerHTML = `<path d="M0,0 L-5,-9 L5,-9Z" fill="#FFC9A3"/><text y="-13" text-anchor="middle" class="bugun-t">bugün</text>`; kat.isaret.appendChild(bugunIsaret);

    // gezegenler
    const P = {};
    M.adimlar.filter(gor).forEach((a) => {
      const k = M.kisi[a.sahip]; if (!halkaOf[a.sahip]) return;
      const ortakRenk = a.ortak.length ? (M.kisi[a.ortak[0]] || {}).renk : null;
      const altlar = a.altlar.map((n) => ({ no: n, bitti: false }));
      const g = el('g', { class: 'gz', 'data-no': a.no, tabindex: 0, role: 'button', 'aria-label': `${a.no} ${a.kisa_ad || a.ad}` });
      const ol = el('g', { class: 'ol' });
      const ad = (a.kisa_ad || a.ad);
      ol.innerHTML = gezegen(a, { renk: k.renk, ortakRenk, kritik: M.kritik.has(a.no), darbogaz: M.darbogaz === a.no, tut: M.darbogazTut, karar: a.karar_adimi, cikti: a.cikti_sayisi > 0 ? (a.karar_adimi ? 'terazi' : 'belge') : null, altlar, yeniRenk: o.yeni && o.yeni[a.no], ad: ad.length > 14 ? ad.slice(0, 13) + '…' : ad, rutinsiz: a.rutin_var === false });
      g.appendChild(ol); kat.gezegen.appendChild(g);
      const kuyruk = a.tSon != null ? el('path', { fill: 'none', stroke: ALARM, 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .85, class: 'kuyruk' }) : null;
      if (kuyruk) kat.kuyruk.appendChild(kuyruk);
      const cent = el('line', { class: 'cent', stroke: '#FFF6E0', 'stroke-width': 1, opacity: 0 }); kat.kuyruk.appendChild(cent);
      P[a.no] = { a, g, ol, h: halkaOf[a.sahip], ates: ol.querySelector('.ates'), uydular: [...ol.querySelectorAll('.uydu')], kuyruk, cent, x: 0, y: 0, t: 0, sinif: '' };
      // ortak pay: ortağın yörüngesinde küçük eşkenar dörtgen + radyal köprü
      a.ortak.forEach((ad2) => {
        const h2 = halkaOf[ad2]; if (!h2) return;
        const pay = el('g', { class: 'pay', 'data-no': a.no }); pay.innerHTML = `<g class="ol"><path d="M0,-6 L6,0 L0,6 L-6,0Z" fill="#10283C" stroke="${M.kisi[ad2].renk}" stroke-width="1.8"/><text class="no pay-no" y="2.4">${a.no}</text></g>`;
        kat.gezegen.appendChild(pay);
        const kopru = el('line', { class: 'kopru', stroke: '#FFF6E0', 'stroke-width': 1, 'stroke-dasharray': '1.5 2.5', opacity: .7 }); kat.kopru.appendChild(kopru);
        (P[a.no].paylar ||= []).push({ h: h2, g: pay, kopru, x: 0, y: 0 });
      });
    });
    // geçmiş kümesi (✓n) ve ileri taşma (+n) her yörüngede
    R.forEach((h) => {
      h.kume = el('g', { class: 'kume' }); h.kume.innerHTML = `<g class="ol"><circle r="7" fill="#10283C" stroke="${h.k.renk}" stroke-width="1"/><text class="kume-t" y="2.6"></text></g>`; kat.gezegen.appendChild(h.kume);
      const [x, y] = nokta(h, -AP - .02 * ek); h.kume.setAttribute('transform', `translate(${f(x)},${f(y)})`);
    });

    // araçlar (iğnede sabit) ve şerit yazıları
    const A = {};
    R.forEach((h) => {
      const k = h.k, y = h.ust;
      const g = el('g', { class: 'arac-g', 'data-kisi': k.ad, transform: `translate(0,${f(y)})`, tabindex: 0, role: 'button', 'aria-label': k.ad });
      g.style.setProperty('--ob', h.ob.toFixed(3));
      // dokunma alanı: gövdenin çevresi (44 px'e yakın), çizimden bağımsız
      g.appendChild(el('rect', { class: 'arac-alan', x: -22 * h.ob, y: -20 * h.ob, width: 44 * h.ob, height: 40 * h.ob, fill: 'transparent' }));
      const ol = el('g', { class: 'ol' + (k.ad === M.bakan ? ' ben' : '') }); g.appendChild(ol); kat.arac.appendChild(g);
      // sabit yer ayırma (dock): etiketler hiç kaymaz
      const sahipMi = M.kisiler.some((x) => x.tip === 'agent' && x.sahibi === k.ad);
      const onPx = (k.tip === 'agent' ? 10 + 4 + 16 + 4 : (k.tip === 'dis' ? 17 : 14) + 4 + 19 + (sahipMi ? 11 : 0)) + (k.ad === M.bakan ? 6 : 0); // bakanın plakası büyük
      const arkaPx = k.tip === 'agent' ? 22 : 31;
      h.dockR = onPx * h.ob / h.rx; h.dockL = arkaPx * h.ob / h.rx;
      const off = k.tip === 'agent' ? 8.2 : 10.8;
      const sL = yayBoy(h, -85 * RAD, -h.dockL - 3 / h.rx, off), sR = yayBoy(h, 0, h.dockR + 3 / h.rx, off);
      const darAg = k.tip === 'agent' && h.bant < 24; // dar ay bandı: agent yazısı yok, durum aracın rozetinde
      const solMax = darAg ? 0 : Math.min(geo.acilis ? 168 : 170, sL - yayBoy(h, -85 * RAD, -(52 + 16 * h.u) * RAD, off));
      // tarih sütunu (C): her yörüngenin şeridinde sabit x'e sağa yaslı; alt alta kıyaslanır
      const xc = Math.min(geo.xCol, (h.rx + off) * .74), tc = Math.min(Math.asin(xc / (h.rx + off)), (geo.acilis ? 80 : 40) * RAD);
      const [tx0, ty0] = nokta(h, tc, off), tan = Math.atan2(h.ry * Math.sin(tc), h.rx * Math.cos(tc)) / RAD;
      const tT = el('text', { class: 'tarih-k' + (k.tip === 'agent' ? ' ag' : ''), 'text-anchor': 'end', transform: `translate(${f(tx0)},${f(ty0)}) rotate(${f(tan)})` });
      const sRfull = yayBoy(h, 0, tc, off) - sR, sagMax = darAg ? 0 : Math.min(170, sRfull - 58);
      const cls = k.tip === 'agent' ? 'serit ag' : 'serit';
      const tL = el('text', { class: cls + ' sol' + (k.ad === M.bakan ? ' ben' : '') }); tL.innerHTML = `<textPath href="#${H0}serL${h.i}" startOffset="${f(sL)}" text-anchor="end"></textPath>`;
      const tR = el('text', { class: cls + ' sag k2gizle' }); tR.innerHTML = `<textPath href="#${H0}serR${h.i}" startOffset="${f(sR)}" text-anchor="start"></textPath>`;
      kat.serit.appendChild(tL); kat.serit.appendChild(tR); if (!darAg) kat.serit.appendChild(tT);
      const rota = el('path', { fill: 'none', stroke: k.renk, 'stroke-width': k.tip === 'agent' ? 3.4 : 5, 'stroke-linecap': 'round', opacity: .32, class: 'rota' }); kat.rota.appendChild(rota);
      A[k.ad] = { k, h, g, ol, tL: tL.firstChild, tR: tR.firstChild, tT, tarihYazi: '', tarihYer: '', tc0: tc, tOff: off, sR0: sR, sRfull: darAg ? 0 : sRfull, sLmax: solMax, sRmax: sagMax, rota, anahtar: '', solYazi: '', sagYazi: '' };
    });

    // agent–sahip kenedi: agent'ın yörüngesi sahibinin hemen dışında; iğne sütununda ikisinin arasında dikey ışık bağı
    R.forEach((h) => { const k = h.k; if (k.tip !== 'agent' || !A[k.sahibi]) return; const g = el('g', { class: 'kenet' }); kat.kenet.appendChild(g); A[k.ad].kenet = { g, y1: h.ust, y2: A[k.sahibi].h.ust, durum: '' }; });

    // çekirdek: hedef
    const ck = el('g', { class: 'cekirdek' });
    const cr = geo.coreR || Math.min(geo.rxIn, geo.ryIn) - 26;
    const cy0 = geo.coreR ? -cr + 34 : 0; // büyük çekirdekte yazı tepeye yakın: açılışta görünür

    ck.innerHTML = `<circle r="${cr + 16}" fill="url(#cekirdekG)" opacity=".5"/><circle r="${cr}" fill="#0A2736" stroke="#FFF6E0" stroke-width="1.2" opacity=".96"/><circle r="${cr - 4}" fill="none" stroke="#FFF6E0" stroke-width=".6" stroke-dasharray="1 3" opacity=".6"/>` +
      `<text class="ck-1" y="${cy0 - 8}" text-anchor="middle"></text><text class="ck-2" y="${cy0 + 9}" text-anchor="middle"></text><text class="ck-3" y="${cy0 + 21}" text-anchor="middle"></text>`;
    kat.cekirdek.appendChild(ck);
    // iğne
    const igneUst = sinir.cy - sinir.ry - 4;
    const ig = el('g', { class: 'igne' });
    ig.innerHTML = `<line x1="0" y1="${-cr}" x2="0" y2="${f(igneUst)}" stroke="#FFC9A3" stroke-width="1.2" opacity=".55"/><path d="M0,${f(igneUst + 2)} L-6,${f(igneUst - 8)} L6,${f(igneUst - 8)}Z" fill="#FFC9A3"/>` +
      `<g class="igne-tut" transform="translate(0,${f(igneUst - 22)})"><rect class="igne-alan" x="-104" y="-20" width="208" height="40" fill="transparent"/><rect class="igne-kutu" x="-92" y="-12" width="184" height="24" rx="12" fill="#FFC9A3"/><path class="igne-ok" d="M-80,-4.5 L-85,0 L-80,4.5 M80,-4.5 L85,0 L80,4.5" fill="none" stroke="#08222E" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><text class="igne-t" y="4.4" text-anchor="middle"></text></g>`;
    kat.igne.appendChild(ig);

    H = { M, o, svg, kam, zkap, zg, kat, geo, AF0, AP0, K0, ek, R, sinir, halkaOf, P, A, gunler, dilim, dilimKenar, dilimYazi, hedefYol, hedefBayrak, bugunIsaret, ck, cr, ig, igneUst, disBakan,
      kam0: { s: 1, cx: 0, cy: 0 }, k: 1, zk: 1, fy: 0, OB, tx: 0, ty: 0, kademe: 0, sec: null, secKisi: null, kritik: false, vurgu: null, bagG: null };
    H.bagG = kat.bag;
    H.kritikYol = el('g', { class: 'kritik-yol' }); kat.bag.appendChild(H.kritikYol);
    H.kritikYol.innerHTML = `<path class="ky-alt" fill="none" stroke="#06192A" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/><path class="ky-ust" fill="none" stroke="#FFF6E0" stroke-width="1.6" stroke-dasharray="4 2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    H.secBag = el('g', { class: 'sec-bag' }); kat.bag.appendChild(H.secBag);
    sigdir();
    return H;
  }

  // ---------- kamera ----------
  /** bu örneğin zaman ölçeğini modül değişkenlerine yazar (an: iğnedeki an) */
  function olcek(an) {
    const M = H.M; AF = H.AF0; AP = H.AP0;
    DF = Math.max(2, (M.aralik[1] - an) / GUN); DP = Math.max(2, (an - M.aralik[0]) / GUN);
    KZ = H.K0 * (H.zk > 1 ? Math.sqrt(H.zk) : H.zk);
  }
  function sigdir() {
    const g = H.geo;
    const W = H.svg.clientWidth || 390, Hh = H.svg.clientHeight || 600;
    const ust = g.cOut - g.ryOut - 46, alt = g.cOut + g.ryOut + 26;
    if (g.acilis) {
      // telefon: 1:1 (390 genişlikte), iğne ortada, çerçevenin tepesi ve iğne etiketi üstte
      const s = W / 390;
      H.kam0 = { s, cx: W / 2, cy: (H.o.ust ?? 10) - ust * s, W, H: Hh };
    } else {
      const s = Math.min(W / (2 * g.rxOut + 36), Hh / (alt - ust));
      H.kam0 = { s, cx: W / 2, cy: (Hh - (alt - ust) * s) / 2 - ust * s, W, H: Hh };
    }
    H.kMin = 1; H.tam = null;
    H.k = 1; H.tx = 0; H.ty = 0; kamera();
  }
  /** Sığdır: telefonda bütün tarihleri gösteren uzak görünüm; masaüstünde açılış. */
  function tamGorunum() { const T = hedefTam(); H.k = T.k; H.tx = T.tx; H.ty = T.ty; kamera(); }
  function hedefTam() { if (!H.tam) return { k: 1, tx: 0, ty: 0 }; const { s, cx, cy, W } = H.kam0, k = H.tam.k; return { k, tx: W / 2 - cx - H.tam.wx * s * k, ty: (H.o.ust ?? 10) + 24 - cy - H.tam.y0 * s * k }; }
  function kamera() {
    const { s, cx, cy } = H.kam0, kk = H.k;
    H.kam.setAttribute('transform', `translate(${f(cx)},${f(cy)}) scale(${s.toFixed(4)})`);
    // içerik iğne ekseninde bir odak noktasından büyür (aynı andaki iş ile çerçevedeki gün aynı açıda kalır); taşan kısım çerçevede kesilir
    if (kk > 1.001) { H.zg.setAttribute('transform', `translate(0,${f(H.fy * (1 - kk) + H.ty)}) scale(${kk.toFixed(4)})`); H.zkap.setAttribute('clip-path', `url(#${H0}cer)`); }
    else { H.zg.removeAttribute('transform'); H.zkap.removeAttribute('clip-path'); }
    // işaret boyu yakınlaşmayı izler: yakınlaşınca içerikle birlikte büyür (k^0,7), uzaklaşınca küçülür
    H.ku = H.zk < 1 ? Math.pow(H.zk, .4) : 1;
    H.svg.style.setProperty('--ik', (kk > 1 ? Math.pow(kk, -.3) : H.ku).toFixed(4));
    H.svg.style.setProperty('--ig', '1'); // gün yazıları çerçevede: boyu değişmez
    let kd = H.kademe;
    const k = H.zk; // ayrıntı kademesi yakınlaşma düzeyinden
    for (let i = 0; i < 4; i++) { // eşikler histerezisli; büyük sıçramada (sığdır) birkaç kademe birden geçilir
      const k0 = kd;
      if (kd === 0 && k < .62) kd = -1; else if (kd === -1 && k >= .74) kd = 0;
      else if (kd === 0 && k >= 1.5) kd = 1; else if (kd === 1 && k < 1.3) kd = 0;
      else if (kd === 1 && k >= 2.4) kd = 2; else if (kd === 2 && k < 2.1) kd = 1;
      if (kd === k0) break;
    }
    const ad = (x) => (x < 0 ? 'kdU' : 'kd' + x);
    if (kd !== H.kademe) { H.svg.classList.remove('kdU', 'kd0', 'kd1', 'kd2'); H.svg.classList.add(ad(kd)); H.kademe = kd; }
    else if (!H.svg.classList.contains(ad(kd))) H.svg.classList.add(ad(kd));
  }
  /**
   * Yakınlaşma: çerçeve (zaman yörüngesi) yerinde kalır. Yakınlaşınca içerik iğne eksenindeki odaktan büyür (yörünge aralığı ve
   * işaretler de büyür) ve iğnenin çevresindeki zaman açılır; akışın uçları çerçevenin uçlarında kalır. Uzaklaşınca zaman düzleşir.
   */
  const tySinir = () => { const k = H.k, ust = H.sinir.cy - H.sinir.ry, alt = H.cr; return [-(k - 1) * (alt - H.fy), (k - 1) * (H.fy - ust)]; };
  function zoomAt(k2) {
    const z0 = H.zk; H.zk = Math.max(.4, Math.min(6, k2));
    if (z0 <= 1.001 && H.zk > 1.001) { // odak: seçili kişinin, yoksa bakanın yörüngesi; o da yoksa orta
      const h = (H.secKisi && H.halkaOf[H.secKisi]) || (H.sec != null && H.P[H.sec] && H.P[H.sec].h) || H.halkaOf[H.M.bakan] || H.R[Math.floor(H.R.length / 2)];
      H.fy = h ? h.ust : 0; H.ty = 0;
    }
    H.k = H.zk > 1 ? Math.sqrt(H.zk) : 1; H.tx = 0;
    if (H.k <= 1.001) H.ty = 0; else { const [a, b] = tySinir(); H.ty = Math.max(a, Math.min(b, H.ty)); }
    kamera();
    if (H.D) guncelle(H.an, H.D);
    if (H.o.zoomDegis) H.o.zoomDegis(H.zk);
  }
  /** kaydırma: çerçeve sabit; yakınlaşmışken dikey çekiş sığmayan yörüngeleri getirir */
  function kaydir(dx, dy) { if (H.k <= 1.001) return; const [a, b] = tySinir(); H.ty = Math.max(a, Math.min(b, H.ty + dy / H.kam0.s)); kamera(); }
  /** Dünya noktasını ekrana taşı (yakınlaşmış görüntüler için). */
  function odakla(wx, wy, k2) { const { s, cx, cy, W, H: Hh } = H.kam0; H.k = k2; H.tx = W / 2 - cx - wx * s * k2; H.ty = Hh * .45 - cy - wy * s * k2; kamera(); }

  // ---------- kare ----------
  function sol(k, kd, gizli) {
    const ad = k.tip === 'agent' ? 'agent' : kisa(k.ad);
    if (gizli) return { tam: `<tspan class="ad">${ad}</tspan>`, kisa: ad, enKisa: ad };
    const d = KISI_DURUM_AD[kd.durum] + (kd.gecGun ? ` · ${kd.gecGun}g geç` : '');
    const ek = kd.acik.length > 1 ? ` +${kd.acik.length - 1}` : '';
    return { tam: `<tspan class="ad">${ad}</tspan> · <tspan class="d${['engel', 'ai_hata'].includes(kd.durum) || kd.gecGun ? ' alarm' : ''}">${d}</tspan><tspan class="arti">${ek}</tspan>`,
      kisa: `<tspan class="d${['engel', 'ai_hata'].includes(kd.durum) || kd.gecGun ? ' alarm' : ''}">${d}</tspan><tspan class="arti">${ek}</tspan>`,
      enKisa: `<tspan class="d${['engel', 'ai_hata'].includes(kd.durum) || kd.gecGun ? ' alarm' : ''}">${KISI_DURUM_AD[kd.durum]}</tspan>` };
  }
  function sag(k, kd, an, gizli) {
    if (gizli || kd.no == null || kd.durum === 'bitti') return [''];
    const a = H.M.byNo[kd.no]; const ad = (a.kisa_ad || a.ad);
    const kes = (x, n) => (x.length > n ? x.slice(0, n - 1) + '…' : x);
    if (kd.durum === 'bekliyor' && kd.tutan != null) { const son = `<tspan class="sonk">⟵ ${kd.tutan}</tspan>`; return [`${a.no} ${kes(ad, 16)} ${son}`, `${a.no} ${kes(ad, 10)} ${son}`, `${a.no} ${son}`, '']; }
    if (kd.durum === 'engel' && a.engel_kisa) return [`${a.no} <tspan class="alarm">${kes(a.engel_kisa, 20)}</tspan>`, `${a.no} <tspan class="alarm">${kes(a.engel_kisa, 11)}</tspan>`, `${a.no} <tspan class="alarm">takıldı</tspan>`, ''];
    return [`${a.no} ${kes(ad, 18)}`, `${a.no} ${kes(ad, 11)}`, `${a.no} ${kes(ad, 7)}`, `${a.no}`, ''];
  }
  /** Tarih sütunu: bitiş (sürüyor/sırası geldi), ~ tahmini başlangıç (bekliyor/gelecek), kırmızı "Ng geç". */
  function tarih(kd, an, gizli) {
    if (gizli || kd.no == null || kd.durum === 'bitti') return { y: '', c: '' };
    const a = H.M.byNo[kd.no];
    if (kd.gecGun) return { y: `${kd.gecGun}g geç`, c: 'alarm' };
    if (['bekliyor', 'gelecek', 'ai_rutinsiz'].includes(kd.durum)) { const t = a.tHazirP ?? a.tRunP ?? a.tPlan; return { y: t ? '~' + tarihKisa(Math.max(t, an), an) : '?', c: 'tahmin' }; }
    return { y: a.tPlan ? tarihKisa(a.tPlan, an) : '?', c: '' };
  }
  // yazı yörüngenin tepesindeki şeritten taşmaz: sığan ilk biçim seçilir (sabit taban ölçüsünde; zoomda yazı küçülür, yer açılır)
  function sigdirYazi(tp, secenek, max) {
    const ik = parseFloat(H.svg.style.getPropertyValue('--ik')) || 1;
    if (max <= 0) { tp.innerHTML = ''; return; }
    for (const x of secenek.filter((y) => y != null)) { tp.innerHTML = x; let L = 0; try { L = tp.parentNode.getComputedTextLength(); } catch (e) { L = 0; } if (L <= max) return; }
  }
  const agRenk = (no) => { const a = H.M.byNo[no]; return a && a.sahip_tip === 'agent' && H.M.kisi[a.sahip] ? H.M.kisi[a.sahip].renk : null; };
  /** Yakın plan (kd2) ayrıntısı: ilerleme ve bitiş, tutan iş, kalan süre, engel nedeni. */
  function ayrinti(k, kd, an, ilerleme) {
    const a = kd.no != null ? H.M.byNo[kd.no] : null; if (!a) return '';
    const kes = (x, n) => (x.length > n ? x.slice(0, n - 1) + '…' : x);
    const t = (x) => (x ? tarihKisa(x, an) : '?');
    switch (kd.durum) {
      case 'calisiyor': case 'ai_calisiyor': return `${a.no} · %${Math.round((ilerleme || 0) * 100)} · ${t(a.tPlan)}`;
      case 'bekliyor': return kd.tutan != null ? `${a.no} ⟵ ${kd.tutan} ${String(H.M.byNo[kd.tutan].sahip).replace(/['’].*$/, '')}` : `${a.no}`;
      case 'gelecek': return `${a.no} · ~${t(a.tHazirP ?? a.tRunP ?? a.tPlan)}`;
      case 'engel': return `${a.no} · ${kes(a.engel_kisa || 'takıldı', 16)}`;
      case 'ai_hata': return `${a.no} · ${k.sahibi} bakmalı`;
      case 'ai_onay': return `${a.no} · onay: ${k.sahibi}`;
      case 'ai_rutinsiz': return `${a.no} · rutini ${k.sahibi} kurar`;
      case 'ai_sirada': return `${a.no} · rutin sırada`;
      case 'sira': case 'karar': return `${a.no} · ${t(a.tPlan)}`;
      default: return '';
    }
  }
  function guncelle(an, D) {
    const { M, P, A, R } = H;
    H.an = an; H.D = D;
    olcek(an);
    // 1) gezegen açıları
    const halkaItem = new Map(R.map((h) => [h, []]));
    for (const no in P) {
      const p = P[no], a = p.a, s = D.S[no], h = p.h;
      const bitik = ['lit', 'ghost', 'ertele', 'tahmin'].includes(s.g);
      let t, transit = false;
      const base = H.OB * (H.ku || 1) * (a.ust_adim ? .8 : 1) * (a.altlar.length ? 1.12 : 1) * (h.k.tip === 'agent' ? .78 : 1);
      let boy = bitik ? base * .58 : base;
      if (a.tarihsiz) t = AF + .1 * H.ek;
      else if (bitik) {
        const dt = an - a.tPlan;
        if (dt < GECIS) { transit = true; t = lerp(h.dockR, Math.min(aci(a.tPlan - an), -h.dockL), Math.max(0, dt) / GECIS); boy = lerp(base, base * .58, sstep(dt / GECIS)); }
        else t = Math.min(aci(a.tPlan - an), -h.dockL);
      } else t = Math.max(aci((a.tPlan ?? an) - an), h.dockR);
      p.t0 = a.tarihsiz ? t : aci((a.tPlan ?? an) - an); p.t = t; p.transit = transit; p.boy = boy;
      // yerel bant: komşu yörüngelere uzaklık; gezegen bandı aşmaz
      const q = nokta(h, t), qi = h.ic ? nokta(h.ic, t) : null, qo = nokta(h.dis, t);
      const gap = Math.min(qi ? Math.hypot(q[0] - qi[0], q[1] - qi[1]) : 99, Math.hypot(q[0] - qo[0], q[1] - qo[1]));
      p.boy = Math.min(p.boy, gap * .46 / 8);
      if (!transit) halkaItem.get(h).push(p);
    }
    // 2) çakışma süpürmesi (her yörüngede, sürekli: max/min bileşimi)
    for (const [h, list] of halkaItem) {
      const ileri = list.filter((p) => p.t >= 0).sort((x, y) => x.t - y.t || x.a.no - y.a.no);
      let pt = h.dockR, pr = 0;
      ileri.forEach((p, j) => { const r = 9.6 * p.boy; const min = j ? pt + (pr + r + 5) / hiz(h, pt) : h.dockR + Math.max(0, r - 9.6) / h.rx; p.t = Math.max(p.t, min); pt = p.t; pr = r; });
      const geri = list.filter((p) => p.t < 0).sort((x, y) => y.t - x.t || x.a.no - y.a.no);
      pt = -h.dockL; pr = 0;
      geri.forEach((p, j) => { const r = 9.6 * p.boy; const min = j ? pt - (pr + r + 2) / hiz(h, pt) : -h.dockL - Math.max(0, r - 9.6) / h.rx; p.t = Math.min(p.t, min); pt = p.t; pr = r; });
      // geçmiş kümesi: çok eski bitmiş işler solup ✓n kümesine katılır (opaklık sürekli)
      let n = 0; geri.forEach((p) => { p.op = sstep((p.t + AP + .02 * H.ek) / (.16 * H.ek)); if (p.op < .5) n++; });
      ileri.forEach((p) => { p.op = 1 - sstep((p.t - AF - .02 * H.ek) / (.14 * H.ek)); });
      const kt = h.kume.querySelector('.kume-t'); const ky = n ? '✓' + n : '';
      if (kt.textContent !== ky) kt.textContent = ky; h.kume.style.opacity = n ? 1 : 0;
    }
    // 2b) yakın plan adları: aynı yörüngede komşusuna binecek ad susar (yakınlaşma ölçeği 2,4 referans; zoom'da hesap yok)
    { const ik2 = Math.pow(2.4, -.6), byH = new Map();
      for (const no in P) { const p = P[no]; if (!byH.has(p.h)) byH.set(p.h, []); byH.get(p.h).push(p); }
      for (const [h, L] of byH) { L.sort((a, b) => a.t - b.t); L.forEach((p, j) => { p.sikis = false; if (!j) return; const q = L[j - 1], w = (Math.min(14, (p.a.kisa_ad || p.a.ad).length) + Math.min(14, (q.a.kisa_ad || q.a.ad).length)) * 5.6 * ik2 / 2 + 4; const [x1, y1] = nokta(h, q.t), [x2, y2] = nokta(h, p.t); if (Math.hypot(x2 - x1, y2 - y1) < w && H.sec !== p.a.no) p.sikis = true; }); } }
    // 3) DOM öznitelikleri
    for (const no in P) {
      const p = P[no], a = p.a, s = D.S[no], h = p.h;
      const [x, y] = nokta(h, p.t); p.x = x; p.y = y;
      p.g.setAttribute('transform', `translate(${f(x)},${f(y)}) scale(${f(p.boy)})`);
      p.g.style.opacity = p.transit ? .9 : (p.op ?? 1);
      const sinif = 'gz g-' + s.g + (a.tSon != null && an > a.tSon && !['lit', 'ghost', 'ertele', 'tahmin'].includes(s.g) ? ' gec' : '') + (M.kritik.has(a.no) ? ' kritik' : '') + (H.sec === a.no ? ' secili' : '') + (p.ilgili ? ' ilgili' : '') + (p.v ? ' v' : '') + (p.sikis ? ' sikis' : '');
      if (sinif !== p.sinif) { p.g.setAttribute('class', sinif); p.sinif = sinif; p.g.dataset.g = s.g; }
      p.ates.setAttribute('r', f(7.4 * Math.sqrt(s.isik)));
      p.uydular.forEach((u) => { const b = D.S[u.dataset.alt]; const d = b && ['lit', 'ghost', 'ertele', 'tahmin'].includes(b.g); if (u.classList.contains('dolu') !== d) u.classList.toggle('dolu', d); });
      // gecikme kuyruğu: son tarihten iğneye ve gezegene kırmızı yay (tek alarm)
      if (p.kuyruk) {
        const gec = an > a.tSon && !['lit', 'ghost', 'ertele', 'tahmin'].includes(s.g);
        if (gec) { const t0 = Math.max(aci(a.tSon - an), -AP); p.kuyruk.setAttribute('d', yay(h, t0, p.t - 8 * p.boy / hiz(h, p.t))); p.kuyruk.style.display = ''; } else p.kuyruk.style.display = 'none';
      }
      // zaman çentiği: gezegen iğneden ötürü itildiyse gerçek anı ince bir çizgiyle işaretlenir
      const itik = Math.abs(p.t - p.t0) * hiz(h, p.t0) > 9 && !p.transit && p.t0 > -h.dockL && p.t0 < AF;
      if (itik) { const [x1, y1] = nokta(h, p.t0, -4), [x2, y2] = nokta(h, p.t0, 4); p.cent.setAttribute('x1', f(x1)); p.cent.setAttribute('y1', f(y1)); p.cent.setAttribute('x2', f(x2)); p.cent.setAttribute('y2', f(y2)); p.cent.setAttribute('opacity', .7); }
      else p.cent.setAttribute('opacity', 0);
      (p.paylar || []).forEach((y2) => { const [px, py] = nokta(y2.h, p.t); y2.x = px; y2.y = py; y2.g.setAttribute('transform', `translate(${f(px)},${f(py)}) scale(${f(Math.min(1, p.boy))})`); y2.kopru.setAttribute('x1', f(x)); y2.kopru.setAttribute('y1', f(y)); y2.kopru.setAttribute('x2', f(px)); y2.kopru.setAttribute('y2', f(py)); y2.g.style.opacity = p.g.style.opacity; y2.kopru.style.opacity = .7 * p.g.style.opacity; });
    }
    // 4) araçlar ve şeritler
    for (const ad in A) {
      const v = A[ad], k = v.k, kd = D.K[ad], h = v.h;
      const gizli = H.disBakan && ad !== M.bakan;
      const p = kd.no != null ? P[kd.no] : null;
      let ilerleme = null;
      if (p && ['calisiyor', 'ai_calisiyor'].includes(kd.durum)) { const s = D.S[kd.no]; ilerleme = Math.max(0, (s.isik - .2) / .55); }
      const ayr = gizli ? '' : ayrinti(k, kd, an, ilerleme);
      const an2 = `${ayr}|${kd.durum}|${(kd.hamleler || []).map((x) => x.tur + x.no).join(',')}|${kd.gun}|${gizli}|${ilerleme == null ? '' : Math.round(ilerleme * 24)}|${(kd.rutinsiz || []).length}`;
      if (an2 !== v.anahtar) {
        const r = arac(k, kd, { ben: ad === M.bakan, renkOf: (x) => (M.kisi[x] || k).renk, agRenk, ilerleme, gizli, ayrinti: ayr, yeniHamle: H.o.yeniHamle });
        v.ol.innerHTML = r.svg; v.anahtar = an2; v.g.dataset.kd = gizli ? 'gizli' : kd.durum;
        v.g.dataset.h = (kd.hamleler || []).map((x) => x.tur).join(' ');
      }
      if (v.kenet) { // kenet: sahibine bu agent'ın işinden hamle düştüyse aktif, rutin yoksa kopuk
        const sahipKd = D.K[k.sahibi]; const akt = sahipKd && (sahipKd.hamleler || []).some((x) => k.kendi.includes(x.no));
        const dz = gizli ? 'gizli' : akt ? 'aktif' : (kd.durum === 'ai_rutinsiz' || (kd.rutinsiz || []).length) ? 'kopuk' : 'pasif';
        if (dz !== v.kenet.durum) { v.kenet.durum = dz; v.kenet.g.innerHTML = dz === 'gizli' ? '' : kenet(v.kenet.y1, v.kenet.y2, M.kisi[k.sahibi].renk, dz); v.kenet.g.setAttribute('class', 'kenet ' + dz); v.kenet.g.dataset.ag = ad; }
      }
      const s1 = sol(k, kd, gizli);
      if (s1.tam !== v.solYazi) { v.solYazi = s1.tam; sigdirYazi(v.tL, [s1.tam, s1.kisa, s1.enKisa], v.sLmax); }
      const tz = tarih(kd, an, gizli), tk = tz.y + '|' + tz.c;
      if (tk !== v.tarihYazi && v.tT) { v.tT.textContent = tz.y; v.tT.setAttribute('class', 'tarih-k ' + tz.c + (k.tip === 'agent' ? ' ag' : '')); v.tarihYazi = tk; try { v.tW = tz.y ? v.tT.getComputedTextLength() : 0; } catch (e) { v.tW = 0; } }
      if (v.tT && v.tW) {
        // tarih bir gezegenin üstüne düşerse sütundan iğneye doğru gezegenin önüne kayar (çakışma yok)
        let tc = v.tc0; const vh = v.h, o2 = v.tOff, sw = hiz(vh, tc), wA = (v.tW + 4) / sw;
        for (let it = 0; it < 6; it++) {
          let carp = null;
          for (const no in P) { const p = P[no]; if (p.gizli || p.x == null) continue; const rp = 8.6 * p.boy + 5;
            for (const u of [0, .5, 1]) { const [qx, qy] = nokta(vh, tc - wA * u, o2 - 3); if (Math.hypot(qx - p.x, qy - p.y) < rp + 5) { carp = p; break; } } if (carp) break; }
          if (!carp) break;
          const pa = Math.atan2(carp.x / (vh.rx + o2), (vh.cy - carp.y) / (vh.ry + o2)); tc = Math.min(tc, pa) - (8.6 * carp.boy + 8) / sw;
        }
        const yer = f(tc);
        if (yer !== v.tarihYer) { v.tarihYer = yer; const [x0, y0] = nokta(vh, tc, o2), tn = Math.atan2(vh.ry * Math.sin(tc), vh.rx * Math.cos(tc)) / RAD; v.tT.setAttribute('transform', `translate(${f(x0)},${f(y0)}) rotate(${f(tn)})`); }
        const izin = yayBoy(vh, 0, Math.max(0, tc - wA), o2) - v.sR0 - 8, yok = izin < 44; // yer kalmadıysa tarih susar, ad tam kalır (kart ve yakınlaşma tarihi verir)
        const mx = v.sRfull <= 0 ? 0 : Math.min(170, yok ? v.sRfull : izin);
        if (Math.abs(mx - (v.sRmax || 0)) > 1) { v.sRmax = mx; v.sagYazi = ''; }
        v.tT.style.display = yok ? 'none' : '';
      } else if (v.tT && v.sRmax !== Math.min(170, v.sRfull)) { v.sRmax = v.sRfull <= 0 ? 0 : Math.min(170, v.sRfull); v.sagYazi = ''; }
      { // büyük gezegen yazı şeridine değer (U6): sağ yazı, yörüngedeki ilk gezegenin önünde biter; yer yoksa susar
        let mx = v.sRmax || 0;
        for (const no in P) { const p = P[no]; if (p.h !== v.h || p.gizli || p.t <= 0 || p.t > 1.6 || 9.6 * p.boy < v.tOff - 3) continue;
          const izin = yayBoy(v.h, 0, p.t, v.tOff) - v.sR0 - 9.6 * p.boy - 6; mx = Math.min(mx, izin < 34 ? 0 : izin); }
        mx = Math.round(mx / 6) * 6;
        if (mx !== v.sRgz) { v.sRgz = mx; v.sagYazi = ''; }
      }
      const s2 = sag(k, kd, an, gizli);
      const s2k = s2.join('|');
      if (s2k !== v.sagYazi) { v.sagYazi = s2k; sigdirYazi(v.tR, s2, Math.min(v.sRmax || 0, v.sRgz ?? 999)); }
      // rota: araçtan şu anki / sıradaki işine yörünge boyunca yay (uzaklık = ne kadar zaman var)
      if (p && p.h === h && !gizli && kd.durum !== 'bitti' && p.t > 0) { v.rota.setAttribute('d', yay(h, h.dockR * .55, Math.max(h.dockR * .55, p.t - 8 * p.boy / hiz(h, p.t)))); v.rota.style.display = ''; v.rota.setAttribute('stroke-dasharray', ['bekliyor', 'gelecek', 'ai_sirada', 'ai_rutinsiz'].includes(kd.durum) ? '2 4' : ''); }
      else v.rota.style.display = 'none';
    }
    // 5) zaman öğeleri
    const S0 = H.sinir;
    const g0 = H.M.aralik[0], jB = Math.round((gunBasi(an) - g0) / GUN), jS = Math.min(H.gunler.length - 1, Math.round((H.M.aralik[1] - g0) / GUN));
    H.gunler.forEach((c, j) => {
      const gun = g0 + j * GUN, t = aci(gun - an);
      if (j > jS) { c.g.style.display = 'none'; return; }
      c.g.style.display = '';
      const [x, y] = nokta(S0, t, 2);
      c.g.setAttribute('transform', `translate(${f(x)},${f(y)}) rotate(${f(t / RAD)})`);
      // aralık daralınca yazı söner (sürekli): iki gün arası < 22 px
      const ara = Math.abs(aci(gun + GUN - an) - t) * hiz(S0, t);
      const d = new Date(gun + TSI); const yz = d.getUTCDate() === 1 || j === jB || j === 0 || j === jS ? gunAy(gun + 6 * SA) : String(d.getUTCDate());
      if (c.gun !== gun || c.jB !== jB) { c.t.textContent = yz; c.gun = gun; const dd = d.getUTCDate(), son = new Date(gun + GUN + TSI).getUTCDate() === 1; c.g.setAttribute('class', 'gun-c' + (j !== 0 && j !== jS && ((dd % 2 && dd !== 1) || dd === 2 || son || j === jB - 1 || j === jB + 1) ? ' seyrek' : '') + (j === jB ? ' bugun-g' : '') + (j === 0 || j === jS ? ' uc' : '')); c.jB = jB; }
      const uc = j === 0 || j === jS, hafta = new Date(gun + TSI).getUTCDay() === 1;
      c.t.style.opacity = uc ? 1 : sstep((ara - 14) / 12) * (yz.length > 2 ? 1 : .9);
      c.g.firstChild.style.opacity = uc || hafta ? 1 : sstep((ara - 2.5) / 3) * .8; // sıkışan günlerde yalnız hafta başları kalır
    });
    // son bakış dilimi
    const sb = H.o.sonBakis;
    if (sb != null && !H.disBakanGizle) {
      const t1 = Math.max(-AP, Math.min(AF, aci(sb - an)));
      const ic = { rx: H.geo.rxIn - 10, ry: H.geo.ryIn - 10, cy: 0 };
      const a1 = Math.min(t1, 0), a2 = Math.max(t1, 0);
      if (a2 - a1 > .002) {
        const d = yay(S0, a1, a2) + yay(ic, a2, a1).replace('M', 'L') + 'Z';
        H.dilim.setAttribute('d', d); H.dilim.style.display = '';
        const [x1, y1] = nokta(ic, t1), [x2, y2] = nokta(S0, t1);
        H.dilimKenar.setAttribute('d', `M${f(x1)},${f(y1)}L${f(x2)},${f(y2)}`); H.dilimKenar.style.display = '';
        const [tx, ty] = nokta(S0, t1, H.geo.acilis ? -16 : 27); H.dilimYazi.setAttribute('x', f(tx)); H.dilimYazi.setAttribute('y', f(ty)); H.dilimYazi.style.display = '';
        H.dilimYazi.setAttribute('text-anchor', t1 < 0 ? 'end' : 'start');
      } else { H.dilim.style.display = 'none'; H.dilimKenar.style.display = 'none'; H.dilimYazi.style.display = 'none'; }
    }
    // hedef çizgisi: her yörüngede hedef anına denk gelen noktalardan geçen eğri
    if (H.M.hedef) {
      const th = aci(H.M.hedef - an);
      if (th > -AP && th < AF + .1 * H.ek) {
        let d = ''; const n = 24;
        const ic = { rx: H.cr * 1.05, ry: H.cr * 1.05, cy: 0 };
        for (let j = 0; j <= n; j++) { const u = j / n; const e = { rx: lerp(ic.rx, S0.rx, u), ry: lerp(ic.ry, S0.ry, u), cy: lerp(0, S0.cy, u) }; const [x, y] = nokta(e, th); d += (j ? 'L' : 'M') + f(x) + ',' + f(y); }
        H.hedefYol.setAttribute('d', d); H.hedefYol.style.display = '';
        const [bx, by] = nokta(S0, th, 6);
        const sagda = Math.sin(th) >= 0;
        H.hedefBayrak.setAttribute('transform', `translate(${f(Math.max(-S0.rx - 20, Math.min(S0.rx - 50, bx + (sagda ? -30 : -30))))},${f(by + 16)})`); H.hedefBayrak.style.display = '';
        const bt = H.hedefBayrak.querySelector('text'), yz = (H.M.hedefsiz ? 'ufuk ' : 'hedef ') + gunAy(H.M.hedef);
        if (bt.textContent !== yz) bt.textContent = yz;
      } else { H.hedefYol.style.display = 'none'; H.hedefBayrak.style.display = 'none'; }
    }
    // gerçek "bugün" (sürgü başka andayken)
    const tb = aci(M.simdi - an);
    if (Math.abs(M.simdi - an) > 30 * 60e3 && tb > -AP && tb < AF) { const [x, y] = nokta(S0, tb, 4); H.bugunIsaret.setAttribute('transform', `translate(${f(x)},${f(y)}) rotate(${f(tb / RAD)})`); H.bugunIsaret.style.display = ''; }
    else H.bugunIsaret.style.display = 'none';
    // çekirdek
    const kalan = H.M.hedef ? (H.M.hedef - an) / GUN : null;
    const c1 = H.M.hedef ? gunAy(H.M.hedef) : '—';
    const c2 = kalan == null ? '' : kalan >= 1 ? `${Math.floor(kalan)} gün kaldı` : kalan >= 0 ? `${Math.max(1, Math.round(kalan * 24))} saat kaldı` : `${Math.ceil(-kalan)} gün geçti`;
    const ar = H.M.A.bitis && H.M.A.bitis.aralik; const c3 = ar ? `en geç ${gunAy(ms(ar[1]))}` : '';
    const ckT = H.ck.querySelectorAll('text');
    if (ckT[0].textContent !== c1) ckT[0].textContent = c1;
    if (ckT[1].textContent !== c2) { ckT[1].textContent = c2; ckT[1].classList.toggle('alarm', kalan != null && kalan < 0); }
    if (ckT[2].textContent !== c3) ckT[2].textContent = c3;
    const it = H.ig.querySelector('.igne-t'), iy = anYaz(an);
    if (it.textContent !== iy) it.textContent = iy;
    // 6) seçim, kritik yol, vurgu
    bagCiz();
    if (H.vurgu) vurguUygula();
  }

  // ---------- bağımlılık dili ----------
  function egri(x1, y1, x2, y2, cek = .3) {
    // iki gezegen arası kiriş: merkeze doğru bükülür (yörünge çizgilerini dik keser, hiçbir yörüngeye paralel uzanmaz)
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const oy = H.geo.cOut * .35;
    const cx = mx + (0 - mx) * cek, cy = my + (oy - my) * cek;
    return `M${f(x1)},${f(y1)} Q${f(cx)},${f(cy)} ${f(x2)},${f(y2)}`;
  }
  function kenar(p, q) { const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, r = 8 * p.boy + 2.5; return [p.x + dx / L * r, p.y + dy / L * r]; }
  // köprü (D): tutan işten bekleyene, zamanın akış yönünde (yörünge teğetinden çıkıp teğetle girer), ok bekleyende, rengi tutan kişinin
  function teget(p) { const t = p.t; const vx = p.h.rx * Math.cos(t), vy = p.h.ry * Math.sin(t), L = Math.hypot(vx, vy) || 1; return [vx / L, vy / L]; }
  function kopruYol(p, q) {
    const [ax, ay] = teget(p), [bx, by] = teget(q);
    const L = Math.hypot(q.x - p.x, q.y - p.y) || 1, ux = (q.x - p.x) / L, uy = (q.y - p.y) / L;
    // teğet kordayla aynı yöne bakmıyorsa kol kısalır: ilmek ve zikzak olmaz
    const k1 = Math.min(.4 * L, 120) * Math.max(.12, ax * ux + ay * uy), k2 = Math.min(.4 * L, 120) * Math.max(.12, bx * ux + by * uy);
    const r1 = 8 * p.boy + 2, r2 = 8 * q.boy + 4;
    const x1 = p.x + ux * r1, y1 = p.y + uy * r1, x2 = q.x - (bx * .5 + ux * .5) * r2, y2 = q.y - (by * .5 + uy * .5) * r2;
    return `M${f(x1)},${f(y1)} C${f(x1 + ax * k1)},${f(y1 + ay * k1)} ${f(x2 - bx * k2)},${f(y2 - by * k2)} ${f(x2)},${f(y2)}`;
  }
  const BITIK = ['lit', 'ghost', 'ertele', 'tahmin'];
  function bagCiz() {
    const { P, M } = H;
    // kritik yol: açık kritik işler zaman sırasıyla, akış yönünde yumuşak ray (geri dönüş yok, zikzak yok)
    const kr = H.kritik || (H.sec != null && M.kritik.has(H.sec));
    if (kr) {
      const seri = M.kritikSira.filter((n) => P[n] && !['lit', 'ghost', 'ertele'].includes(H.D.S[n].g)).map((n) => P[n]).sort((a, b) => a.t - b.t); // açıya (zamana) göre: ray yalnız saat yönünde ilerler, geri dönmez
      let d = '';
      // ray metro hattı gibi: önceki işin yörüngesinde zamanla ilerler, sonra sıradaki işin yörüngesine kısa ve yumuşak bir geçişle atlar
      seri.forEach((q, j) => {
        if (!j) { d = `M${f(q.x)},${f(q.y)}`; return; }
        const p = seri[j - 1], h = p.h, [rx0, ry0] = nokta(q.h, q.t), [rx1, ry1] = nokta(h, q.t), gec = (Math.hypot(rx1 - rx0, ry1 - ry0) * .9 + 10) / hiz(h, p.t);
        const tA = Math.max(p.t, q.t - gec), n = Math.max(1, Math.ceil(Math.abs(tA - p.t) * hiz(h, p.t) / 8));
        for (let i = 1; i <= n; i++) { const [x, y] = nokta(h, lerp(p.t, tA, i / n)); d += `L${f(x)},${f(y)}`; }
        const [cx2, cy2] = nokta(q.h, tA); // kontrol noktası: sıradaki yörüngede aynı açı → önce yörüngeler arası geçiş, sonra yörünge boyunca varış
        d += `Q${f(cx2)},${f(cy2)} ${f(q.x)},${f(q.y)}`;
      });
      H.kritikYol.querySelectorAll('path').forEach((x) => x.setAttribute('d', d)); H.kritikYol.style.display = '';
    } else H.kritikYol.style.display = 'none';
    const parca = [];
    const kopru = (from, to, cls) => { const p = P[from], q = P[to]; if (!p || !q) return; const bitti = BITIK.includes(H.D.S[from].g); parca.push(`<path class="kopru ${cls}${bitti ? ' bitti' : ''}" d="${kopruYol(p, q)}" stroke="${p.h.k.renk}" marker-end="url(#ky-ok)"/>`); };
    if (H.sec != null && P[H.sec]) {
      const a = P[H.sec].a;
      (a.bagimli || []).forEach((n) => kopru(n, a.no, 'gelen'));
      (a.bekleyenler || []).forEach((n) => kopru(a.no, n, 'giden'));
      const ust = a.ust_adim && P[a.ust_adim] ? [P[a.ust_adim]] : []; const alt = a.altlar.filter((n) => P[n]).map((n) => P[n]); const p = P[H.sec];
      [...ust, ...alt].forEach((q) => parca.push(`<path d="M${f(p.x)},${f(p.y)} L${f(q.x)},${f(q.y)}" stroke="#FFF6E0" stroke-width="1" stroke-dasharray="1 2.5" opacity=".8"/>`));
    } else {
      // varsayılan: yalnız bekleme köprüleri (bekleyen kişinin sıradaki işine, onu tutan işten); kişi seçiliyse yalnız onunki
      for (const ad in H.A) { if (H.secKisi && H.secKisi !== ad) continue; const kd = H.D.K[ad]; if (H.disBakan && ad !== M.bakan) continue; if (kd.durum === 'bekliyor' && kd.tutan != null && kd.no != null) kopru(kd.tutan, kd.no, 'bek'); }
    }
    const html = parca.join('');
    if (html !== H.secBag._son) { H.secBag.innerHTML = html; H.secBag._son = html; }
    H.bekSayi = parca.filter((x) => x.includes(' bek')).length;
  }
  function sec(no, kisi) {
    H.sec = no; H.secKisi = kisi || null;
    H.svg.classList.toggle('odak', no != null || !!kisi);
    const ilgili = new Set();
    if (no != null) { const a = H.M.byNo[no]; ilgili.add(no); (a.bagimli || []).forEach((n) => ilgili.add(n)); (a.bekleyenler || []).forEach((n) => ilgili.add(n)); a.altlar.forEach((n) => ilgili.add(n)); if (a.ust_adim) ilgili.add(a.ust_adim); }
    if (kisi) { H.M.kisi[kisi].adimlar.forEach((n) => ilgili.add(n)); const kd = H.D && H.D.K[kisi]; if (kd && kd.tutan) ilgili.add(kd.tutan); }
    for (const n in H.P) { H.P[n].ilgili = ilgili.has(+n); H.P[n].g.classList.toggle('ilgili', ilgili.has(+n)); (H.P[n].paylar || []).forEach((y) => y.g.classList.toggle('ilgili', ilgili.has(+n))); }
    for (const ad in H.A) H.A[ad].g.classList.toggle('sec', kisi === ad);
    for (const ad in H.A) H.A[ad].g.classList.toggle('ilgili', kisi === ad || (no != null && (H.M.byNo[no].sahip === ad || H.M.byNo[no].ortak.includes(ad))));
    H.P && Object.values(H.P).forEach((p) => (p.sinif = ''));
  }
  // lejant satırı → haritada ilgili öğeler öne
  function vurgu(anahtar) { H.vurgu = anahtar; H.svg.classList.toggle('vurgulu', !!anahtar); if (anahtar) vurguUygula(); else { H.svg.querySelectorAll('.v').forEach((e) => e.classList.remove('v')); Object.values(H.P).forEach((p) => (p.v = false)); } }
  function vurguUygula() {
    const [tur, deger] = H.vurgu.split(':');
    for (const n in H.P) { const p = H.P[n]; let v = false; const s = H.D.S[n];
      if (tur === 'g') v = s.g === deger; else if (tur === 'kritik') v = H.M.kritik.has(+n); else if (tur === 'darbogaz') v = H.M.darbogaz === +n; else if (tur === 'gec') v = p.g.classList.contains('gec');
      else if (tur === 'ortak') v = p.a.ortak.length > 0; else if (tur === 'alt') v = p.a.altlar.length > 0 || !!p.a.ust_adim; else if (tur === 'yeni') v = !!(H.o.yeni && H.o.yeni[n]); else if (tur === 'rutin') v = p.a.rutin_var === false; else if (tur === 'karar') v = !!p.a.karar_adimi; else if (tur === 'ben') v = !!(H.D.H[n] && H.D.H[n].kim === H.M.bakan);
      else if (tur === 'kopru') v = Object.values(H.D.K).some((x) => x.durum === 'bekliyor' && (x.tutan === +n || x.no === +n));
      else if (tur === 'kenet') v = !!(H.D.H[n] && H.M.byNo[n].sahip_tip === 'agent');
      else if (tur === 'h') v = !!(H.D.H[n] && H.D.H[n].tur === deger); else if (tur === 'tip') v = p.h.k.tip === deger;
      else if (tur === 'nos') v = deger.split(',').includes(String(n));
      else if (tur === 'kisi') { const sa = H.M.kisi[p.a.sahip]; v = p.a.sahip === deger || (sa && sa.sahibi === deger) || (p.a.ortak || []).includes(deger) || !!(H.D.H[n] && H.D.H[n].kim === deger); }
      p.v = v; p.g.classList.toggle('v', v); }
    for (const ad in H.A) { const kd = H.D.K[ad]; const k = H.A[ad].k; let v = false;
      const ag = k.tip === 'agent' ? H.A[ad] : Object.values(H.A).find((x) => x.k.tip === 'agent' && x.k.sahibi === ad);
      if (tur === 'ben') v = ad === H.M.bakan; else if (tur === 'kenet') v = !!(ag && ag.kenet && ag.kenet.durum === deger); else if (tur === 'kopru') v = kd.durum === 'bekliyor';
      else if (tur === 'gec' ) v = !!kd.gecGun;
      else if (tur === 'kisi') v = ad === deger || k.sahibi === deger;
      else if (tur === 'kd') v = kd.durum === deger; else if (tur === 'h') v = (kd.hamleler || []).some((x) => x.tur === deger); else if (tur === 'tip') v = k.tip === deger; else if (tur === 'rutin') v = (kd.rutinsiz || []).length > 0;
      H.A[ad].g.classList.toggle('v', v); }
  }


  return { kur, guncelle, sigdir, tamGorunum, kamera, hedefTam, zoomAt, kaydir, odakla, sec, vurgu, aci, nokta, get H() { return H; }, get zoom() { return H ? H.zk : 1; } };
}
