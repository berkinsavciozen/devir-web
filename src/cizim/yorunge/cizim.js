// Kişi Yörüngeleri · çizim parçaları (13 Kas, sentez): araç, gezegen, hamle düğmesi, kenet. Prototipten taşındı.
// Dil: gövde = kişi (siluet türü, dolgu kişinin rengi) · pencere ve ışık = durum (beş sabit renk) · yuvarlak düğme = hamle.
import { ALARM, ISIK, MUREKKEP } from './model.js';
export const f = (n) => Math.round(n * 100) / 100;
export const ZEMIN = '#0B2231';

// ---- simgeler (hamle düğmesiyle aynı sözlük: ! bitir, ? karar, göz onayla, şimşek engel, kıvılcım kur) ----
export const SIMGE = {
  unlem: (s, c) => `<rect x="${f(-.8 * s)}" y="${f(-3.3 * s)}" width="${f(1.6 * s)}" height="${f(4.1 * s)}" rx="${f(.75 * s)}" fill="${c}"/><circle cy="${f(2.5 * s)}" r="${f(.9 * s)}" fill="${c}"/>`,
  soru: (s, c) => `<path d="M${f(-1.7 * s)},${f(-1.4 * s)} Q${f(-1.7 * s)},${f(-3.3 * s)} 0,${f(-3.3 * s)} Q${f(1.9 * s)},${f(-3.3 * s)} ${f(1.9 * s)},${f(-1.6 * s)} Q${f(1.9 * s)},${f(-.4 * s)} ${f(.4 * s)},${f(.2 * s)} Q0,${f(.4 * s)} 0,${f(1.2 * s)}" fill="none" stroke="${c}" stroke-width="${f(1.25 * s)}" stroke-linecap="round"/><circle cy="${f(2.6 * s)}" r="${f(.8 * s)}" fill="${c}"/>`,
  goz: (s, c) => `<path d="M${f(-3.2 * s)},0 Q0,${f(-2.8 * s)} ${f(3.2 * s)},0 Q0,${f(2.8 * s)} ${f(-3.2 * s)},0Z" fill="none" stroke="${c}" stroke-width="${f(.95 * s)}"/><circle r="${f(1.15 * s)}" fill="${c}"/>`,
  simsek: (s, c) => `<path d="M${f(.6 * s)},${f(-3.5 * s)} L${f(-1.9 * s)},${f(.4 * s)} L${f(.1 * s)},${f(.4 * s)} L${f(-.7 * s)},${f(3.5 * s)} L${f(2 * s)},${f(-.6 * s)} L0,${f(-.6 * s)}Z" fill="${c}"/>`,
  kivilcim: (s, c) => `<path d="M0,${f(-3.5 * s)} Q${f(.5 * s)},${f(-.5 * s)} ${f(3.5 * s)},0 Q${f(.5 * s)},${f(.5 * s)} 0,${f(3.5 * s)} Q${f(-.5 * s)},${f(.5 * s)} ${f(-3.5 * s)},0 Q${f(-.5 * s)},${f(-.5 * s)} 0,${f(-3.5 * s)}Z" fill="${c}"/>`,
  tik: (s, c) => `<path d="M${f(-2.3 * s)},${f(.1 * s)} L${f(-.6 * s)},${f(1.9 * s)} L${f(2.5 * s)},${f(-1.9 * s)}" fill="none" stroke="${c}" stroke-width="${f(1.3 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`,
  // fişi çekik kablo: rutin yok (AI yapsın açık ama rutin kurulmamış; kendiliğinden başlamaz). Gezegende ve agent'ta aynı biçim.
  kablo: (s, c) => `<path d="M${f(-3.4 * s)},${f(-3 * s)} C${f(-3.4 * s)},${f(1 * s)} ${f(.6 * s)},${f(-1 * s)} ${f(.6 * s)},${f(2 * s)}" fill="none" stroke="${c}" stroke-width="${f(.9 * s)}" stroke-linecap="round"/><rect x="${f(-.8 * s)}" y="${f(2 * s)}" width="${f(2.8 * s)}" height="${f(1.9 * s)}" rx="${f(.4 * s)}" fill="${c}"/><path d="M${f(-.1 * s)},${f(3.9 * s)} V${f(5 * s)} M${f(1.3 * s)},${f(3.9 * s)} V${f(5 * s)}" stroke="${c}" stroke-width="${f(.6 * s)}" stroke-linecap="round"/>`,
  belge: (s, c) => `<path d="M${f(-2 * s)},${f(-2.6 * s)} H${f(.9 * s)} L${f(2 * s)},${f(-1.5 * s)} V${f(2.6 * s)} H${f(-2 * s)}Z" fill="${ZEMIN}" stroke="${c}" stroke-width="${f(.7 * s)}" stroke-linejoin="round"/><path d="M${f(-1 * s)},${f(-.4 * s)} H${f(1 * s)} M${f(-1 * s)},${f(1 * s)} H${f(1 * s)}" stroke="${c}" stroke-width="${f(.5 * s)}"/>`,
  terazi: (s, c) => `<path d="M0,${f(-2.6 * s)} V${f(2.4 * s)} M${f(-1.4 * s)},${f(2.4 * s)} H${f(1.4 * s)} M${f(-2.6 * s)},${f(-1.8 * s)} H${f(2.6 * s)}" stroke="${c}" stroke-width="${f(.6 * s)}" stroke-linecap="round"/><path d="M${f(-3.4 * s)},${f(.4 * s)} L${f(-2.6 * s)},${f(-1.8 * s)} L${f(-1.8 * s)},${f(.4 * s)}Z M${f(1.8 * s)},${f(.4 * s)} L${f(2.6 * s)},${f(-1.8 * s)} L${f(3.4 * s)},${f(.4 * s)}Z" fill="${c}"/>`,
  // karar (akış şemasındaki karar karosu): kişinin penceresinde ve karar adımının tepesinde aynı
  karo: (s, c) => `<path d="M0,${f(-3.4 * s)} L${f(3.4 * s)},0 L0,${f(3.4 * s)} L${f(-3.4 * s)},0Z" fill="none" stroke="${c}" stroke-width="${f(1.1 * s)}" stroke-linejoin="round"/><circle r="${f(1 * s)}" fill="${c}"/>`,
  catal: (s, c) => `<path d="M0,${f(2.4 * s)} V${f(.2 * s)} M0,${f(.2 * s)} L${f(-2 * s)},${f(-2.2 * s)} M0,${f(.2 * s)} L${f(2 * s)},${f(-2.2 * s)}" fill="none" stroke="${c}" stroke-width="${f(.9 * s)}" stroke-linecap="round"/><circle cx="${f(-2 * s)}" cy="${f(-2.4 * s)}" r="${f(.8 * s)}" fill="${c}"/><circle cx="${f(2 * s)}" cy="${f(-2.4 * s)}" r="${f(.8 * s)}" fill="${c}"/>`,
};
export const HAMLE_SIMGE = { bitir: 'unlem', karar: 'soru', onayla: 'goz', engel: 'simsek', kur: 'kivilcim' };

