import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { boyutYaz } from '../../api/dosya';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { planet, ship } from '../../cizim/ortak.js';
import { gunAy, kisaAd } from '../../cizim/yol.js';
import { adimAdi, akisAdi, gunAyUzun } from '../../metin/turkce';
import { arama, git, tamAdres } from '../../yonlendirme';
import { SatirKart } from '../hesap/Hesap';
import { Segment } from './Adim';
import { odakCumlesi } from './cumleler';
import { useAkis } from './Galaksi';

// Akış bilgisi (denetim bulgusu: haritada olmayan liste görünümü) ve kişi sayfası. Tasarımda ayrı ekranları yok;
// K satır kartlarıyla, B4'teki gezegen dilinde (CELISKILER 56).
const GOK = { tohum: 44, yildiz: 200 };
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const ajan = (a: { sahip: string; sahip_tip?: string }) => a.sahip_tip === 'agent' || /agent|Claude/i.test(a.sahip);
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const enc = encodeURIComponent;
const SEKMELER = ['Adımlar', 'Kararlar', 'Çıktılar', 'Kişiler'] as const;
const SEKME_KOD = ['adimlar', 'kararlar', 'ciktilar', 'kisiler'] as const;
const FILTRE = ['Hepsi', 'Açık', 'Sende', 'Engelli', 'Bitti'] as const;
const SATIR = 66;

export const durumGor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark');
export const adimIkon = (a: any, h = 58) => `<g transform="translate(0,${h / 2 - 29})">${planet(28, 29, 10, durumGor(a), { life: false, waitRings: 1, cloudGap: 2, karar: a.karar_adimi && !BITTI(a.durum) })}</g>`;
/** "Berkin · hazır · en erken 21 Eki" */
export function adimAlt(a: any) {
  const t = BITTI(a.durum) ? (a.durum_at ? gunAy(Date.parse(a.durum_at)) : '') : a.en_erken_bitis ? `en erken ${gunAy(Date.parse(a.en_erken_bitis))}` : '';
  return [kisaAd(a.sahip), a.durum_etiket || a.durum, t].filter(Boolean).join(' · ');
}
const kisiIkon = (ad: string, tip: string, sahip: boolean, h = 58) => tip === 'dis'
  ? ship(28, h / 2 + 2, 0, 'dis', '', '#F2B8D8', .8)
  : ship(28, h / 2, -12, tip === 'agent' ? 'agent' : 'insan', (kisaAd(ad)[0] || '?').toLocaleUpperCase('tr'), sahip ? '#FFC9A3' : tip === 'agent' ? '#B9A6F2' : '#9EE6CF', .8, { flame: false });
const dosyaIkon = (h = 58) => `<g transform="translate(28,${h / 2})"><path d="M-8,-12 H4 L10,-6 V12 H-8Z" fill="#1A1238" stroke="#D9CCFF" stroke-width="1.3" stroke-linejoin="round"/><path d="M4,-12 V-6 H10" fill="none" stroke="#D9CCFF" stroke-width="1.3"/><path d="M-4,0 H6 M-4,5 H4" stroke="#B9A6F2" stroke-width="1.3" stroke-linecap="round"/></g>`;

/** Bir sütun satır kartı ve bölüm başlıkları; dönen y sonraki boş yer. */
export type Oge = { tur: 'baslik'; metin: string } | { tur: 'satir'; key: string; ikon: string; ust: ReactNode; alt?: ReactNode; git?: () => void; etiket?: string; sag?: ReactNode } | { tur: 'not'; metin: string };
export function Liste({ y0, ogeler, etiket }: { y0: number; ogeler: Oge[]; etiket: string }) {
  let y = y0;
  const out: ReactNode[] = [];
  ogeler.forEach((o, i) => {
    if (o.tur === 'baslik') { out.push(<h3 key={'b' + i} className="bolum-baslik" style={{ top: y + 6 }}>{o.metin}</h3>); y += 32; }
    else if (o.tur === 'not') { out.push(<Metin key={'n' + i} y={y + 18} fs={13.5} renk="ink3">{o.metin}</Metin>); y += 36; }
    else { out.push(<div role="listitem" key={o.key} style={{ display: 'contents' }}><SatirKart y={y} ikon={o.ikon} ust={o.ust} alt={o.alt} onClick={o.git} etiket={o.etiket} sag={o.sag} /></div>); y += SATIR; }
  });
  return { dugum: <div role="list" aria-label={etiket}>{out}</div>, y };
}

