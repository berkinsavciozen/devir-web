import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { sorguIstemcisi } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { iconCloud } from '../../cizim/ekran';
import { C, planet, route, shareRing, ship, sparkle } from '../../cizim/ortak.js';
import { akisModeli, gunAy, gunAyHafta, saat, uyeRenkleri, yolCiz, kisaAd } from '../../cizim/yol.js';
import { adimAdi, akisAdi, ikiSatir, ozelEk } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { haritaCumlesi, useAkis } from './Galaksi';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const ajanMi = (ad: string, tip?: string) => tip === 'agent' || /agent|Claude/i.test(ad);

/** "1 g 13 sa", "5 sa", "40 dk" */
export function sureKisa(saatSayi: number | null | undefined): string {
  if (saatSayi == null) return '–';
  const dk = Math.round(saatSayi * 60);
  if (dk < 60) return `${Math.max(1, dk)} dk`;
  const g = Math.floor(dk / 1440), s = Math.floor((dk % 1440) / 60);
  return g ? `${g} g${s ? ` ${s} sa` : ''}` : `${s} sa`;
}

/** Engel metninin kısa hali: ilk yan cümle, en çok 60 karakter (§9-14). */
export function engelKisa(engel: string): string {
  const k = engel.split(/[;.]\s/)[0].replace(/[.;]$/, '').trim();
  return k.length <= 60 ? k : k.slice(0, 58).replace(/\s+\S*$/, '') + '…';
}
/** Engel metninde oturumdaki kişiden istenen iş: "Berkin'in fotoğrafları canvas'a eklemesi gerekiyor" → { emir: "Fotoğrafları canvas'a ekle", ad: "eklemeni" } */
export function istekBul(engel: string, ben: string): { emir: string; ad: string } | null {
  if (!ben) return null;
  const m = engel.match(new RegExp(`${ben}['’]?(?:n?[ıiuü]n)\\s+(.+?)\\s*(\\S+?)(me|ma)(si|sı)\\s+(?:gerekiyor|lazım|bekleniyor)`, 'i'));
  if (!m) return null;
  const nesne = m[1].trim(), kok = m[2], e = m[3];
  return { emir: (nesne ? nesne[0].toLocaleUpperCase('tr') + nesne.slice(1) + ' ' : '') + kok, ad: `${kok}${e}${e === 'me' ? 'ni' : 'nı'}` };
}

/** B4 cümlesi (durum + sahip + engel). */
export function adimCumlesi(a: any, ben: string): string {
  const sahip = kisaAd(a.sahip);
  if (a.durum === 'engelli' && a.engel) {
    const ist = istekBul(a.engel, ben);
    return ist ? `${engelKisa(a.engel)}; ${sahip} senin ${ist.ad} bekliyor.` : `${engelKisa(a.engel)}; ${sahip} bekliyor.`;
  }
  if (a.durum === 'hazir') return a.sahip === ben ? `Sıra sende; ${sureKisa(a.bekleme_saat)} bekliyor.` : `Sıra ${ozelEk(sahip, 'de')}; ${sureKisa(a.bekleme_saat)} bekliyor.`;
  if (a.durum === 'suruyor') return ajanMi(a.sahip, a.sahip_tip) ? `${sahip} üzerinde çalışıyor.` : a.sahip === ben ? 'Üzerinde çalışıyorsun.' : `${sahip} üzerinde çalışıyor.`;
  if (a.durum === 'tamam') return `${gunAy(Date.parse(a.durum_at))} günü bitti.`;
  if (a.durum === 'atlandi') return 'Bu adım atlandı.';
  const once = (a.bekledigi || []).filter((b: any) => !BITTI(b.durum)).map((b: any) => b.no);
  return once.length ? `${once.join(', ')}. adım bitince başlar.` : 'Sırası yakında gelir.';
}

/** Kişi bazında yazan olay sayısı (§3.4): durum, guncelleme, not, adim_eklendi; aktör agent ise araç. */
function isPayi(olaylar: any[]) {
  const p = new Map<string, number>();
  for (const e of olaylar || []) {
    if (!['durum', 'guncelleme', 'not', 'adim_eklendi'].includes(e.tip) || e.kim_tip === 'sistem') continue;
    const k = e.kim_tip === 'agent' ? e.arac || e.kim : e.kim;
    p.set(k, (p.get(k) || 0) + 1);
  }
  return [...p.entries()].sort((a, b) => b[1] - a[1]).map(([ad, n]) => ({ ad, n, agent: ajanMi(ad) }));
}

