/**
 * W4 (6 Kas, lejant "Kimin Hamlesi" + Berkin 15:41): hamle dili. Görev kartındaki düğme ile haritadaki damla aynı:
 * renk hamlenin düştüğü kişinin rengi (AI onayında agent sahibinin), simge düğmeyi söyler
 * (! bitir, ? karar ver, göz onayla, şimşek engeli kaldır). Simgeler lejant yarışmasının çizimleriyle aynı.
 */
export const SIMGE = {
  tik: (s: number, c: string) => `<path d="M${-2.2 * s},0 L${-0.5 * s},${1.8 * s} L${2.4 * s},${-1.8 * s}" fill="none" stroke="${c}" stroke-width="${1.3 * s}" stroke-linecap="round" stroke-linejoin="round"/>`,
  unlem: (s: number, c: string) => `<rect x="${-0.75 * s}" y="${-3.2 * s}" width="${1.5 * s}" height="${4 * s}" rx="${0.7 * s}" fill="${c}"/><circle cy="${2.4 * s}" r="${0.85 * s}" fill="${c}"/>`,
  soru: (s: number, c: string) => `<path d="M${-1.7 * s},${-1.4 * s} Q${-1.7 * s},${-3.3 * s} 0,${-3.3 * s} Q${1.9 * s},${-3.3 * s} ${1.9 * s},${-1.6 * s} Q${1.9 * s},${-0.4 * s} ${0.4 * s},${0.2 * s} Q0,${0.4 * s} 0,${1.2 * s}" fill="none" stroke="${c}" stroke-width="${1.2 * s}" stroke-linecap="round"/><circle cy="${2.6 * s}" r="${0.75 * s}" fill="${c}"/>`,
  goz: (s: number, c: string) => `<path d="M${-3 * s},0 Q0,${-2.6 * s} ${3 * s},0 Q0,${2.6 * s} ${-3 * s},0Z" fill="none" stroke="${c}" stroke-width="${0.9 * s}"/><circle r="${1.1 * s}" fill="${c}"/>`,
  simsek: (s: number, c: string) => `<path d="M${0.6 * s},${-3.4 * s} L${-1.8 * s},${0.4 * s} L${0.1 * s},${0.4 * s} L${-0.7 * s},${3.4 * s} L${1.9 * s},${-0.6 * s} L0,${-0.6 * s}Z" fill="${c}"/>`,
  kivilcim: (s: number, c: string) => `<path d="M0,${-3.4 * s} Q${0.5 * s},${-0.5 * s} ${3.4 * s},0 Q${0.5 * s},${0.5 * s} 0,${3.4 * s} Q${-0.5 * s},${0.5 * s} ${-3.4 * s},0 Q${-0.5 * s},${-0.5 * s} 0,${-3.4 * s}Z" fill="${c}"/>`,
  saat: (s: number, c: string) => `<circle r="${2.6 * s}" fill="none" stroke="${c}" stroke-width="${0.8 * s}"/><path d="M0,${-1.6 * s} V0 L${1.2 * s},${0.8 * s}" fill="none" stroke="${c}" stroke-width="${0.8 * s}" stroke-linecap="round"/>`,
  belge: (s: number, c: string) => `<path d="M${-2 * s},${-2.8 * s} H${1 * s} L${2.2 * s},${-1.6 * s} V${2.8 * s} H${-2 * s}Z" fill="none" stroke="${c}" stroke-width="${0.8 * s}" stroke-linejoin="round"/><path d="M${-1 * s},${-0.3 * s} H${1.2 * s} M${-1 * s},${1.2 * s} H${1.2 * s}" stroke="${c}" stroke-width="${0.7 * s}"/>`,
  terazi: (s: number, c: string) => `<path d="M0,${-3 * s} V${2.6 * s} M${-2.4 * s},${2.6 * s} H${2.4 * s} M${-3 * s},${-1.6 * s} H${3 * s}" stroke="${c}" stroke-width="${0.8 * s}" stroke-linecap="round"/><path d="M${-3 * s},${-1.6 * s} L${-3.6 * s},${0.4 * s} H${-2.4 * s}Z M${3 * s},${-1.6 * s} L${2.4 * s},${0.4 * s} H${3.6 * s}Z" fill="${c}"/>`,
};
export const ALARM = '#FF5A5A';
/** Kişi paleti (K5; Agent'larım'daki seçimle aynı). */
export const PALET = ['#FFC9A3', '#E86FA0', '#F2D16B', '#9EE6CF', '#7FC8F8', '#B9A6F2', '#F28C6B', '#C7E07A'];