/** Akış bilgisi: Adımlar · Kararlar · Çıktılar · Kişiler (/akis/:kod/bilgi). */
export function AkisBilgi({ kod, ben }: { kod: string; ben: string }) {
  const q = useAkis(kod);
  const s0 = Math.max(0, SEKME_KOD.indexOf((arama().get('sekme') || 'adimlar') as any));
  const [sekme, setSekme] = useState(s0);
  const [filtre, setFiltre] = useState(0);
  const dosyalar = useQuery({ queryKey: ['dosyalar', kod], queryFn: () => api.get<any>(`/akis/${enc(kod)}/dosyalar`), enabled: sekme === 2 });
  const geri = () => (history.length > 1 ? history.back() : git(`/akis/${enc(kod)}`));
  const d = q.data;
  const ad = d ? akisAdi(d.akis) : 'Akış';
  const sec = (i: number) => { setSekme(i); git(`/akis/${enc(kod)}/bilgi?sekme=${SEKME_KOD[i]}`, { yerine: true }); };
  if (!d) return <Sahne gok={GOK} etiket={ad}><Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={geri} /></Kutu>{q.isError && <Metin y={112} fs={16} renk="ink2">{(q.error as Error).message}</Metin>}</Sahne>;

  const A: any[] = [...d.adimlar].sort((a, b) => a.no - b.no);
  const tm = A.filter((a) => BITTI(a.durum)).length, eng = A.filter((a) => a.durum === 'engelli').length;
  const cumle = `${A.length} adım: ${tm} tamam, ${A.length - tm} açık${eng ? `, ${eng} engelli` : ''}.`;
  const adimSatir = (a: any): Oge => ({ tur: 'satir', key: 'a' + a.no, ikon: adimIkon(a), ust: `${a.no}. ${adimAdi(a)}`, alt: adimAlt(a), etiket: `${a.no}. adım, ${a.ad}. ${adimAlt(a)}.`, git: () => git(`/akis/${enc(kod)}/${a.karar_adimi ? 'karar' : 'adim'}/${a.no}`) });

  let ogeler: Oge[] = [], y0 = 204, ust: ReactNode = null;
  if (sekme === 0) {
    const uy = [() => true, (a: any) => !BITTI(a.durum), (a: any) => a.sahip === ben && !BITTI(a.durum), (a: any) => a.durum === 'engelli', (a: any) => BITTI(a.durum)][filtre];
    const L = A.filter(uy);
    ust = (
      <div className="filtre-satir" role="group" aria-label="Süz" style={{ top: 198 }}>
        {FILTRE.map((f, i) => <button key={f} type="button" className="filtre-cip" aria-pressed={i === filtre} onClick={() => setFiltre(i)}>{f}</button>)}
      </div>
    );
    y0 = 256;
    ogeler = L.length ? L.map(adimSatir) : [{ tur: 'not', metin: filtre === 2 ? 'Sende açık adım yok.' : 'Bu süzgece uyan adım yok.' }];
  } else if (sekme === 1) {
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
  } else if (sekme === 2) {
    const F: any[] = (dosyalar.data?.dosyalar || []).slice().sort((a: any, b: any) => Date.parse(b.tarih) - Date.parse(a.tarih));
    if (dosyalar.isPending) ogeler.push({ tur: 'not', metin: 'Yükleniyor…' });
    if (F.length) {
      ogeler.push({ tur: 'baslik', metin: 'DOSYALAR' });
      for (const f of F) ogeler.push({ tur: 'satir', key: 'f' + f.id, ikon: dosyaIkon(), ust: f.ad, alt: [f.tur_ad, boyutYaz(f.boyut), f.adim_no ? `${f.adim_no}. adım` : null].filter(Boolean).join(' · '), etiket: `${f.ad}, ${f.adim_no}. adımın çıktısı.`, git: f.adim_no ? () => git(`/akis/${enc(kod)}/adim/${f.adim_no}?bolum=ciktilar`) : undefined });
    }
    const C = A.filter((a) => a.cikti_sayisi > 0);
    if (C.length) {
      ogeler.push({ tur: 'baslik', metin: 'ADIMLARA GÖRE' });
      for (const a of C) ogeler.push({ ...adimSatir(a), key: 'c' + a.no, alt: `${a.cikti_sayisi} çıktı · ${kisaAd(a.sahip)}`, git: () => git(`/akis/${enc(kod)}/adim/${a.no}?bolum=ciktilar`) } as Oge);
    }
    if (!dosyalar.isPending && !F.length && !C.length) ogeler.push({ tur: 'not', metin: 'Henüz çıktı yok.' });
  } else {
    const S0: any[] = d.sahipler?.length ? d.sahipler : [...new Set(A.map((a) => a.sahip))].map((ad) => ({ ad, tip: A.find((a) => a.sahip === ad).sahip_tip, adimlar: A.filter((a) => a.sahip === ad).map((a) => a.no), acik: A.filter((a) => a.sahip === ad && !BITTI(a.durum)).length }));
    // sunucu sahipleri türüyle ayırır (aynı kişi insan ve dış olarak); kişi sayfası adla açılır, burada da tek satır
    const S: any[] = [];
    for (const k of S0) {
      const o = S.find((x) => x.ad.toLocaleLowerCase('tr') === k.ad.toLocaleLowerCase('tr'));
      if (!o) S.push({ ...k, adimlar: [...k.adimlar] });
      else { o.adimlar.push(...k.adimlar); o.acik += k.acik; if (o.siradaki == null) o.siradaki = k.siradaki; }
    }
    const sahibi = A[0]?.sahip;
    ogeler = S.map((k) => {
      const tip = k.tip === 'agent' || ajan({ sahip: k.ad, sahip_tip: k.tip }) ? 'agent' : k.tip === 'dis' ? 'dis' : 'insan';
      const siradaki = k.siradaki != null ? A.find((a) => a.no === k.siradaki) : A.find((a) => a.sahip === k.ad && !BITTI(a.durum));
      const alt = `${k.acik} açık · ${k.adimlar.length} adım${siradaki ? ` · sırada ${adimAdi(siradaki)}` : ''}`;
      return { tur: 'satir', key: 'p' + k.ad, ikon: kisiIkon(k.ad, tip, k.ad === sahibi), ust: k.ad, alt, etiket: `${k.ad} (${tip === 'agent' ? 'agent' : tip === 'dis' ? 'dış katılımcı' : 'insan'}): ${alt}.`, git: () => git(`/akis/${enc(kod)}/kisi/${enc(k.ad)}`) } as Oge;
    });
  }
  const L = Liste({ y0, ogeler, etiket: SEKMELER[sekme] });
  return (
    <Sahne gok={GOK} etiket={`${ad} · ${SEKMELER[sekme]}`} yukseklik={L.y + 40}>
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={geri} /></Kutu>
      <Metin y={110} fs={17} lh={22} serif renk="ink2" as="p" className="tek-satir">{cumle}</Metin>
      <Kutu x={0} y={136} style={{ right: 0 }}><Segment secenekler={[...SEKMELER]} aktif={sekme} sec={sec} /></Kutu>
      {ust}
      {L.dugum}
    </Sahne>
  );
}