// ---- durum renkleri (sentez, 13 Kas): beş grup, kişide ve işte aynı ----
// Kural: gövde ve hat = KİM (kişi rengi) · pencere ışığı ve simge = DURUM (grup rengi) · yuvarlak düğme = HAMLE (yapacak kişinin rengi)
export const DR = { alarm: '#FF5A5A', eylem: '#FFB547', calisma: '#5AB8FF', bekleme: '#A9C3D6', bitti: '#6EE39A' };
export const GRUP = { engel: 'alarm', ai_hata: 'alarm', karar: 'eylem', sira: 'eylem', ai_onay: 'eylem', calisiyor: 'calisma', ai_calisiyor: 'calisma',
  bekliyor: 'bekleme', ai_sirada: 'bekleme', gelecek: 'bekleme', ai_rutinsiz: 'bekleme', bitti: 'bitti' };
export const GRUP_AD = { alarm: 'Takıldı', eylem: 'Sıra onda', calisma: 'Çalışıyor', bekleme: 'Bekliyor', bitti: 'Bitti' };
export const durumRenk = (d) => DR[GRUP[d]] || ISIK;
// durum simgeleri: pencerede, durağan; hamle simgeleriyle (! ? göz şimşek kıvılcım) hiçbiri ortak değil
export const GLIF = {
  engel: (s, c) => `<rect x="${f(-3 * s)}" y="${f(-1.15 * s)}" width="${f(6 * s)}" height="${f(2.3 * s)}" rx="${f(.6 * s)}" fill="${c}"/>`,
  ai_hata: (s, c) => `<path d="M${f(-2.5 * s)},${f(-2.5 * s)} L${f(2.5 * s)},${f(2.5 * s)} M${f(2.5 * s)},${f(-2.5 * s)} L${f(-2.5 * s)},${f(2.5 * s)}" stroke="${c}" stroke-width="${f(1.35 * s)}" stroke-linecap="round"/>`,
  karar: (s, c) => SIMGE.karo(s, c),
  sira: (s, c) => `<path d="M${f(-1.7 * s)},${f(-3 * s)} L${f(3.1 * s)},0 L${f(-1.7 * s)},${f(3 * s)}Z" fill="${c}" stroke="${c}" stroke-width="${f(.6 * s)}" stroke-linejoin="round"/>`,
  ai_onay: (s, c) => `<path d="M${f(-3 * s)},${f(.6 * s)} V${f(2.9 * s)} H${f(3 * s)} V${f(.6 * s)} M0,${f(1.3 * s)} V${f(-3 * s)} M${f(-1.8 * s)},${f(-1.2 * s)} L0,${f(-3.1 * s)} L${f(1.8 * s)},${f(-1.2 * s)}" fill="none" stroke="${c}" stroke-width="${f(1.05 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`,
  calisiyor: (s, c) => `<path d="M${f(3 * s)},${f(.2 * s)} A${f(3 * s)},${f(3 * s)} 0 1 1 ${f(.3 * s)},${f(-3 * s)}" fill="none" stroke="${c}" stroke-width="${f(1.1 * s)}" stroke-linecap="round"/><path d="M${f(-.2 * s)},${f(-4.7 * s)} L${f(2.3 * s)},${f(-3 * s)} L${f(-.2 * s)},${f(-1.3 * s)}Z" fill="${c}"/>`,
  ai_sirada: (s, c) => `<circle r="${f(3 * s)}" fill="none" stroke="${c}" stroke-width="${f(.95 * s)}"/><path d="M0,${f(-1.9 * s)} V0 H${f(1.6 * s)}" fill="none" stroke="${c}" stroke-width="${f(.95 * s)}" stroke-linecap="round" stroke-linejoin="round"/>`,
  ai_rutinsiz: (s, c) => `<g transform="translate(${f(.9 * s)},${f(-.9 * s)})">${SIMGE.kablo(s * .72, c)}</g>`,
  bekliyor: (s, c) => `<path d="M${f(-2.3 * s)},${f(-3 * s)} H${f(2.3 * s)} L${f(.5 * s)},0 L${f(2.3 * s)},${f(3 * s)} H${f(-2.3 * s)} L${f(-.5 * s)},0Z" fill="${c}" fill-opacity=".35" stroke="${c}" stroke-width="${f(.85 * s)}" stroke-linejoin="round"/>`,
  bitti: (s, c) => SIMGE.tik(s, c),
};
GLIF.ai_calisiyor = GLIF.calisiyor;