/** Geçişli bekleyenler */
function tuttuklari(adimlar: any[], no: number): number[] {
  const g: number[] = [], q = [no];
  while (q.length) { const x = q.shift()!; for (const b of adimlar) if ((b.bagimli || []).includes(x) && !g.includes(b.no) && !BITTI(b.durum)) { g.push(b.no); q.push(b.no); } }
  return g;
}

/** Olay başlığı (§5 B5) */
function olayBasligi(e: any): string {
  if (e.tip === 'durum') return e.kim_tip === 'sistem' && e.durum === 'hazir' ? 'Sırası geldi' : ({ suruyor: 'Başladı', engelli: 'Engel bildirdi', tamam: 'Bitti', atlandi: 'Atlandı', ertelendi: 'Ertelendi', hazir: 'Hazır' } as Record<string, string>)[e.durum] || 'Durum';
  return ({ guncelleme: 'İlerleme yazdı', not: 'Not', adim_eklendi: 'Adım eklendi', cikti: 'Çıktı ekledi' } as Record<string, string>)[e.tip] || 'Kayıt';
}
/** Olay metni: önek ve çıktı kısmı ayıklanır; çıktı hapı ayrı döner. */
function olayMetni(e: any): { metin: string; cikti: string | null } {
  let o = String(e.ozet || '');
  let cikti: string | null = null;
  const c = o.match(/·\s*çıktı:\s*([^:(]+?)(?::[^(]*)?(?:\([^)]*\))?\s*(?:—\s*(.+))?$/);
  if (c) { cikti = c[1].trim() + (c[2] ? ' · ' + c[2].trim() : ''); o = o.slice(0, c.index).trim(); }
  o = o.replace(/^ilerleme:\s*/i, '').replace(/^Adım \d+ (engelli|başladı|tamam|bitti|hazır|atlandı)[:;]?\s*/i, '').replace(/\s*·\s*sahip →.*$/, '').replace(/\s*\([^)]*\)/g, '');
  if (e.tip === 'durum' && e.durum !== 'engelli') o = '';
  const ilk = (e.tip === 'durum' ? o.split(/[;.]\s/)[0] : o.split(/\.\s/)[0]).trim().replace(/[.;]$/, '');
  return { metin: ilk ? ilk + '.' : '', cikti };
}

const SEKME_Y = { durum: 330, gecmis: 150 } as const;

