import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { boyutYaz } from '../../api/dosya';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { planet } from '../../cizim/ortak.js';
import { gunAy, kisaAd } from '../../cizim/yol.js';
import { adimAdi, akisAdi, gunAyUzun } from '../../metin/turkce';
import { arama, git, tamAdres } from '../../yonlendirme';
import { Ok, SatirKart } from '../hesap/Hesap';
import { odakCumlesi } from './cumleler';
import { useAkis } from './Galaksi';
import { ilerleme } from '../../api/ilerleme';
import { GorevAdi } from '../../bilesen/Kirinti';

// Akış bilgisi (denetim bulgusu: haritada olmayan liste görünümü) ve kişi sayfası. Tasarımda ayrı ekranları yok;
// K satır kartlarıyla, B4'teki gezegen dilinde (CELISKILER 56).
const GOK = { tohum: 44, yildiz: 200 };
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const ajan = (a: { sahip: string; sahip_tip?: string }) => a.sahip_tip === 'agent' || /agent|Claude/i.test(a.sahip);
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const enc = encodeURIComponent;
const FILTRE = ['Hepsi', 'Açık', 'Sende', 'Engelli', 'Bitti', 'Karar', 'Çıktı'] as const;
const FILTRE_KOD = ['hepsi', 'acik', 'sende', 'engelli', 'bitti', 'karar', 'cikti'] as const;
export type AkisSuzgec = (typeof FILTRE_KOD)[number];
/** Eski sekme adresleri (?sekme=kararlar) süzgece düşer; kişiler şeritlerde ve menüde. */
const ESKI_SEKME: Record<string, AkisSuzgec> = { adimlar: 'hepsi', kararlar: 'karar', ciktilar: 'cikti', kisiler: 'hepsi' };
const SATIR = 66;

export const durumGor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark');
/** Satırda karar ve çıktı işaretleri (N17): bayrak = karar adımı, sayfa = çıktısı var (sayısıyla). */
export function AdimIsaretleri({ a }: { a: any }) {
  const karar = !!a.karar_adimi, cikti = a.cikti_sayisi > 0 || !!a.cikti_bekleniyor;
  if (!karar && !cikti) return <Ok />;
  return (
    <>
      <span className="satir-isaretler" aria-hidden>
        {karar && <svg width="14" height="18" viewBox="-7 -9 14 18"><title>Karar</title><path d="M-4,-8 V8" stroke="#FFF1E0" strokeWidth="1.4" /><path d="M-3,-8 L6,-4.5 L-3,-1Z" fill="#FFD27A" /></svg>}
        {cikti && <svg width="14" height="18" viewBox="-7 -9 14 18"><title>Çıktı</title><path d="M-5,-8 H2 L6,-4 V8 H-5Z" fill="#1A1238" stroke="#D9CCFF" strokeWidth="1.2" strokeLinejoin="round" /><path d="M-2,0 H3 M-2,3.5 H2" stroke="#B9A6F2" strokeWidth="1.1" strokeLinecap="round" /></svg>}
        {a.cikti_sayisi > 1 && <i>{a.cikti_sayisi}</i>}
      </span>
      <Ok />
    </>
  );
}
export const adimIkon = (a: any, h = 58) => a.ust_adim != null
  // alt görev: üstüne bağlı küçük uydu (W5, N24)
  ? `<g transform="translate(0,${h / 2 - 29})"><path d="M18,-8 V29 H30" fill="none" stroke="#8E80D6" stroke-width="1.2" opacity=".7"/>${planet(37, 29, 6, durumGor(a), { life: false, waitRings: 1, cloudGap: 1, karar: a.karar_adimi && !BITTI(a.durum) })}</g>`
  : `<g transform="translate(0,${h / 2 - 29})">${planet(28, 29, 10, durumGor(a), { life: false, waitRings: 1, cloudGap: 2, karar: a.karar_adimi && !BITTI(a.durum) })}</g>`;