/**
 * Hamle plakası: katı, sert köşeli beşgen; sivri ucu araca (sola) bakar. Hamleyi yapacak kişinin renginde dolu, simge koyu.
 * Işık değildir: parlaması, yumuşak kenarı yoktur. Bakanın plakası büyük, krem çerçeveli ve araca doğru "dürter"; başkasınınki küçük ve durgun.
 * o.ag: hamle bir agent'ın işinden geliyor (köşede agent'ın renginde kare).
 */
export function plaka(tur, renk, o = {}) {
  const s = o.ben ? 1.2 : (o.s || .92);
  let ic = '';
  if (o.ben) ic += `<circle r="10.8" fill="none" stroke="${ISIK}" stroke-width="2.2"/>`;
  ic += `<circle r="9.6" fill="${renk}" opacity=".26"/>`;
  if (o.kuyruk !== false) ic += `<path d="M-4.6,4.4 L-10.5,10 L-1.2,7Z" fill="${renk}" stroke="${MUREKKEP}" stroke-width="1.1" stroke-linejoin="round"/>`;
  ic += `<circle r="7.3" fill="${renk}" stroke="${MUREKKEP}" stroke-width="1.2"/>`;
  ic += SIMGE[HAMLE_SIMGE[tur]](1.15, MUREKKEP);
  if (o.ag) ic += `<rect x="3.4" y="-10.4" width="5.6" height="5.6" fill="${o.ag}" stroke="${MUREKKEP}" stroke-width="1.1"/>`;
  if (o.yeni) ic += `<path class="yildiz" d="M-7,-12 L-5.8,-8.6 L-2.4,-7.4 L-5.8,-6.2 L-7,-2.8 L-8.2,-6.2 L-11.6,-7.4 L-8.2,-8.6Z" fill="${ISIK}" stroke="${MUREKKEP}" stroke-width=".8"/>`;
  return `<g class="plaka${o.ben ? ' ben' : ''}"><g transform="scale(${s})"><g class="itme">${ic}</g></g></g>`;
}
const damla = (tur, renk, o = {}) => plaka(tur, renk, o); // geriye uyum