export function Adim({ kod, no, ben }: { kod: string; no: number; ben: string }) {
  const akis = useAkis(kod);
  const q = useQuery({ queryKey: ['adim', kod, no], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`) });
  const [sekme, setSekme] = useState<'durum' | 'gecmis'>(() => (new URLSearchParams(location.search).get('sekme') === 'gecmis' ? 'gecmis' : 'durum'));
  const kapat = () => git(`/akis/${encodeURIComponent(kod)}`, { yerine: true });
  const d = akis.data, a = q.data?.adim;
  return (
    <>
      <AdimArka d={d} no={no} sheetY={SEKME_Y[sekme]} sahip={ben} />
      <AltSayfa acik kapat={kapat} baslik={a ? adimAdi(a) : 'Adım'} yukseklik={SEKME_Y[sekme]} duraklar={['orta', 'yuksek']} perdesiz>
        <div className="adim-panel">
          <Segment secenekler={['Durum', 'Geçmiş']} aktif={sekme === 'durum' ? 0 : 1} sec={(i) => setSekme(i ? 'gecmis' : 'durum')} />
          {!a || !d ? <div className="adim-yukleniyor" role="status" aria-label="Yükleniyor"><span /><span /></div>
            : sekme === 'durum' ? <AdimDurum a={a} d={d} ben={ben} kod={kod} /> : <AdimGecmis a={a} d={d} ben={ben} />}
        </div>
      </AltSayfa>
    </>
  );
}

/** İki parçalı seçici (44 px). */
export function Segment({ secenekler, aktif, sec }: { secenekler: string[]; aktif: number; sec: (i: number) => void }) {
  return (
    <div className="segment" role="tablist">
      {secenekler.map((s, i) => <button key={s} role="tab" aria-selected={i === aktif} className={i === aktif ? 'secili' : ''} onClick={() => sec(i)}>{s}</button>)}
    </div>
  );
}

/** Arka: harita %55, %38 koyu örtü; seçili gezegen ve bağları örtünün üstünde (§3.15). */
function AdimArka({ d, no, sheetY, sahip }: { d: any; no: number; sheetY: number; sahip: string }) {
  const cizim = useMemo(() => {
    if (!d) return '';
    const M = akisModeli(d, { sahip });
    const cy = sheetY > 200 ? 196 : 150, R = sheetY > 200 ? 120 : 100;
    const Y = yolCiz(M, { cx: 195, cy, R, ps: .7, now: simdi(), sel: no, selTop: true, labels: [] });
    return `<g opacity=".55">${Y.svg}</g><rect width="390" height="844" fill="#07051A" opacity=".38"/>` + (Y.secim || '');
  }, [d, no, sheetY, sahip]);
  const c = d ? haritaCumlesi(d) : null;
  return (
    <Sahne gok={{ tohum: 33, yildiz: 260 }} cizim={cizim} etiket={d ? akisAdi(d.akis) : 'Akış'}>
      <div aria-hidden style={{ opacity: .55 }}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={d ? akisAdi(d.akis) : ''} geri={() => history.back()} /></Kutu>
        {c && <Metin y={110} fs={17} lh={22} serif renk="ink2" style={{ whiteSpace: 'nowrap' }}>{ikiSatir(c.join(' ')).map((x, i) => <span key={i}>{i ? <br /> : null}{x}</span>)}</Metin>}
      </div>
    </Sahne>
  );
}

// Panel içi konumlar: alt sayfa üstünden (tasarımda y0 = sayfa üstü + 10); içerik tutamaç (28) ve seçiciden (44) sonra başlar.
const P = (y: number) => y - 72;

function AdimDurum({ a, d, ben, kod }: { a: any; d: any; ben: string; kod: string }) {
  const by = new Map<number, any>(d.adimlar.map((x: any) => [x.no, x]));
  const M = useMemo(() => akisModeli(d, { sahip: ben }), [d, ben]);
  const renk = useMemo(() => uyeRenkleri(yolCiz(M, { now: simdi(), lod: 'kucuk' }).G, ben), [M, ben]);
  const kritik = new Set<number>(d.kritik_yol || []);
  const tut = tuttuklari(d.adimlar, a.no);
  const ist = a.durum === 'engelli' && a.engel ? istekBul(a.engel, ben) : null;
  const cumle = ikiSatir(adimCumlesi(a, ben), 350, '16.5px Caladea');
  const durumGor = BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark';
  const sahipAjan = ajanMi(a.sahip, a.sahip_tip), sahipDis = !sahipAjan && a.sahip_tip === 'dis' && a.sahip !== ben;
  const y0 = 10;
  // zincir: bekleyen (Sen ya da sahip) → bu adım → tuttuğu (en çok 3)
  const ry = y0 + 372;
  const zincir = tut.slice(0, 3).map((n) => by.get(n));
  let svg = `<ellipse cx="195" cy="${y0 + 138}" rx="160" ry="70" fill="url(#${durumGor === 'block' ? 'glowCoral' : 'glowGold'})" opacity=".35"/>`;
  svg += planet(195, y0 + 142, 30, durumGor, { cloudGap: 10, karar: a.karar_adimi, waitRings: 2 });
  const pay = isPayi(a.olaylar);
  if (pay.length) svg += shareRing(195, y0 + 142, 44, pay, { br: 7.5, bead: 1.9 });
  svg += ship(116, y0 + 150, -8, sahipAjan ? 'agent' : sahipDis ? 'dis' : 'insan', sahipDis ? '' : kisaAd(a.sahip)[0], renk[a.sahip] || C.mint, 1.15, { flame: false });
  const chipRenk = ['#FF8A78', '#B9A6F2', '#FFD27A'];
  for (let i = 0; i < 3; i++) svg += `<rect x="${20 + i * 119}" y="${y0 + 276}" width="112" height="54" rx="18" fill="#FFFFFF" fill-opacity=".06" stroke="${chipRenk[i]}" stroke-opacity=".6"/>`;
  const basta = ist ? { ad: 'Sen', gemi: ship(46, ry, 0, 'insan', (ben[0] || 'S').toLocaleUpperCase('tr'), C.peach, 1.05, { flame: false }) } : null;
  if (basta) svg += basta.gemi + route([66, ry], [148, ry], { col: C.peach });
  svg += `<g transform="translate(166,${ry})">${durumGor === 'block' ? '<circle r="11" fill="url(#pBlock)"/><circle cx="4.5" cy="2" r="9" fill="#1A1238" opacity=".9"/>' : planet(0, 0, 11, durumGor, { life: false, waitRings: 1 })}<circle r="12" fill="none" stroke="${durumGor === 'block' ? '#FF8A78' : '#FFD27A'}" stroke-width="1.2"/></g>`;
  let onceki = 166, oncekiNo = a.no;
  zincir.forEach((z, i) => {
    const x = 228 + i * 56;
    const kr = kritik.has(z.no) && kritik.has(oncekiNo);
    svg += route([onceki + (i ? 12 : 14), ry], [x - 12, ry], kr ? { kind: 'critical' } : { col: C.peach });
    svg += planet(x, ry, 10, BITTI(z.durum) ? 'lit' : z.durum === 'engelli' ? 'block' : z.durum === 'hazir' ? 'wait' : 'dark', { life: false, karar: z.karar_adimi });
    onceki = x; oncekiNo = z.no;
  });
  const sayilar: [string, string][] = [
    [a.durum === 'engelli' || a.durum === 'hazir' || a.durum === 'suruyor' ? sureKisa(a.bekleme_saat) : BITTI(a.durum) ? gunAy(Date.parse(a.durum_at)) : '–', a.durum === 'engelli' ? 'engelli' : a.durum === 'hazir' ? 'bekliyor' : a.durum === 'suruyor' ? 'sürüyor' : a.durum_etiket || a.durum],
    [`${tut.length} adım`, 'tutuyor'],
    a.son_tarih ? [gunAy(Date.parse(a.son_tarih + 'T12:00:00+03:00')), 'son tarih'] : a.en_erken_bitis ? [gunAy(Date.parse(a.en_erken_bitis)), 'en erken'] : ['–', 'son tarih'],
  ];
  const benim = a.sahip === ben && !BITTI(a.durum);
  const bitir = useMutation({
    mutationFn: () => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${a.no}`, { durum: 'tamam' }),
    onSuccess: () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['akis', kod] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['adim', kod, a.no] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['ozet'] }); },
  });
  const claude = a.linkler?.claude;
  return (
    <div className="adim-durum">
      <svg className="panel-cizim" aria-hidden width="390" height="480" viewBox={`0 ${28} 390 480`} dangerouslySetInnerHTML={{ __html: svg }} />
      <Metin y={P(y0 + 218)} fs={24} lh={30} serif agirlik={700} hiza="orta" as="h2">{adimAdi(a)}</Metin>
      <Metin y={P(y0 + 244)} fs={16.5} lh={21} serif renk="ink2" hiza="orta" style={{ whiteSpace: 'nowrap' }}>{cumle.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>
      {sayilar.map(([b, k], i) => (
        <div key={k} className="sayi-kutusu" style={{ left: 20 + i * 119, top: P(y0 + 276) }}><b>{b}</b><small>{k}</small></div>
      ))}
      {basta && <Metin y={P(ry + 28)} x={26} fs={11.5} agirlik={700} style={{ width: 40, textAlign: 'center' }}>Sen</Metin>}
      {zincir.map((z, i) => <Metin key={z.no} y={P(ry + 28)} x={228 + i * 56 - 28} fs={11.5} agirlik={600} renk="ink2" style={{ width: 56, textAlign: 'center' }}>{adimAdi(z).split(' ')[0]}</Metin>)}
      <div className="adim-eylem" style={{ top: P(y0 + 414) }}>
        {benim ? (
          <>
            {claude && <Dugme tur="ikincil" ton="lila" yukseklik={54} onClick={() => window.open(claude, '_blank', 'noopener')}>Claude’da aç</Dugme>}
            <Dugme mesgul={bitir.isPending} onClick={() => (a.karar_adimi ? git(`/akis/${encodeURIComponent(kod)}/karar/${a.no}`) : bitir.mutate())}>{a.karar_adimi ? 'Kararı ver' : 'Bitti olarak işaretle'}</Dugme>
          </>
        ) : claude ? (
          <Dugme ikonX={106} kayma={10} onClick={() => window.open(claude, '_blank', 'noopener')}
            ikon={<svg aria-hidden width="40" height="30" viewBox="-20 -15 40 30" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -12, 'insan', '✦', '#E8738A', .75, { flame: false }) }} />}>Claude’da aç</Dugme>
        ) : null}
      </div>
      {bitir.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 474) }}>{(bitir.error as Error).message}</p>}
    </div>
  );
}

