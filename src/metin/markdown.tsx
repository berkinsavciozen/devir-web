import { Fragment, type ReactNode } from 'react';

/**
 * AI rutinlerinin ve agent'ların yazdığı çıktı metni için küçük, güvenli bir markdown okuyucu (12 Kas).
 * GFM alt kümesi: başlık, paragraf, madde/numaralı/görev listesi (iç içe), tablo (hizalama dahil),
 * alıntı, kod bloğu, yatay çizgi; satır içinde kalın, italik, üstü çizili, kod, bağlantı ve çıplak adres.
 * HTML hiç işlenmez: her şey React metni olarak basılır, bağlantılar yalnız http(s)/mailto.
 */

export type Hiza = 'sol' | 'orta' | 'sag' | null;
export type Blok =
  | { tur: 'baslik'; seviye: number; metin: string }
  | { tur: 'paragraf'; satirlar: string[] }
  | { tur: 'liste'; sirali: boolean; baslangic: number; ogeler: Oge[] }
  | { tur: 'tablo'; baslik: string[]; hiza: Hiza[]; satirlar: string[][] }
  | { tur: 'alinti'; bloklar: Blok[] }
  | { tur: 'kod'; dil: string; metin: string }
  | { tur: 'cizgi' };
export type Oge = { metin: string; tik: boolean | null; alt: Blok[] };

const RE_BASLIK = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RE_CIZGI = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
const RE_CIT = /^ {0,3}(`{3,}|~{3,})\s*([\w+-]*)/;
const RE_MADDE = /^(\s*)([-*+•]|\d{1,9}[.)])\s+(.*)$/;
const RE_AYRAC = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Tablo satırını hücrelere böler: kaçışlı \| ve `kod` içindeki | bölmez. */
export function hucreler(satir: string): string[] {
  let s = satir.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const out: string[] = [];
  let cur = '', kod = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\' && s[i + 1] === '|') { cur += '|'; i++; continue; }
    if (ch === '`') kod = !kod;
    if (ch === '|' && !kod) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const tabloSatiriMi = (s: string) => s.includes('|');
const girinti = (s: string) => (s.match(/^\s*/)![0].replace(/\t/g, '    ').length);

export function ayristir(metin: string): Blok[] {
  const L = metin.replace(/\r\n?/g, '\n').split('\n');
  return bloklar(L);
}

function bloklar(L: string[]): Blok[] {
  const out: Blok[] = [];
  let i = 0;
  while (i < L.length) {
    const s = L[i];
    if (!s.trim()) { i++; continue; }
    const cit = s.match(RE_CIT);
    if (cit) {
      const kap = cit[1];
      const ic: string[] = [];
      i++;
      while (i < L.length && !(L[i].trim().startsWith(kap[0].repeat(kap.length)) && !L[i].trim().slice(kap.length).trim())) ic.push(L[i++]);
      i++;
      out.push({ tur: 'kod', dil: cit[2] || '', metin: ic.join('\n') });
      continue;
    }
    const h = s.match(RE_BASLIK);
    if (h) { out.push({ tur: 'baslik', seviye: h[1].length, metin: h[2] }); i++; continue; }
    if (RE_CIZGI.test(s)) { out.push({ tur: 'cizgi' }); i++; continue; }
    if (/^ {0,3}>/.test(s)) {
      const ic: string[] = [];
      while (i < L.length && L[i].trim() && /^ {0,3}>/.test(L[i])) ic.push(L[i++].replace(/^ {0,3}> ?/, ''));
      out.push({ tur: 'alinti', bloklar: bloklar(ic) });
      continue;
    }
    if (tabloSatiriMi(s) && i + 1 < L.length && RE_AYRAC.test(L[i + 1]) && L[i + 1].includes('-')) {
      const baslik = hucreler(s);
      const hiza: Hiza[] = hucreler(L[i + 1]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'orta' : c.endsWith(':') ? 'sag' : c.startsWith(':') ? 'sol' : null));
      i += 2;
      const satirlar: string[][] = [];
      while (i < L.length && L[i].trim() && tabloSatiriMi(L[i]) && !RE_BASLIK.test(L[i])) {
        const c = hucreler(L[i++]);
        while (c.length < baslik.length) c.push('');
        satirlar.push(c.slice(0, baslik.length));
      }
      out.push({ tur: 'tablo', baslik, hiza: baslik.map((_, j) => hiza[j] ?? null), satirlar });
      continue;
    }
    const m = s.match(RE_MADDE);
    if (m) {
      const [blok, son] = liste(L, i);
      out.push(blok);
      i = son;
      continue;
    }
    const para: string[] = [];
    while (i < L.length && L[i].trim() && !RE_BASLIK.test(L[i]) && !RE_CIT.test(L[i]) && !/^ {0,3}>/.test(L[i]) && !RE_CIZGI.test(L[i])
      && !(para.length && RE_MADDE.test(L[i]))
      && !(tabloSatiriMi(L[i]) && i + 1 < L.length && RE_AYRAC.test(L[i + 1]) && L[i + 1].includes('-'))) para.push(L[i++].trim());
    if (!para.length) para.push(L[i++].trim());
    out.push({ tur: 'paragraf', satirlar: para });
  }
  return out;
}