// ---- gövdeler: siluet türü söyler (uzaktan) ----
// insan (ekip): ok başlı roket, iki geriye yatık kanat · dış: kubbeli disk · agent: köşeli küp dron, iki anten
const G = {
  insan: {
    yol: 'M15,0 C11,-5 5,-6.5 -5,-6.5 L-12,-6.5 Q-14.5,-6.5 -14.5,-4 L-14.5,4 Q-14.5,6.5 -12,6.5 L-5,6.5 C5,6.5 11,5 15,0Z',
    ek: 'M-2.5,-6 L-10.5,-12.5 L-14.5,-12.5 L-12.5,-6Z M-2.5,6 L-10.5,12.5 L-14.5,12.5 L-12.5,6Z',
    burun: 15, kic: -14.5, kicY: 0, nav: [[-13.6, -12.5], [-13.6, 12.5]], pen: [3.2, 0], penR: 4.7, kargo: [[-4, 10.5], [0, 10.5], [4, 10.5]], alt: 13, yan: 17, yuk: 15.5,
  },
  dis: {
    yol: 'M-16.5,2.6 Q-16,-.6 -8.2,-1.2 A8.4,8.4 0 0 1 8.2,-1.2 Q16,-.6 16.5,2.6 Q15.5,6.8 0,7 Q-15.5,6.8 -16.5,2.6Z',
    ek: '',
    burun: 16.5, kic: -16.5, kicY: 2.6, nav: [[-16.5, 2.6], [16.5, 2.6]], pen: [0, -2.6], penR: 4.6, kargo: [[-4, 10.4], [0, 10.4], [4, 10.4]], alt: 10, yan: 18.5, yuk: 12.5,
  },
  agent: {
    yol: 'M-7.5,-8 H7.5 L9,-6.5 V6.5 L7.5,8 H-7.5 L-9,6.5 V-6.5Z',
    ek: 'M-9,-3.6 H-11.6 V3.6 H-9Z',
    burun: 9, kic: -11.6, kicY: 0, nav: [[-5.6, -13], [5.6, -13]], pen: [0, .4], penR: 4.4, kargo: [[-1.8, -10], [1.8, -10]], alt: 9.5, yan: 12.5, yuk: 15,
  },
};
const anten = (r) => `<path d="M-3.4,-8 L-5.6,-12.2 M3.4,-8 L5.6,-12.2" stroke="${r}" stroke-width="1.5" stroke-linecap="round"/>`;
const bas = (k) => ((k.tip === 'agent' ? k.sahibi || k.ad : k.ad)[0] || '?').toLocaleUpperCase('tr');
// seyir ışığı: küçük krem nokta + yumuşak hale (ışık); elmas (karar) büyük
const isikNokta = (x, y, r, c, cls = '') => `<g transform="translate(${f(x)},${f(y)})"><g class="${cls}"><circle r="${f(r * 2.4)}" fill="${c}" opacity=".22"/><circle r="${f(r)}" fill="${c}"/></g></g>`;
const elmas = (x, y, r, c, cls = '') => `<g transform="translate(${f(x)},${f(y)})"><g class="${cls}"><circle r="${f(r * 2.2)}" fill="${c}" opacity=".25"/><path d="M0,${-r} L${r},0 L0,${r} L${-r},0Z" fill="${c}"/></g></g>`;
// kenar parlaması: siluetin kendisi, krem (ya da kırmızı) çizgiyle; altında geniş, saydam ikinci çizgi = hale
// hale gövdenin arkasında (geniş, saydam), çizgi gövdenin üstünde (ince, tam): ikisi birlikte "kenar parlaması"
const hale = (g, c, cls, o = {}) => `<g class="${cls}"><path d="${g.yol} ${g.ek}" fill="${c}" fill-opacity="${o.dolgu ?? .12}" stroke="${c}" stroke-width="${o.gen || 7}" stroke-linejoin="round" opacity="${o.hale ?? .3}"/></g>`;
const cizgi = (g, c, o = {}) => `<path d="${g.yol} ${g.ek}" fill="none" stroke="${c}" stroke-width="${o.ince || 1.4}" stroke-linejoin="round"/>`;

/**
 * Araç = kişi. kd: kişi durumu (KY.kisiDurumu + hamleler).
 * o.renkOf(ad) hamle sahibinin rengi · o.ben bakan · o.gizli (dış bakanın gördüğü başkası: durumsuz) · o.ilerleme 0..1 · o.ayrinti yakın plan yazısı
 * o.agRenk(no) hamle bir agent işinden geliyorsa agent'ın rengi · o.yeniHamle.
 * Katmanlar (arkadan öne): seçim · bakan nişangâhı · hale/kenar · motor izi · gövde · pencere · ışıklar · kargo · plakalar.
 */