const hash = (s: string) => { let h = 0; for (const c of s.toLocaleLowerCase('tr')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
/** İki rengi karıştırır (agent: sahibinin açık tonu). */
export function acik(hex: string, k = .45) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (v: number) => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0');
  return `#${m(r)}${m(g)}${m(b)}`;
}
/**
 * Kişinin rengi: kayıtlı renk (W7'de sunucudan) yoksa addan sabit bir palet rengi. Agent, sahibinin açık tonu.
 * `renkler` verilirse ondan okunur.
 */
export function kisiRengi(ad: string, o: { tip?: string; sahibi?: string | null; renkler?: Record<string, string> } = {}): string {
  const R = o.renkler || {};
  if (R[ad]) return R[ad];
  if (o.tip === 'agent' && o.sahibi) return acik(R[o.sahibi] || PALET[hash(o.sahibi) % PALET.length]);
  return PALET[hash(ad) % PALET.length];
}

export type HamleTur = 'bitir' | 'karar' | 'onayla' | 'engel' | 'kur';
/**
 * H5 (sunucu 0.36.0): agent adımının işini alacak Claude rutini yok mu? Sunucu `rutin_var` yazdıysa o, yazmadıysa (eski sunucu)
 * yalnız kendi rutinlerinden bilinen `yerel` değer.
 */
export const rutinYok = (a: any, yerel = false) => (typeof a?.rutin_var === 'boolean' ? !a.rutin_var : yerel);
export interface Hamle { tur: HamleTur; kim: string; renk: string; etiket: string }
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const ETIKET: Record<HamleTur, string> = { bitir: 'Bitir', karar: 'Karar ver', onayla: 'Onayla', engel: 'Engeli kaldır', kur: 'AI yapsın’ı kur' };

/**
 * Hamle kimde ve ne? Sıradaki (henüz başlayamayan) ve biten işte hamle yok.
 * 9 Kas (harita denetimi A1, A2): AI yapsın açık işte sıra AI'dadır; AI çalışırken ya da sırasını beklerken kimseden bir şey
 * beklenmez. Bakan kişi agent'ın sahibiyse ve Claude rutini yoksa (`rutinYok`) iş kendiliğinden başlamaz: hamle "kur",
 * sahibinin renginde. H5 (sunucu 0.36.0): adımda `rutin_var` varsa o geçer; başkasının agent'ında rutin yoksa da hamle sahibindedir.
 */
export function hamle(a: any, o: { renkler?: Record<string, string>; ben?: string; rutinYok?: boolean } = {}): Hamle | null {
  if (BITTI(a.durum) || a.durum === 'sirada') return null;
  const agent = a.sahip_tip === 'agent';
  const insan = agent ? a.agent_sahibi || a.sahip : a.sahip;
  const ai = a.oto ? a.oto_durum || 'sirada' : null;
  let tur: HamleTur | null = null;
  if (ai === 'bakilacak') tur = 'onayla';
  else if (a.durum === 'engelli' || ai === 'hata') tur = 'engel';
  else if (ai) tur = rutinYok(a, !!(o.rutinYok && o.ben && insan === o.ben)) && a.durum === 'hazir' && ai === 'sirada' ? 'kur' : null;
  else if (a.karar_adimi) tur = 'karar';
  else if (a.durum === 'hazir' || a.durum === 'suruyor') tur = 'bitir';
  if (!tur) return null;
  const kim = tur === 'onayla' || tur === 'kur' ? insan : agent && tur === 'bitir' ? insan : a.sahip;
  return { tur, kim, renk: kisiRengi(kim, { tip: kim === a.sahip ? a.sahip_tip : 'insan', sahibi: a.agent_sahibi, renkler: o.renkler }), etiket: ETIKET[tur] };
}
const IC: Record<HamleTur, (s: number, c: string) => string> = { bitir: SIMGE.unlem, karar: SIMGE.soru, onayla: SIMGE.goz, engel: SIMGE.simsek, kur: SIMGE.kivilcim };
/** Düğmenin ve damlanın simgesi. */
export const hamleSimgesi = (t: HamleTur, s = 1.15, c = '#08222E') => IC[t](s, c);
/** Haritadaki damla: gezegenin tam üstünde. */
export const damla = (h: Hamle, x: number, y: number, sc = 1) =>
  `<g transform="translate(${x},${y}) scale(${sc})"><path d="M0,9.5 C-2,6 -7,3.5 -7,-1 A7,7 0 1 1 7,-1 C7,3.5 2,6 0,9.5Z" fill="${h.renk}" stroke="#08222E" stroke-width="1.2"/><g transform="translate(0,-1)">${hamleSimgesi(h.tur)}</g></g>`;