/** Kişi sayfası: bu akışta kişinin adımları; haritada yolunu öne çıkarır (/akis/:kod/kisi/:ad). */
export function KisiSayfasi({ kod, ad, ben }: { kod: string; ad: string; ben: string }) {
  const q = useAkis(kod);
  const geri = () => (history.length > 1 ? history.back() : git(`/akis/${enc(kod)}/bilgi?sekme=kisiler`));
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
    ogeler.push({ tur: 'satir', key: 'a' + a.no, ikon: adimIkon(a), ust: `${a.no}. ${adimAdi(a)}`, alt: adimAlt(a).split(' · ').slice(1).join(' · ') || undefined, etiket: `${a.no}. adım, ${a.ad}. ${adimAlt(a)}.`, git: () => git(`/akis/${enc(kod)}/${a.karar_adimi ? 'karar' : 'adim'}/${a.no}`) });
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

/** Akış menüsü (etkin akış, "…"): bilgi sekmeleri ve bağlantı. */
export function AkisMenusu({ kod, kapat, d }: { kod: string; kapat: () => void; d: any }) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const ac = (s: string) => { kapat(); git(`/akis/${enc(kod)}/bilgi?sekme=${s}`); };
  const A: any[] = d.adimlar;
  const satirlar: [string, string, string][] = [
    ['adimlar', 'Adımlar', `${A.length} adım, ${A.filter((a) => !BITTI(a.durum)).length} açık`],
    ['kararlar', 'Kararlar', `${A.filter((a) => a.karar_adimi).length} karar adımı`],
    ['ciktilar', 'Çıktılar', `${A.reduce((t, a) => t + (a.cikti_sayisi || 0), 0)} çıktı`],
    ['kisiler', 'Kişiler', `${new Set(A.map((a) => a.sahip)).size} kişi`],
  ];
  const kopyala = async () => { try { await navigator.clipboard.writeText(tamAdres(`/akis/${enc(kod)}`)); setKopyalandi(true); } catch { setKopyalandi(false); } };
  return (
    <div className="akis-menu-liste">
      <h2 className="gorunmez">Akış menüsü</h2>
      {satirlar.map(([s, b, k]) => <button key={s} type="button" className="akis-menu-satir dugmeli" onClick={() => ac(s)}><b>{b}</b><small>{k}</small></button>)}
      <button type="button" className="akis-menu-satir dugmeli" onClick={() => void kopyala()}><b>{kopyalandi ? 'Bağlantı kopyalandı' : 'Bağlantıyı kopyala'}</b><small>{d.akis.hedef_tarih ? `Hedef ${gunAyUzun(tarihMs(d.akis.hedef_tarih))}` : akisAdi(d.akis)}</small></button>
    </div>
  );
}