export function arac(k, kd, o = {}) {
  const r = k.renk, tip = k.tip, g = G[tip];
  const d = o.gizli ? 'gizli' : kd.durum;
  const alarm = d === 'engel' || d === 'ai_hata';
  let arka = '', on = '', ince = '', al = '', alOn = '';
  // gövde dolgusu: kişinin rengi; bekleyen/sıradaki soluk, gelecek ve rutinsiz içi boş
  const bos = ['gelecek', 'gizli', 'ai_rutinsiz'].includes(d);
  const op = { bekliyor: .5, ai_sirada: .55, bitti: .62 }[d] ?? 1;
  const kontur = d === 'gelecek' ? ` stroke="${r}" stroke-width="1.6" stroke-dasharray="3 2.2"` : bos ? ` stroke="${r}" stroke-width="1.6"` : '';
  let govde = `<path class="kabuk" d="${g.yol} ${g.ek}" fill="${bos ? ZEMIN : r}"${kontur} stroke-linejoin="round" opacity="${d === 'gizli' ? .7 : op}"/>`;
  if (tip === 'agent') govde = `<g opacity="${bos ? 1 : op}">${anten(r)}</g>` + govde;
  const [px, py] = g.pen;
  const L = (d === 'gizli' || d === 'notr') ? ISIK : durumRenk(d);
  const R = f(g.penR * 1.3), gs = g.penR * 1.3 / 4.4;
  let pen = `<circle class="pencere" cx="${px}" cy="${py}" r="${R}" fill="${MUREKKEP}" stroke="${d === 'gizli' || d === 'notr' ? MUREKKEP : L}" stroke-width="1.2"/>`;
  if (d === 'gelecek') pen += `<text class="bas gun" x="${px}" y="${f(py + 2.2)}" fill="${L}">${kd.gun != null ? kd.gun + 'g' : '…'}</text>`;
  else if (GLIF[d]) pen += `<g class="glif" transform="translate(${px},${py})">${GLIF[d](gs, L)}</g>`;
  else pen += `<text class="bas${tip === 'agent' ? ' ag' : ''}" x="${px}" y="${f(py + 2.7)}" fill="${ISIK}">${bas(k)}</text>`;
  // baş harf gövdede (kişi = gövde): ekip kıçta, dış diskin altında; agent'ta yok (sahibine kenetle bağlı)
  if (GLIF[d] || d === 'gelecek') {
    if (tip === 'insan') pen += `<text class="bas govde-h" x="-8.6" y="2.6" fill="${bos ? r : MUREKKEP}">${bas(k)}</text>`;
    else if (tip === 'dis') pen += `<text class="bas govde-h kucuk" x="0" y="6.3" fill="${bos ? r : MUREKKEP}">${bas(k)}</text>`;
  }

  // ---- ışık imzası (durum) ----
  const [n1, n2] = g.nav;
  const kic = g.kic, ky = g.kicY;
  switch (d) {
    case 'calisiyor': // uzun krem alev, titrer · seyir ışıkları sabit
      arka += `<g class="iz"><path class="alev" d="M${kic + 1},${ky - 3.8} Q${kic - 9},${ky - 3} ${kic - 18},${ky} Q${kic - 9},${ky + 3} ${kic + 1},${ky + 3.8}Z" fill="url(#ky-isikIzM)"/><path d="M${kic},${ky} H${kic - 11}" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round" opacity=".9"/></g>`;
      ince += isikNokta(n1[0], n1[1], 1.3, L) + isikNokta(n2[0], n2[1], 1.3, L);
      break;
    case 'ai_calisiyor': // kesik paket izi: üç kare ışık geriye akar · antenler sırayla yanar
      arka += `<g class="iz">${[0, 1, 2].map((i) => `<rect class="paket p${i}" x="${kic - 4.4 - i * 5.2}" y="${ky - 1.5}" width="3" height="3" fill="${L}"/>`).join('')}</g>`;
      ince += isikNokta(n1[0], n1[1], 1.3, L, 'sira-a') + isikNokta(n2[0], n2[1], 1.3, L, 'sira-b');
      break;
    case 'sira': // kenar parlaması, hale yavaş nefes alır
      arka += hale(g, L, 'nefes'); on += cizgi(g, L);
      ince += isikNokta(n1[0], n1[1], 1.2, L) + isikNokta(n2[0], n2[1], 1.2, L);
      break;
    case 'karar': // kesik kenar + iki büyük elmas fener sırayla yanar (seçim: iki dal)
      arka += hale(g, L, '', { hale: .18 }); on += cizgi(g, L);
      on += elmas(n1[0], n1[1] + (tip === 'insan' ? Math.sign(n1[1]) * 1.5 : 0), 3.6, L, 'sira-a') + elmas(n2[0], n2[1] + (tip === 'insan' ? Math.sign(n2[1]) * 1.5 : 0), 3.6, L, 'sira-b');
      break;
    case 'engel': // kırmızı kenar + çift çakar (tek alarm)
      al += hale(g, ALARM, 'cakar', { gen: 10, hale: .45, dolgu: .3 }); alOn += cizgi(g, ALARM, { ince: 2.2 });
      break;
    case 'ai_hata': // kırmızı kenar + kırmızı antenler + kopuk kıvılcım izi
      al += hale(g, ALARM, 'cakar', { gen: 10, hale: .45, dolgu: .3 }); alOn += cizgi(g, ALARM, { ince: 2.2 });
      arka += `<g class="iz"><path d="M${kic - 1},${ky - 3} L${kic - 4},${ky - .5} L${kic - 6},${ky - 2.5} L${kic - 9},${ky} M${kic - 1},${ky + 3} L${kic - 4},${ky + 1} L${kic - 7},${ky + 3.2}" fill="none" stroke="${ALARM}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      on += isikNokta(n1[0], n1[1], 1.4, ALARM, 'cakar') + isikNokta(n2[0], n2[1], 1.4, ALARM, 'cakar');
      break;
    case 'ai_onay': // sabit kenar + sahibine doğru (aşağı) yayılan sinyal yayları
      arka += hale(g, L, '', { hale: .2 }); on += cizgi(g, L, { ince: 1.2 });
      on += `<g class="sinyal"><path class="s0" d="M-5,${g.alt + 1.5} Q0,${g.alt + 4.5} 5,${g.alt + 1.5}" fill="none" stroke="${L}" stroke-width="1.4" stroke-linecap="round"/><path class="s1" d="M-8,${g.alt + 3.5} Q0,${g.alt + 8.5} 8,${g.alt + 3.5}" fill="none" stroke="${L}" stroke-width="1.2" stroke-linecap="round"/></g>`;
      ince += isikNokta(n1[0], n1[1], 1.3, L) + isikNokta(n2[0], n2[1], 1.3, L);
      break;
    case 'ai_sirada': // tek bekleme ışığı, seyrek kısa çakış
      ince += isikNokta(n2[0], n2[1], 1.4, L, 'bekleme');
      break;
    case 'ai_rutinsiz': // ışık yok, içi boş, kıçtan sarkan fişi çekik kablo
      on += `<g transform="translate(${kic + 1},${ky + 6})">${SIMGE.kablo(1.25, L)}</g>`;
      break;
    case 'bekliyor': // rölanti: kıçta tek kor, çok yavaş nefes
      arka += `<g transform="translate(${kic - 1.6},${ky})"><circle class="kor" r="4.2" fill="${L}" opacity=".22"/><circle r="1.7" fill="${L}"/></g>`;
      break;
    case 'bitti': // ışıklar sönük; altta iniş pisti
      on += `<path d="M${-g.yan + 3},${g.alt + 2} H${g.yan - 3}" stroke="${L}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`;
      break;
  }
  // başkasının (ya da kendi) agent'ında rutin yok, birincil durum başka: küçük kablo
  if (tip === 'agent' && kd.rutinsiz && kd.rutinsiz.length && d !== 'ai_rutinsiz' && !o.gizli) on += `<g transform="translate(${kic + 1.2},${ky + 6})">${SIMGE.kablo(.95, ISIK)}</g>`;
  // gecikme: kıçta kırmızı fener çubuğu (kırmızı = alarm). Yakında "+Ng".
  if (kd.gecGun && !o.gizli) {
    alOn += `<g transform="translate(${kic - .4},${ky})"><g class="gec"><rect x="-4" y="-7.2" width="8" height="14.4" rx="3" fill="${ALARM}" opacity=".28"/><rect x="-1.6" y="-5.4" width="3.2" height="10.8" rx="1.2" fill="${ALARM}"/></g></g>`;
    alOn += `<text class="k1 gec-t" x="${kic - 4}" y="${ky - 5.5}" text-anchor="end">+${kd.gecGun}g</text>`;
  }
  // elindeki diğer açık işler: kargo ışıkları (en çok 3; agent'ta 2)
  const nAcik = o.gizli ? 0 : Math.max(0, (kd.acik || []).length - 1);
  if (nAcik) ince += g.kargo.slice(0, Math.min(nAcik, g.kargo.length)).map(([x, y]) => `<rect x="${f(x - 1.2)}" y="${f(y - 1.2)}" width="2.4" height="2.4" rx=".5" fill="${ISIK}" opacity=".9"/>`).join('');
  // ilerleme yayı (çalışıyor): pencere çevresinde, yakında
  if (o.ilerleme != null && ['calisiyor', 'ai_calisiyor'].includes(d)) {
    const rr = g.penR + 1.7, a = Math.max(.02, Math.min(.999, o.ilerleme)) * 2 * Math.PI;
    on += `<path class="k1" d="M${px},${f(py - rr)} A${rr},${rr} 0 ${a > Math.PI ? 1 : 0} 1 ${f(px + rr * Math.sin(a))},${f(py - rr * Math.cos(a))}" fill="none" stroke="${ISIK}" stroke-width="1.5" stroke-linecap="round"/>`;
  }
  if (o.ayrinti && !o.gizli) on += `<text class="k2 ayrinti${alarm ? ' alarm' : ''}" y="${g.alt + (tip === 'agent' ? (d === 'ai_onay' ? 15 : 11) : 8.5)}" text-anchor="middle">${o.ayrinti}</text>`;
  // bakan: nişangâh köşeleri (geometrik, ışık değil) · seçili: tam çerçeve
  const W = g.yan + 3, Hh = g.yuk + 2;
  const kose = (sx, sy) => `M${sx * W},${sy * (Hh - 5)} V${sy * Hh} H${sx * (W - 5)}`;
  const ben = o.ben ? `<path class="nisan" d="${kose(-1, -1)} ${kose(1, -1)} ${kose(-1, 1)} ${kose(1, 1)}" fill="none" stroke="${ISIK}" stroke-width="1.5" opacity=".95"/>` : '';
  const sec = `<rect class="secim-h" x="${-W - 2}" y="${-Hh - 2}" width="${2 * W + 4}" height="${2 * Hh + 4}" rx="6" fill="none" stroke="${ISIK}" stroke-width="1.6"/>`;
  // hamle plakaları (bu kişinin yapacağı)
  let x = g.burun + 3, pl = '';
  const hm = o.gizli ? [] : (kd.hamleler || []);
  hm.slice(0, 2).forEach((h) => {
    const s = o.ben ? 1.2 : .92, w = 19 * s;
    pl += `<g transform="translate(${f(x + 7 * s)},${f(-12 * s)})">${plaka(h.tur, o.renkOf ? o.renkOf(h.kim) : r, { ben: o.ben, yeni: o.yeniHamle && o.yeniHamle.has(h.no), ag: o.agRenk ? o.agRenk(h.no) : null })}</g>`;
    x += w + 1.5;
  });
  if (hm.length > 2) { pl += `<text class="arti" x="${x + 1}" y="-9">+${hm.length - 2}</text>`; x += 12; }
  const svg = sec + ben + `<g class="alarm-k">${al}</g><g class="isik">${arka}</g>` + `<g class="govde-a">${govde}${pen}</g>` + `<g class="isik on">${on}</g><g class="alarm-on">${alOn}</g><g class="ince">${ince}</g>` + `<g class="plakalar">${pl}</g>`;
  return { svg, on: x, arka: -kic + (d === 'calisiyor' ? 18 : 3) };
}