/** "Berkin · hazır · en erken 21 Eki" */
export function adimAlt(a: any) {
  const t = BITTI(a.durum) ? (a.durum_at ? gunAy(Date.parse(a.durum_at)) : '') : a.en_erken_bitis ? `en erken ${gunAy(Date.parse(a.en_erken_bitis))}` : '';
  return [kisaAd(a.sahip), a.durum_etiket || a.durum, t].filter(Boolean).join(' · ');
}
const dosyaIkon = (h = 58) => `<g transform="translate(28,${h / 2})"><path d="M-8,-12 H4 L10,-6 V12 H-8Z" fill="#1A1238" stroke="#D9CCFF" stroke-width="1.3" stroke-linejoin="round"/><path d="M4,-12 V-6 H10" fill="none" stroke="#D9CCFF" stroke-width="1.3"/><path d="M-4,0 H6 M-4,5 H4" stroke="#B9A6F2" stroke-width="1.3" stroke-linecap="round"/></g>`;

/** Bir sütun satır kartı ve bölüm başlıkları; dönen y sonraki boş yer. */
/** girinti: alt görev satırı; grup: daraltılabilir üst görev (1.2) */
export type Oge = { tur: 'baslik'; metin: string } | { tur: 'satir'; key: string; ikon: string; ust: ReactNode; alt?: ReactNode; git?: () => void; etiket?: string; baslik?: string; sag?: ReactNode; girinti?: boolean; grup?: { acik: boolean; degis: () => void; ad: string } } | { tur: 'not'; metin: string };
export function Liste({ y0, ogeler, etiket }: { y0: number; ogeler: Oge[]; etiket: string }) {
  let y = y0;
  const out: ReactNode[] = [];
  ogeler.forEach((o, i) => {
    if (o.tur === 'baslik') { out.push(<h3 key={'b' + i} className="bolum-baslik" style={{ top: y + 6 }}>{o.metin}</h3>); y += 32; }
    else if (o.tur === 'not') { out.push(<Metin key={'n' + i} y={y + 18} fs={13.5} renk="ink3">{o.metin}</Metin>); y += 36; }
    else {
      out.push(<div role="listitem" key={o.key} style={{ display: 'contents' }}>
        <SatirKart y={y} x={o.girinti ? 34 : 20} sagPay={o.grup ? 72 : 20} ikon={o.ikon} ust={o.ust} alt={o.alt} onClick={o.git} etiket={o.etiket} baslik={o.baslik} sag={o.sag} />
        {o.grup && <button type="button" className="grup-ac" style={{ top: y + 7 }} aria-expanded={o.grup.acik} aria-label={`${o.grup.ad}: alt görevleri ${o.grup.acik ? 'daralt' : 'aç'}`} onClick={o.grup.degis}>
          <svg aria-hidden width="16" height="16" viewBox="-8 -8 16 16"><path d={o.grup.acik ? 'M-5,-2 L0,3 L5,-2' : 'M-2,-5 L3,0 L-2,5'} fill="none" stroke="#D9CCFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>}
      </div>);
      y += SATIR;
    }
  });
  return { dugum: <div role="list" aria-label={etiket}>{out}</div>, y };
}

/**
 * Akışın alt bölümü (madde 12, N16): şeritlerin altında tek adım listesi; Kararlar, Çıktılar ve Kişiler ayrı sekme değil.
 * Karar ve çıktı süzgeçleri o adımları (ve akışın geçerli kararlarını, dosyalarını) gösterir; satırda işaretleri var (N17).
 * Galaksi sayfasında haritanın altında, /akis/:kod/bilgi'de ve masaüstü panelde tek başına çizilir. y0: süzgecin üstü.
 */
export function useAkisBolumu({ d, kod, ben, y0, adres, en }: { d: any; kod: string; ben: string; y0: number; adres?: boolean; en?: number }) {
  const f0 = (() => { const q = arama(); const f = q.get('suz') as AkisSuzgec | null; return Math.max(0, FILTRE_KOD.indexOf(f && FILTRE_KOD.includes(f) ? f : ESKI_SEKME[q.get('sekme') || ''] || 'hepsi')); })();
  const [filtre, setFiltre] = useState(f0);
  // 1.2: daraltılan üst görevler (alt görevleri gizli)
  const [dar, setDar] = useState<Set<number>>(() => new Set());
  const dosyalar = useQuery({ queryKey: ['dosyalar', kod], queryFn: () => api.get<any>(`/akis/${enc(kod)}/dosyalar`), enabled: !!d && FILTRE_KOD[filtre] === 'cikti' });
  const sec = (s: AkisSuzgec | number) => { const i = typeof s === 'number' ? s : FILTRE_KOD.indexOf(s); setFiltre(i); if (adres) git(`/akis/${enc(kod)}/bilgi${i ? `?suz=${FILTRE_KOD[i]}` : ''}`, { yerine: true }); };
  if (!d) return { dugum: null, y: y0, sec, ad: 'Adımlar' };

  const A: any[] = [...d.adimlar].sort((a, b) => a.no - b.no);
  const ustOf = (a: any) => (a.ust_adim != null ? A.find((x) => x.no === a.ust_adim) : null);
  const altSay = (a: any) => { const k = A.filter((x) => x.ust_adim === a.no); return k.length ? ` · ${k.filter((x) => BITTI(x.durum)).length}/${k.length} alt görev` : ''; };
  const adimSatir = (a: any): Oge => ({ tur: 'satir', key: 'a' + a.no, ikon: adimIkon(a), ust: `${a.no}. ${adimAdi(a)}`, baslik: a.ad, alt: adimAlt(a) + altSay(a), sag: <AdimIsaretleri a={a} />,
    etiket: `${a.no}. ${ustOf(a) ? `alt görev (${ustOf(a).no}. ${adimAdi(ustOf(a))} görevinin)` : 'adım'}, ${a.ad}. ${adimAlt(a)}${altSay(a)}.${a.karar_adimi ? ' Karar adımı.' : ''}${a.cikti_sayisi ? ` ${a.cikti_sayisi} çıktı.` : ''}`, git: () => git(`/akis/${enc(kod)}/adim/${a.no}`) });
  const kod_ = FILTRE_KOD[filtre];
  const sayi: Partial<Record<AkisSuzgec, number>> = { karar: A.filter((a) => a.karar_adimi).length, cikti: A.filter((a) => a.cikti_sayisi > 0).length, engelli: A.filter((a) => a.durum === 'engelli').length };
  // süzgeç dar sütunda iki satıra iner (360'ta taşmaz); genişlik yazı boyundan kestirilir
  const etiketler = FILTRE.map((f, i) => `${f}${sayi[FILTRE_KOD[i]] ? ` ${sayi[FILTRE_KOD[i]]}` : ''}`);
  const sutun = en ?? Math.min(typeof window === 'undefined' ? 390 : window.innerWidth, 430) - 40;
  const iki = etiketler.reduce((t, e) => t + e.length * 7.6 + 30 + 6, 0) > sutun;
  const ust = (
    <div className={`filtre-satir${iki ? ' iki-satir' : ''}`} role="group" aria-label="Adımları süz" style={{ top: y0 }}>
      {etiketler.map((e, i) => <button key={FILTRE[i]} type="button" className="filtre-cip" aria-pressed={i === filtre} onClick={() => sec(i)}>{e}</button>)}
    </div>
  );
  const ly = y0 + (iki ? 108 : 58);
  let ogeler: Oge[] = [], zincir = false;
  if (kod_ === 'karar') {
    const K = A.filter((a) => a.karar_adimi);
    ogeler = K.map((a) => {
      const s = a.karar?.secim;
      const alt = BITTI(a.durum) ? `Verildi · ${gunAy(Date.parse(s?.at || a.durum_at))}${s?.kim || a.sahip ? ' · ' + kisaAd(s?.kim || a.sahip) : ''}` : adimAlt(a);
      return { ...adimSatir(a), alt } as Oge;
    });
    if (!K.length) ogeler.push({ tur: 'not', metin: 'Bu akışta karar adımı yok.' });
    const kural: any[] = (d.kararlar || []).filter((k: any) => k.durum !== 'iptal');
    if (kural.length) {
      ogeler.push({ tur: 'baslik', metin: 'GEÇERLİ KARARLAR' });
      for (const k of kural) ogeler.push({ tur: 'satir', key: 'k' + k.id, ikon: `<g transform="translate(28,29)"><path d="M-1,-11 V11" stroke="#FFF1E0" stroke-width="1.4"/><path d="M0,-11 L10,-7 L0,-3Z" fill="#FFD27A"/></g>`, ust: k.kisa || k.karar, alt: [k.kim, k.tarih ? gunAy(Date.parse(k.tarih)) : null].filter(Boolean).join(' · ') || undefined, etiket: `${k.karar}.` });
    }
  } else if (kod_ === 'cikti') {
    const F: any[] = (dosyalar.data?.dosyalar || []).slice().sort((a: any, b: any) => Date.parse(b.tarih) - Date.parse(a.tarih));
    if (dosyalar.isPending) ogeler.push({ tur: 'not', metin: 'Yükleniyor…' });
    const C = A.filter((a) => a.cikti_sayisi > 0);
    if (C.length) {
      ogeler.push({ tur: 'baslik', metin: 'ADIMLARA GÖRE' });
      for (const a of C) ogeler.push({ ...adimSatir(a), key: 'c' + a.no, alt: `${a.cikti_sayisi} çıktı · ${kisaAd(a.sahip)}`, git: () => git(`/akis/${enc(kod)}/adim/${a.no}?bolum=ciktilar`) } as Oge);
    }
    if (F.length) {
      ogeler.push({ tur: 'baslik', metin: 'DOSYALAR' });
      for (const f of F) ogeler.push({ tur: 'satir', key: 'f' + f.id, ikon: dosyaIkon(), ust: f.ad, alt: [f.tur_ad, boyutYaz(f.boyut), f.adim_no ? `${f.adim_no}. adım` : null].filter(Boolean).join(' · '), etiket: `${f.ad}, ${f.adim_no}. adımın çıktısı.`, git: f.adim_no ? () => git(`/akis/${enc(kod)}/adim/${f.adim_no}?bolum=ciktilar`) : undefined });
    }
    if (!dosyalar.isPending && !F.length && !C.length) ogeler.push({ tur: 'not', metin: 'Henüz çıktı yok.' });
  } else {
    const uy = [() => true, (a: any) => !BITTI(a.durum), (a: any) => a.sahip === ben && !BITTI(a.durum), (a: any) => a.durum === 'engelli', (a: any) => BITTI(a.durum)][filtre];
    // zincir: adımlar zaman sırasında (biten bitiş anına, açık en erken bitişine göre); aralarındaki ray bitenlerde yanar
    const L0 = A.filter(uy).sort((a, b) => adimAn(a) - adimAn(b) || a.no - b.no);
    // W5: alt görevler üstlerinin hemen altında (üstü süzgeçte yoksa kendi zaman yerinde)
    const var0 = new Set(L0.map((a) => a.no));
    const L = L0.filter((a) => a.ust_adim == null || !var0.has(a.ust_adim)).flatMap((a) => [a, ...(dar.has(a.no) ? [] : L0.filter((x) => x.ust_adim === a.no).sort((p, r) => p.no - r.no))]);
    zincir = L.length > 1;
    const degis = (no: number) => setDar((s) => { const y = new Set(s); if (y.has(no)) y.delete(no); else y.add(no); return y; });
    ogeler = L.length ? L.map((a): Oge => {
      const o = adimSatir(a) as Extract<Oge, { tur: 'satir' }>;
      // alt görev üstünün altında girintili; üstü süzgeçte yoksa kırıntıyla kendi yerinde
      if (a.ust_adim != null) return var0.has(a.ust_adim) ? { ...o, girinti: true } : { ...o, ust: <GorevAdi ad={`${a.no}. ${adimAdi(a)}`} ust={adimAdi(ustOf(a))} /> };
      return L0.some((x) => x.ust_adim === a.no) ? { ...o, grup: { acik: !dar.has(a.no), degis: () => degis(a.no), ad: adimAdi(a) } } : o;
    }) : [{ tur: 'not', metin: kod_ === 'sende' ? 'Sende açık adım yok.' : 'Bu süzgece uyan adım yok.' }];
  }
  const L = Liste({ y0: ly, ogeler, etiket: 'Adımlar' });
  // zincir rayı: ardışık satırların gezegenlerini bağlar (kartların arasından görünür)
  const satirSayisi = ogeler.filter((o) => o.tur === 'satir').length;
  const ray = zincir ? <svg aria-hidden className="zincir-ray" style={{ top: ly + 29, height: (satirSayisi - 1) * 66 }} width="4" viewBox={`0 0 4 ${(satirSayisi - 1) * 66}`} preserveAspectRatio="none" dangerouslySetInnerHTML={{ __html: (ogeler as any[]).slice(0, -1).map((o, i) => `<rect x="1" y="${i * 66}" width="2" height="66" fill="${zincirRenk(o)}"/>`).join('') }} /> : null;
  return {
    sec, ad: 'Adımlar', y: L.y,
    dugum: (
      <>
        {ust}
        {ray}
        {L.dugum}
      </>
    ),
  };
}
/** Zincir sırası: biten adım bitiş anına, açık adım en erken bitişine göre. */
const adimAn = (a: any) => (BITTI(a.durum) && a.durum_at ? Date.parse(a.durum_at) : a.en_erken_bitis ? Date.parse(a.en_erken_bitis) : Number.MAX_SAFE_INTEGER);
const zincirRenk = (o: any) => (/^a\d/.test(o.key) && o.ikon.includes('pLit') ? '#FFD27A' : '#6B5FB0');
/** Akış bilgisi sayfası (/akis/:kod/bilgi): haritanın altındaki bölümün tek başına hâli (bağlantılar ve geniş ekran için). */
export function AkisBilgi({ kod, ben }: { kod: string; ben: string }) {
  const q = useAkis(kod);
  const d = q.data;
  const ad = d ? akisAdi(d.akis) : 'Akış';
  const B = useAkisBolumu({ d, kod, ben, y0: 136, adres: true });
  const geri = () => (history.length > 1 ? history.back() : git(`/akis/${enc(kod)}`));
  if (!d) return <Sahne gok={GOK} etiket={ad}><Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={geri} /></Kutu>{q.isError && <Metin y={112} fs={16} renk="ink2">{(q.error as Error).message}</Metin>}</Sahne>;
  const A: any[] = d.adimlar;
  const i = ilerleme(A), eng = A.filter((a) => a.durum === 'engelli').length, atla = i.atlandi + i.ertelendi;
  const cumle = `${i.toplam} adım: ${i.tamam} tamam, ${i.toplam - i.tamam} açık${eng ? `, ${eng} engelli` : ''}${atla ? `; ${atla} atlandı` : ''}.`;
  return (
    <Sahne gok={GOK} etiket={`${ad} · ${B.ad}`} yukseklik={B.y + 40}>
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={geri} /></Kutu>
      <Metin y={110} fs={17} lh={22} serif renk="ink2" as="p" className="tek-satir">{cumle}</Metin>
      {B.dugum}
    </Sahne>
  );
}

/** Kişi sayfası: bu akışta kişinin adımları; haritada yolunu öne çıkarır (/akis/:kod/kisi/:ad). */
export function KisiSayfasi({ kod, ad, ben }: { kod: string; ad: string; ben: string }) {
  const q = useAkis(kod);
  const geri = () => (history.length > 1 ? history.back() : git(`/akis/${enc(kod)}`));
  const d = q.data;
  if (!d) return <Sahne gok={GOK} etiket={ad}><Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={geri} /></Kutu></Sahne>;
  const A: any[] = d.adimlar.filter((a: any) => a.sahip === ad || (a.ortak || []).includes?.(ad)).sort((a: any, b: any) => Number(BITTI(a.durum)) - Number(BITTI(b.durum)) || a.no - b.no);
  const acik = A.filter((a) => !BITTI(a.durum)).length;
  const cumle = odakCumlesi(d, ad) || (A.length ? `${A.length} adımdan ${acik} açık.` : 'Bu akışta adımı yok.');
  const ogeler: Oge[] = [];
  if (acik) ogeler.push({ tur: 'baslik', metin: 'AÇIK' });
  A.forEach((a, i) => {
    if (i === acik && i) ogeler.push({ tur: 'baslik', metin: 'BİTEN' });
    else if (i === 0 && !acik) ogeler.push({ tur: 'baslik', metin: 'BİTEN' });
    ogeler.push({ tur: 'satir', key: 'a' + a.no, ikon: adimIkon(a), ust: `${a.no}. ${adimAdi(a)}`, baslik: a.ad, alt: adimAlt(a).split(' · ').slice(1).join(' · ') || undefined, etiket: `${a.no}. adım, ${a.ad}. ${adimAlt(a)}.`, git: () => git(`/akis/${enc(kod)}/${a.karar_adimi ? 'karar' : 'adim'}/${a.no}`) });
  });
  const L = Liste({ y0: 160, ogeler, etiket: `${ad} adımları` });
  const by = L.y + 12;
  return (
    <Sahne gok={GOK} etiket={`${ad} · ${akisAdi(d.akis)}`} yukseklik={by + 54 + 40}>
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad === ben ? `${ad} (sen)` : ad} geri={geri} /></Kutu>
      <Metin y={110} fs={17} lh={22} serif renk="ink2" as="p" style={{ right: 20 }}>{cumle}</Metin>
      {L.dugum}
      <Dugme style={{ top: by }} onClick={() => git(`/akis/${enc(kod)}?odak=${enc(ad)}`)}>Haritada yolunu göster</Dugme>
    </Sahne>
  );
}