function Satir({ ikon, ust, baslik, metin, cikti, cizgi }: { ikon: string; ust: string; baslik: string; metin?: string; cikti?: string | null; cizgi?: 'kesik' | 'dolu' | null }) {
  return (
    <li className={`gecmis-satir ${cizgi ? 'cizgi-' + cizgi : ''}`}>
      <svg aria-hidden className="gecmis-ikon" width="28" height="28" viewBox="-14 -14 28 28" dangerouslySetInnerHTML={{ __html: ikon }} />
      <div>
        <small>{ust}</small>
        <b>{baslik}</b>
        {metin && <span>{metin}</span>}
        {cikti && <em className="cikti-hapi"><svg aria-hidden width="14" height="14" viewBox="0 0 14 14"><path d="M3,9 l4,-4 a3,3 0 0 1 4,4 l-6,6 a3,3 0 0 1 -4,-4" fill="none" stroke="currentColor" strokeWidth="1.4" transform="translate(0,-3)" /></svg>{cikti}</em>}
      </div>
    </li>
  );
}

const IKON = {
  gelecek: `<circle r="7" fill="#1A1238" stroke="#B9A6F2" stroke-width="1.4" stroke-dasharray="2 2"/>`,
  engel: `<circle r="10" fill="#150E33" stroke="#FF8A78" stroke-width="1.3"/>` + iconCloud(1, -2, .36),
  ilerleme: `<circle r="10" fill="#150E33" stroke="#B9A6F2" stroke-width="1.3"/><path d="M-4,3 L-1,-1 L2,1 L5,-4" stroke="#D9CCFF" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  hazir: `<circle r="10" fill="#150E33" stroke="#FFD27A" stroke-width="1.3"/>` + sparkle(0, 0, 5, '#FFE7A8', 1),
  bitti: `<circle r="10" fill="url(#pLit2)"/>`,
  not: `<circle r="10" fill="#150E33" stroke="#B9A6F2" stroke-width="1.3"/><path d="M-4,-3 H4 M-4,0 H4 M-4,3 H1" stroke="#D9CCFF" stroke-width="1.4" stroke-linecap="round"/>`,
};

function AdimGecmis({ a, d, ben }: { a: any; d: any; ben: string }) {
  const by = new Map<number, any>(d.adimlar.map((x: any) => [x.no, x]));
  const durumGor = BITTI(a.durum) ? 'lit' : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark';
  const ist = a.durum === 'engelli' && a.engel ? istekBul(a.engel, ben) : null;
  const sonraki = (a.bekleyen_adimlar || []).map((b: any) => by.get(b.no)).filter(Boolean)[0];
  const sirada: ReactNode[] = [];
  if (ist) sirada.push(<Satir key="sen" ikon={ship(0, 0, 0, 'insan', (ben[0] || 'S').toLocaleUpperCase('tr'), C.peach, .62, { flame: false })} ust={`Senden bekleniyor · ${sureKisa(a.bekleme_saat)}`} baslik={ist.emir} cizgi="kesik" />);
  else if (!BITTI(a.durum)) sirada.push(<Satir key="sahip" ikon={IKON.gelecek} ust={`${kisaAd(a.sahip)} · ${a.durum_etiket || a.durum}`} baslik={a.en_erken_bitis ? `En erken ${gunAyHafta(Date.parse(a.en_erken_bitis))} biter` : 'Tarihi belli değil'} cizgi="kesik" />);
  if (sonraki && !BITTI(a.durum)) sirada.push(<Satir key="sonraki" ikon={IKON.gelecek} ust={sonraki.en_erken_bitis ? `En erken ${gunAyHafta(Date.parse(sonraki.en_erken_bitis))} ${saat(Date.parse(sonraki.en_erken_bitis))}` : 'Sonra'} baslik={`${sonraki.ad} ${sonraki.sahip === ben ? 'sana' : ozelEk(kisaAd(sonraki.sahip), 'e')} gelir`} />);
  // yeniden eskiye; aynı anda (2 sn) yazılan durum + ilerleme: durum önce, ilerleme yalnız çıktı taşıyorsa ayrı satır
  const ham = (a.olaylar || []).filter((e: any) => e.tip !== 'okuma').map((e: any) => ({ ...e, _t: Date.parse(e.zaman) }));
  const olaylar = ham
    .filter((e: any) => !(e.tip === 'guncelleme' && !olayMetni(e).cikti && ham.some((x: any) => x.tip === 'durum' && Math.abs(x._t - e._t) < 2000)))
    .sort((x: any, y: any) => (Math.abs(x._t - y._t) < 2000 ? Number(y.tip === 'durum') - Number(x.tip === 'durum') : y._t - x._t));
  const ikonOf = (e: any) => e.tip === 'durum' ? (e.durum === 'engelli' ? IKON.engel : e.durum === 'suruyor' ? `<circle r="10" fill="#150E33" stroke="#B9A6F2" stroke-width="1.3"/>` + ship(0, 0, 0, e.kim_tip === 'agent' ? 'agent' : 'insan', (e.kim_tip === 'agent' ? e.arac || e.kim : e.kim || '?')[0], e.kim_tip === 'agent' ? C.lilac : C.peach, .42, { flame: false }) : e.durum === 'tamam' ? IKON.bitti : IKON.hazir) : e.tip === 'not' ? IKON.not : IKON.ilerleme;
  const kim = (e: any) => e.kim_tip === 'agent' ? e.arac || e.kim : e.kim;
  const sistemHazir = (e: any) => { const h = (a.bekledigi || []).filter((b: any) => b.durum === 'tamam').map((b: any) => adimAdi(by.get(b.no) || b)); return h.length ? `Sırası geldi; ${h.map((x: string, i: number) => (i || true) && /^[A-ZÇĞİÖŞÜ][^A-ZÇĞİÖŞÜ]*$/.test(x.split(' ')[0]) ? x[0].toLocaleLowerCase('tr') + x.slice(1) : x).join(', ').replace(/, ([^,]+)$/, ' ve $1')} hazır` : olayBasligi(e); };
  return (
    <div className="adim-gecmis">
      <div className="gecmis-baslik">
        <svg aria-hidden width="40" height="40" viewBox="-20 -20 40 40" dangerouslySetInnerHTML={{ __html: planet(0, 0, 13, durumGor, { cloudGap: 3, life: false }) }} />
        <div><h2>{adimAdi(a)}</h2><small>{kisaAd(a.sahip)} · {a.durum_etiket || a.durum}{a.son_tarih ? ` · son ${gunAy(Date.parse(a.son_tarih + 'T12:00:00+03:00'))}` : ''}</small></div>
      </div>
      {sirada.length > 0 && <><h3 className="bolum">SIRADA</h3><ol className="gecmis-liste gelecek">{sirada}</ol></>}
      <h3 className="bolum">GEÇMİŞ</h3>
      <ol className="gecmis-liste">
        {olaylar.map((e: any) => {
          const { metin, cikti } = olayMetni(e);
          const z = Date.parse(e.zaman);
          return <Satir key={e.id} ikon={ikonOf(e)} ust={`${gunAy(z)} ${saat(z)} · ${e.kim_tip === 'sistem' ? 'Devir' : kim(e)}`} baslik={e.kim_tip === 'sistem' && e.durum === 'hazir' ? sistemHazir(e) : olayBasligi(e)} metin={metin} cikti={cikti} cizgi="dolu" />;
        })}
      </ol>
      {olaylar.length >= 60 && <p className="gecmis-not">Son 60 kayıt gösteriliyor.</p>}
    </div>
  );
}