/** Kişi listesi ve ayarlar için durumsuz gövde (renk + siluet + baş harf). */
const govde = (k) => arac(k, { durum: 'notr', acik: [], hamleler: [] }, {}).svg;

/**
 * Gezegen = iş. Görsel durum gruptaki sınıftan okunur (g-lit, g-run, …); katmanlar CSS ile açılır.
 * Işık (ates) yarıçapı her karede değişir; yapı değişmez. Kalkanlar: kritik = istasyon halkası, darboğaz = kıskaç + sayı,
 * karar = çatal, rutin yok = kablo, çıktı = belge/terazi, alt görev = uydular, değişti = renkli nokta.
 */
export function gezegen(a, o = {}) {
  const r = 8, renk = o.renk, ikinci = o.ortakRenk;
  let s = '';
  s += `<circle class="nabiz" r="${r + 3.6}" fill="none" stroke="${ISIK}" stroke-width="1.5"/>`;
  s += `<circle class="alarm" r="${r + 3.2}" fill="${ALARM}" fill-opacity=".18" stroke="${ALARM}" stroke-width="2"/>`;
  if (o.kritik) s += `<g class="ray"><circle r="${r + 2.9}" fill="none" stroke="${MUREKKEP}" stroke-width="3.4"/><circle r="${r + 2.9}" fill="none" stroke="${ISIK}" stroke-width="1.3"/></g>`;
  s += `<circle class="govde" r="${r}" fill="#10283C"/>`;
  s += `<circle class="ates" r="0" fill="${ISIK}"/>`;
  s += `<circle class="tahmin-c" r="${r}" fill="none" stroke="${ISIK}" stroke-width="1" stroke-dasharray="1.6 1.6"/>`;
  if (ikinci) s += `<path class="rim" d="M0,${-r} A${r},${r} 0 0 1 0,${r}" fill="none" stroke="${renk}" stroke-width="2.2"/><path class="rim" d="M0,${r} A${r},${r} 0 0 1 0,${-r}" fill="none" stroke="${ikinci}" stroke-width="2.2"/>`;
  else s += `<circle class="rim" r="${r}" fill="none" stroke="${renk}" stroke-width="2"/>`;
  s += `<path class="cizik" d="M${-r - 1},${r + 1} L${r + 1},${-r - 1}" stroke="${renk}" stroke-width="1.2" opacity=".8"/>`;
  s += `<g class="erteli"><path d="M-3.6,-2.6 L-.8,0 L-3.6,2.6 M.4,-2.6 L3.2,0 L.4,2.6" fill="none" stroke="${ISIK}" stroke-width="1.2" stroke-linecap="round"/></g>`;
  if (o.rutinsiz) s += `<g class="rutinsiz-p" transform="translate(${r + 2.6},${r - .4})"><circle r="4.8" fill="${ZEMIN}" stroke="${ISIK}" stroke-width=".7"/><g transform="translate(.4,-1.3)">${SIMGE.kablo(.72, ISIK)}</g></g>`;
  if (o.karar) s += `<g class="karar-p" transform="translate(0,${-r - 5})"><circle r="3.8" fill="${ZEMIN}" stroke="${ISIK}" stroke-width=".6"/>${SIMGE.karo(.85, DR.eylem)}</g>`;
  if (o.cikti) s += `<g class="cikti-p k1" transform="translate(${-r - 2.6},${r - .8})">${SIMGE[o.cikti === 'terazi' ? 'terazi' : 'belge'](.9, ISIK)}</g>`;
  s += `<g class="simsek-p">${SIMGE.simsek(.95, '#FFD7D2')}</g>`;
  if (o.darbogaz) s += `<g class="bogaz"><path d="M${-r - 6.5},-4 L${-r - 2.5},0 L${-r - 6.5},4Z M${r + 6.5},-4 L${r + 2.5},0 L${r + 6.5},4Z" fill="${ISIK}"/>${o.tut ? `<g transform="translate(${r + 5},${-r - 3})"><rect x="-5" y="-4.4" width="10" height="8.8" rx="1.5" fill="${MUREKKEP}" stroke="${ISIK}" stroke-width=".8"/><text class="bogaz-t" y="2.5">${o.tut}</text></g>` : ''}</g>`;
  if (o.altlar && o.altlar.length) {
    const n = o.altlar.length;
    o.altlar.forEach((b, i) => { const ang = (90 + (i - (n - 1) / 2) * 34) * Math.PI / 180; s += `<circle class="uydu${b.bitti ? ' dolu' : ''}" data-alt="${b.no}" cx="${f((r + 5.2) * Math.cos(ang))}" cy="${f((r + 5.2) * Math.sin(ang))}" r="2.1"/>`; });
  }
  s += `<text class="no" y="2.9">${a.no}</text>`;
  if (o.yeniRenk) s += `<g class="iz"><circle class="iz-flas" r="${r + 7}" fill="none" stroke="${ISIK}" stroke-width="2"/><circle cx="${-r - 1.5}" cy="${-r - 1.5}" r="3.4" fill="${o.yeniRenk}" stroke="${MUREKKEP}" stroke-width="1"/></g>`;
  if (o.ad) s += `<text class="ad k2" y="${r + 9.5}">${o.ad}</text>`;
  return s;
}