/** i'deki madde satırından başlayan listeyi okur; aynı girintideki aynı türden maddeler bir liste, daha içerdekiler alt blok. */
function liste(L: string[], i: number): [Blok, number] {
  const ilk = L[i].match(RE_MADDE)!;
  const g0 = girinti(L[i]);
  const sirali = /\d/.test(ilk[2]);
  const ogeler: Oge[] = [];
  while (i < L.length) {
    const s = L[i];
    const m = s.match(RE_MADDE);
    if (!m || girinti(s) !== g0 || /\d/.test(m[2]) !== sirali) break;
    let metin = m[3], tik: boolean | null = null;
    const t = metin.match(/^\[([ xX])\]\s+(.*)$/);
    if (t) { tik = t[1] !== ' '; metin = t[2]; }
    i++;
    // devam satırları ve iç içe içerik: maddeden daha içeride duran satırlar
    const ic: string[] = [];
    while (i < L.length) {
      const n = L[i];
      if (!n.trim()) {
        // boş satırdan sonra hâlâ içeride devam ediyorsa al
        if (i + 1 < L.length && L[i + 1].trim() && girinti(L[i + 1]) > g0) { ic.push(''); i++; continue; }
        break;
      }
      if (girinti(n) > g0) { ic.push(n); i++; continue; }
      if (!RE_MADDE.test(n) && !RE_BASLIK.test(n) && !tabloSatiriMi(n) && !/^ {0,3}>/.test(n) && !RE_CIZGI.test(n) && !ic.length) { metin += ' ' + n.trim(); i++; continue; }
      break;
    }
    const kes = ic.length ? Math.min(...ic.filter((x) => x.trim()).map(girinti)) : 0;
    const altSatirlar = ic.map((x) => x.slice(Math.min(kes, girinti(x))));
    // içerideki ilk satırlar madde değilse metnin devamıdır
    while (altSatirlar.length && altSatirlar[0].trim() && !RE_MADDE.test(altSatirlar[0]) && !tabloSatiriMi(altSatirlar[0]) && !RE_CIT.test(altSatirlar[0])) metin += ' ' + altSatirlar.shift()!.trim();
    ogeler.push({ metin, tik, alt: bloklar(altSatirlar) });
    while (i < L.length && !L[i].trim() && i + 1 < L.length && (L[i + 1].match(RE_MADDE) && girinti(L[i + 1]) === g0)) i++;
  }
  return [{ tur: 'liste', sirali, baslangic: sirali ? parseInt(ilk[2], 10) || 1 : 1, ogeler }, i];
}