/** Akışın kişileri: sunucunun sahip listesi (aynı ad türleri birleşir), yoksa adımlardan. */
export function akisKisileri(d: any): { ad: string; tip: 'insan' | 'agent' | 'dis'; acik: number; adim: number }[] {
  const A: any[] = d.adimlar;
  const S0: any[] = d.sahipler?.length ? d.sahipler : [...new Set(A.map((a) => a.sahip))].map((ad) => ({ ad, tip: A.find((a) => a.sahip === ad).sahip_tip, adimlar: A.filter((a) => a.sahip === ad).map((a) => a.no), acik: A.filter((a) => a.sahip === ad && !BITTI(a.durum)).length }));
  const S: any[] = [];
  for (const k of S0) {
    const o = S.find((x) => x.ad.toLocaleLowerCase('tr') === k.ad.toLocaleLowerCase('tr'));
    if (!o) S.push({ ...k, adimlar: [...k.adimlar] });
    else { o.adimlar.push(...k.adimlar); o.acik += k.acik; }
  }
  return S.map((k) => ({ ad: k.ad, tip: k.tip === 'agent' || ajan({ sahip: k.ad, sahip_tip: k.tip }) ? 'agent' : k.tip === 'dis' ? 'dis' : 'insan', acik: k.acik, adim: k.adimlar.length }));
}

