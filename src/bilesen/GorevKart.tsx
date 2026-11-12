import type { CSSProperties } from 'react';
import { akisModeli, gunAy, yolCiz } from '../cizim/yol.js';
import { hamle, hamleSimgesi, SIMGE, type Hamle } from '../cizim/hamle';
import { gorevCumlesi } from '../metin/gorevCumlesi';
import { kisaAd } from '../cizim/yol.js';

/**
 * W4 (6 Kas, B17, B24, C24–C26): tek görev bileşeni. Pano, akış listesi, Görevler, bildirim ve harita kutusunda aynı:
 * solda mini harita (akışın o adıma yakınlaşmış hâli; alt görevde üst görevin gezegeni ve "alt" işareti), ortada
 * iki satıra kadar kesilmeyen görev cümlesi (KİM + NE + NE ZAMAN + durum fiili), altında bitende çıktının simgesi,
 * sağda hamle düğmesi: hamlenin düştüğü kişinin renginde, simgesi haritadaki damlayla aynı. Numara gösterilmez.
 */
const enc = encodeURIComponent;
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

// C26: mini harita akış başına bir kez çizilir; satır yalnız kendi adımına viewBox ile yakınlaşır
const MINI = new Map<string, { anahtar: string; svg: string; P: Record<string, [number, number]> }>();
const MR = 100;
export function miniHarita(d: any, ben: string, now: number) {
  const kod = d?.akis?.kod || d?.akis?.kisa_kod; if (!kod || !(d.adimlar || []).length) return null;
  const anahtar = (d.adimlar as any[]).map((a) => `${a.no}${a.durum}${a.oto_durum || ''}`).join(',') + '|' + Math.floor(now / 36e5);
  const v = MINI.get(kod);
  if (v && v.anahtar === anahtar) return v;
  try {
    const r = yolCiz(akisModeli(d, { sahip: ben }), { lod: 'kucuk', cx: 0, cy: 0, R: MR, now, pr: 7 });
    const y = { anahtar, svg: r.svg, P: r.P as Record<string, [number, number]> };
    MINI.set(kod, y); return y;
  } catch { return null; }
}

export interface GorevKartOz {
  a: any;
  /** akışın detayı (mini harita ve alt görevin üstü için) */
  d?: any;
  ben: string;
  now: number;
  /** akış adı satırda gösterilsin mi (akış dışı listelerde) */
  akisAdi?: string | null;
  ac: () => void;
  /** hamle düğmesine basınca (yoksa kart açılır) */
  hamleYap?: (h: Hamle) => void;
  renkler?: Record<string, string>;
  /** hamle düğmesi kartın dışında (harita kutusunda eylem çubuğu) */
  hamleGizli?: boolean;
  style?: CSSProperties;
  className?: string;
  /** ekran okuyucu etiketi (yoksa cümle) */
  etiket?: string;
}

/** Bitende çıktının simgesi: karar terazi, dosya/metin belge, yoksa tik. */
const ciktiSimgesi = (a: any) => (a.karar_adimi ? SIMGE.terazi(1.6, '#F4EEFF') : (a.cikti_sayisi || a.ciktilar?.length) ? SIMGE.belge(1.6, '#F4EEFF') : SIMGE.tik(1.6, '#F4EEFF'));