const GUVENLI = /^(https?:\/\/|mailto:)/i;
const RE_SATIR = /`([^`]+)`|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|\[([^\]]+)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)|<((?:https?:\/\/|mailto:)[^\s>]+)>|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"])|(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?!\w)|(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w])|\\([\\`*_{}[\]()#+\-.!|~>])/g;

/** Satır içi biçim. */
export function satirIci(t: string, k0 = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = new RegExp(RE_SATIR.source, 'g');
  let i = 0, m: RegExpExecArray | null, k = k0;
  while ((m = re.exec(t))) {
    if (m.index > i) out.push(t.slice(i, m.index));
    const key = k++;
    if (m[1] != null) out.push(<code key={key}>{m[1]}</code>);
    else if (m[2] != null || m[3] != null) out.push(<strong key={key}>{satirIci(m[2] ?? m[3], key * 100)}</strong>);
    else if (m[4] != null) out.push(<del key={key}>{satirIci(m[4], key * 100)}</del>);
    else if (m[5] != null) out.push(GUVENLI.test(m[6]) ? <a key={key} href={m[6]} target="_blank" rel="noopener noreferrer">{satirIci(m[5], key * 100)}</a> : <Fragment key={key}>{satirIci(m[5], key * 100)}</Fragment>);
    else if (m[7] != null || m[8] != null) { const u = (m[7] ?? m[8])!; out.push(<a key={key} href={u} target="_blank" rel="noopener noreferrer">{u.replace(/^mailto:/, '')}</a>); }
    else if (m[9] != null || m[10] != null) out.push(<em key={key}>{satirIci(m[9] ?? m[10], key * 100)}</em>);
    else if (m[11] != null) out.push(m[11]);
    i = m.index + m[0].length;
  }
  if (i < t.length) out.push(t.slice(i));
  return out;
}

const HIZA: Record<string, 'left' | 'center' | 'right'> = { sol: 'left', orta: 'center', sag: 'right' };

function ciz(b: Blok, k: number): ReactNode {
  switch (b.tur) {
    case 'baslik': {
      const H = (`h${Math.min(6, b.seviye + 1)}`) as 'h2';
      return <H key={k}>{satirIci(b.metin)}</H>;
    }
    case 'paragraf':
      return <p key={k}>{b.satirlar.map((s, j) => <Fragment key={j}>{j ? <br /> : null}{satirIci(s)}</Fragment>)}</p>;
    case 'liste': {
      const ic = b.ogeler.map((o, j) => (
        <li key={j} className={o.tik != null ? 'gorev-maddesi' : undefined}>
          {o.tik != null && <input type="checkbox" checked={o.tik} disabled readOnly aria-label={o.tik ? 'Yapıldı' : 'Yapılmadı'} />}
          {satirIci(o.metin)}
          {o.alt.map(ciz)}
        </li>
      ));
      return b.sirali ? <ol key={k} start={b.baslangic !== 1 ? b.baslangic : undefined}>{ic}</ol> : <ul key={k}>{ic}</ul>;
    }
    case 'tablo':
      return (
        <div key={k} className="md-tablo" role="region" aria-label="Tablo" tabIndex={0}>
          <table>
            <thead><tr>{b.baslik.map((c, j) => <th key={j} scope="col" style={b.hiza[j] ? { textAlign: HIZA[b.hiza[j]!] } : undefined}>{satirIci(c)}</th>)}</tr></thead>
            <tbody>{b.satirlar.map((r, x) => <tr key={x}>{r.map((c, j) => <td key={j} style={b.hiza[j] ? { textAlign: HIZA[b.hiza[j]!] } : undefined}>{satirIci(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    case 'alinti':
      return <blockquote key={k}>{b.bloklar.map(ciz)}</blockquote>;
    case 'kod':
      return <pre key={k}><code>{b.metin}</code></pre>;
    case 'cizgi':
      return <hr key={k} />;
  }
}

export function Markdown({ metin, className = 'cikti-metin' }: { metin: string; className?: string }) {
  return <div className={className}>{ayristir(metin).map(ciz)}</div>;
}