/** Akış menüsü (etkin akış, "…"): listeyi karar ya da çıktıya süzer, bağlantı, kişiler (kişi sayfası). */
/** Üç nokta menüsü: bağlantı ve kişiler. Liste süzgeci haritanın altındaki listede (plan 27 Eki, 2.6). */
export function AkisMenusu({ kod, kapat, d }: { kod: string; kapat: () => void; d: any }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const kopyala = async () => { try { await navigator.clipboard.writeText(tamAdres(`/akis/${enc(kod)}`)); setKopyalandi(true); } catch { setKopyalandi(false); } };
  const K = akisKisileri(d);
  return (
    <div className="akis-menu-liste">
      <h2 className="gorunmez">Akış menüsü</h2>
      <button type="button" className="akis-menu-satir dugmeli" onClick={() => void kopyala()}><b>{kopyalandi ? 'Bağlantı kopyalandı' : 'Bağlantıyı kopyala'}</b><small>{d.akis.hedef_tarih ? `Hedef ${gunAyUzun(tarihMs(d.akis.hedef_tarih))}` : akisAdi(d.akis)}</small></button>
      <h3 className="akis-menu-baslik">KİŞİLER</h3>
      <div role="list" aria-label="Kişiler">
        {K.map((k) => <button key={k.ad} role="listitem" type="button" className="akis-menu-satir dugmeli" onClick={() => { kapat(); git(`/akis/${enc(kod)}/kisi/${enc(k.ad)}`); }}><b>{k.ad}</b><small>{k.tip === 'agent' ? 'agent · ' : k.tip === 'dis' ? 'dış · ' : ''}{k.acik} açık · {k.adim} adım</small></button>)}
      </div>
    </div>
  );
}