/** Agent–sahip kenedi: agent'tan sahibine dikey ışık bağı. durum: 'pasif' | 'aktif' (sahibine hamle düştü) | 'kopuk' (rutin yok). */
export function kenet(y1, y2, renkSahip, durum, x = -9) {
  const a = y1 + 7, b = y2 - 7, m = (a + b) / 2;
  if (durum === 'kopuk') return `<path d="M${x},${f(a)} V${f(m - 3)} M${x},${f(m + 3)} V${f(b)}" stroke="${renkSahip}" stroke-width="1.4" stroke-linecap="round" opacity=".8"/><path d="M${x - 2.6},${f(m - 3)} H${x + 2.6} M${x - 2.6},${f(m + 3)} H${x + 2.6}" stroke="${ISIK}" stroke-width="1.1" stroke-linecap="round"/>`;
  if (durum === 'aktif') return `<path d="M${x},${f(a)} V${f(b)}" stroke="${renkSahip}" stroke-width="3" stroke-linecap="round" opacity=".6"/><path class="akis" d="M${x},${f(a)} V${f(b)}" stroke="${ISIK}" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="2 5"/><path d="M${x - 3},${f(b - 4)} L${x},${f(b)} L${x + 3},${f(b - 4)}" fill="none" stroke="${ISIK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<path d="M${x},${f(a)} V${f(b)}" stroke="${renkSahip}" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1.2 2.6" opacity=".8"/>`;
}