export function GorevKart({ a, d, ben, now, akisAdi, ac, hamleYap, renkler, hamleGizli, style, className = '', etiket }: GorevKartOz) {
  const cumle = kartCumlesi(a, ben);
  const G = { ton: kartTonu(a, ben) };
  const h = hamle(a, { renkler });
  const M = d ? miniHarita(d, ben, now) : null;
  const odak = a.ust_adim != null ? a.ust_adim : a.no;
  const p = M?.P[String(odak)];
  const Z = 40;
  const vb = p ? `${p[0] - Z} ${p[1] - Z} ${2 * Z} ${2 * Z}` : `${-MR} ${-MR} ${2 * MR} ${2 * MR}`;
  const alt = [akisAdi, BITTI(a.durum) && a.durum_at ? gunAy(Date.parse(a.durum_at)) : null].filter(Boolean).join(' · ');
  return (
    <div className={`gorev-kart ton-${G.ton} ${className}`} style={style}>
      <button type="button" className="gorev-kart-ac" onClick={ac} aria-label={etiket || `${cumle}${akisAdi ? `. ${akisAdi}` : ''}`}>
        <span className="gorev-kart-harita" aria-hidden>
          <svg width="40" height="40" viewBox={vb} dangerouslySetInnerHTML={{ __html: (M?.svg || '') + (p ? `<circle cx="${p[0]}" cy="${p[1]}" r="11" fill="none" stroke="#FFF3E8" stroke-width="1.6"/>` : '') }} />
          {a.ust_adim != null && <i className="gorev-kart-alt">alt</i>}
        </span>
        <span className="gorev-kart-metin">
          <b>{cumle}</b>
          {(alt || BITTI(a.durum)) && <small>{BITTI(a.durum) && <svg aria-hidden width="14" height="14" viewBox="-7 -7 14 14" dangerouslySetInnerHTML={{ __html: ciktiSimgesi(a) }} />}{alt}</small>}
        </span>
      </button>
      {h && !hamleGizli && <button type="button" className="gorev-kart-hamle" style={{ ['--hamle' as string]: h.renk }} aria-label={`${h.etiket}${h.kim !== ben ? ` (${h.kim})` : ''}`} title={h.etiket}
        onClick={() => (hamleYap ? hamleYap(h) : ac())}>
        <svg aria-hidden width="20" height="20" viewBox="-5 -5 10 10" dangerouslySetInnerHTML={{ __html: hamleSimgesi(h.tur, 1.15, '#08222E') }} />
      </button>}
    </div>
  );
}


/** Kartın cümlesi: KİM + NE + NE ZAMAN, "Sen" 2. tekil kişiyle çekimli, tarih satır sonunda bölünmez (detayda da kullanılır). */
export function kartCumlesi(a: any, ben: string): string {
  const bitis = BITTI(a.durum) ? null : a.son_tarih || a.en_erken_bitis || null;
  const G = gorevCumlesi({ ...a, bitis }, { gun: (x) => gunAy(tarihMs(x)), kisa: (x) => (x === ben ? 'Sen' : kisaAd(x)) });
  // "Sen" ile çekim: 2. tekil kişi eki ("netleştireceksin", "netleştiriyorsun", "netleştirdin")
  const c0 = G.cumle.replace(', Sen onaylayacak', ', sen onaylayacaksın').replace('Sen’in onayını bekliyor', 'onayını bekliyor').replace('Sen’in onayını', 'onayını');
  const c1 = c0.startsWith('Sen ') ? senEki(c0) : c0.replace(/: Sen(,|$| ·)/, ': sende$1').replace(/: Sen bitirdi$/, ': bitirdin');
  // Berkin 16:55: satır sonu tarih ortasından bölünmesin ("2 Kas’a kadar" bir arada)
  return c1.replace(/(\d{1,2}) ([A-ZÇĞİÖŞÜ][a-zçğıöşü]{2}(?:’[a-zçğıöşü]+)?)( kadar)?/g, (_m, g, a, k) => `${g}\u00A0${a}${k ? '\u00A0kadar' : ''}`);
}
export const kartTonu = (a: any, ben: string) => gorevCumlesi({ ...a, bitis: BITTI(a.durum) ? null : a.son_tarih || a.en_erken_bitis || null }, { gun: (x) => x, kisa: (x) => (x === ben ? 'Sen' : x) }).ton;

/** "Sen kapsamı netleştirecek" → "Kapsamı netleştireceksin". */
export function senEki(c: string): string {
  const [ana, ...kuyruk] = c.slice(4).split(/(?=[;,])/);
  const w = ana.trim().split(' '), f = w[w.length - 1];
  const u = (s: string) => { for (let i = s.length - 1; i >= 0; i--) if ('aeıioöuü'.includes(s[i])) return s[i]; return 'e'; };
  const d4 = (s: string) => { const v = u(s); return 'aı'.includes(v) ? 'ı' : 'ei'.includes(v) ? 'i' : 'ou'.includes(v) ? 'u' : 'ü'; };
  let y = f;
  if (/(malı|meli|yor|acak|ecek)$/.test(f)) y = f.replace(/(acak|ecek)$/, (m) => m.slice(0, -1) + 'ğ') + 's' + d4(f) + 'n';
  else if (/(dı|di|du|dü|tı|ti|tu|tü)$/.test(f)) y = f + 'n';
  w[w.length - 1] = y;
  const s = w.join(' ');
  return s[0].toLocaleUpperCase('tr') + s.slice(1) + kuyruk.join('');
}
export const gorevAdresi = (kod: string, no: number) => `/akis/${enc(kod)}/adim/${no}`;