export const DEFS = `<linearGradient id="ky-isikIzM" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#5AB8FF" stop-opacity=".95"/><stop offset="1" stop-color="#5AB8FF" stop-opacity="0"/></linearGradient><linearGradient id="ky-isikIz" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".3" stop-color="#FFF6E0" stop-opacity=".9"/><stop offset="1" stop-color="#FFF6E0" stop-opacity="0"/></linearGradient>
  <radialGradient id="ky-cekirdekG"><stop offset="0" stop-color="#FFF6E0" stop-opacity=".95"/><stop offset=".45" stop-color="#FFE3B8" stop-opacity=".35"/><stop offset="1" stop-color="#FFC9A3" stop-opacity="0"/></radialGradient>
  <radialGradient id="ky-gok" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#0A2F3A"/><stop offset=".55" stop-color="#082533"/><stop offset="1" stop-color="#030E14"/></radialGradient>
  <radialGradient id="ky-nebY"><stop offset="0" stop-color="#2E8F7A" stop-opacity=".30"/><stop offset="1" stop-color="#2E8F7A" stop-opacity="0"/></radialGradient>
  <radialGradient id="ky-nebM"><stop offset="0" stop-color="#3E6BD0" stop-opacity=".22"/><stop offset="1" stop-color="#3E6BD0" stop-opacity="0"/></radialGradient>
  <marker id="ky-ok" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 L3,5Z" fill="context-stroke"/></marker>`;

