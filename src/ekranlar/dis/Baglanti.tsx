import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { boyutYaz, dosyaDenetle, dosyaYukle, KABUL_UZANTI, turOf } from '../../api/dosya';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { CarpiIkon, CopIkon, DosyaSatiri, YukleIkon } from '../../bilesen/DosyaSatiri';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { KararSeridi } from '../../bilesen/KararSeridi';
import { Ikon } from '../../bilesen/Svg';
import { iconCloud, logoIsaret } from '../../cizim/ekran';
import { akisModeli, gunAy, yolCiz } from '../../cizim/yol.js';
import { C, f, planet, rng, ship, sparkle } from '../../cizim/ortak.js';
import { adimAdi, adimEtiketi, doluSatir, gunAyUzun, ozelEk, tarihEk } from '../../metin/turkce';
import { Segment } from '../akis/Adim';
import { git } from '../../yonlendirme';

const GOK_F1 = { tohum: 47, yildiz: 240, bulutsu: [[60, 300, 260, 'neb2'], [360, 200, 220, 'neb1'], [200, 760, 260, 'neb3']] as [number, number, number, string][] };
const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const kisiAdi = (s: string) => s.replace(/\s*\(.*\)$/, '');
const bekleme = (h: number) => (h >= 24 ? `${Math.floor(h / 24)} g ${Math.round(h % 24)} sa` : `${Math.max(1, Math.round(h))} sa`);

/** Kişinin sıradaki işi: eylemlerinde "tamam" olan ilk adım; yoksa bitmemiş ilk adım. */
const simdikiOf = (adimlar: any[]) => adimlar.find((a) => a.eylemler?.includes('tamam')) || adimlar.find((a) => !BITTI(a.durum)) || null;

/** Adımın sırasının geleceği an: bağlı olduğu adımların bitişi (biten: durum_at; açık: en erken bitiş). */
function sirasiGelir(h: any, no: number): number | null {
  const a = h?.adimlar?.find((x: any) => x.no === no); if (!a) return null;
  const ts = (a.bagimli || []).map((n: number) => { const d = h.adimlar.find((x: any) => x.no === n); return d ? Date.parse(BITTI(d.durum) ? d.durum_at : d.en_erken_bitis) : NaN; }).filter(Number.isFinite);
  return ts.length ? Math.max(...ts) : null;
}

/** Üst satır: logo, Devir, kişi hapı. */
function UstSatir({ kisi }: { kisi?: string }) {
  return (
    <>
      <Kutu x={17} y={45} w={26} h={26} aria-hidden><Ikon svg={logoIsaret()} w={26} /></Kutu>
      <Metin y={63} x={52} fs={14} agirlik={700} style={{ right: 'auto' }}>Devir</Metin>
      {kisi && <span className="hap dis-kisi-hap" style={{ top: 48.5 }}>{kisiAdi(kisi).split(' ')[0]}</span>}
    </>
  );
}

/** F · Dış katılımcının bağlantı sayfası (/l/:token): yalnız kendi adımları, dört eylem, teslim (§5 F1–F4). */
export function Baglanti({ token, onizleme }: { token: string; onizleme?: { id: string; kod: string } }) {
  const qc = useQueryClient();
  // eski biçim (/l/<belirteç>): adres çubuğunda belirteç # parçasına taşınır, paylaşılırsa da loglara düşmez (N-3)
  useEffect(() => {
    const ek = '/l/' + encodeURIComponent(token);
    if (location.pathname.endsWith(ek)) history.replaceState(null, '', location.pathname.slice(0, -ek.length) + '/l' + location.search + '#' + encodeURIComponent(token));
  }, [token]);
  // önizleme (P1-C): sahip katılımcının göreceğini görür; açılış sayılmaz, düğmeler çalışmaz
  const anahtar = onizleme ? 'o:' + onizleme.id : token;
  const q = useQuery({ queryKey: ['baglanti', anahtar], queryFn: () => (onizleme ? api.get<any>(`/katilimci/${encodeURIComponent(onizleme.id)}/onizleme`) : api.baglanti.get<any>(token)), retry: (n, e) => !(e instanceof ApiHatasi && (e.durum === 404 || e.durum === 410)) && n < 1 });
  const [secili, setSecili] = useState<number | null>(null);
  const [sayfa, setSayfa] = useState<null | 'teslim' | 'engel' | 'not'>(null);
  const [tesekkur, setTesekkur] = useState<{ no: number; v: any } | null>(null);
  const NOW = simdi();
  const v = q.data;
  const adimlar: any[] = v?.adimlar || [];
  const simdiki = simdikiOf(adimlar);
  const a = adimlar.find((x) => x.no === secili) || simdiki || adimlar[0] || null;

  const eylem = useMutation({
    mutationFn: (g: any) => (onizleme ? Promise.reject(new Error('Önizlemede düğmeler çalışmaz.')) : api.baglanti.post<any>(token, { no: a!.no, ...g })),
    onSuccess: (r, g) => { qc.setQueryData(['baglanti', anahtar], r); setSayfa(null); if (g.eylem === 'tamam') setTesekkur({ no: a!.no, v: r }); },
  });

  const cizim = useMemo(() => {
    if (!v?.harita || !v.kisi) return '';
    const h = v.harita, detay = { akis: { olusturuldu: h.olusturuldu, hedef_tarih: h.hedef_tarih || v.akis.hedef_tarih, kapandi_at: h.kapandi_at }, kritik_yol: h.kritik_yol, adimlar: h.adimlar, olaylar: [] };
    const etiket = a && !BITTI(a.durum) ? [[a.no, adimEtiketi(a), 0, 26, '#FFE6B0', '#FFD27A']] : [];
    try { return yolCiz(akisModeli(detay), { cx: 195, cy: 302, R: 122, ps: .7, now: NOW, focus: v.kisi, sis: true, ip: false, fener: false, kuleEtiket: false, labels: etiket }).svg; } catch { return ''; }
  }, [v, a, NOW]);

  if (q.isPending) return <Sahne gok={GOK_F1} etiket="Devir"><UstSatir /></Sahne>;
  if (q.isError) return <GecersizBaglanti ag={!(q.error instanceof ApiHatasi && (q.error.durum === 404 || q.error.durum === 410))} suresi={q.error instanceof ApiHatasi && q.error.durum === 410 ? q.error.message : undefined} yeniden={() => void q.refetch()} />;
  if (tesekkur) return <Tesekkur v={tesekkur.v} no={tesekkur.no} kapat={() => setTesekkur(null)} bak={(no) => { setSecili(no); setTesekkur(null); }} />;

  // cümle: "{adım} {hazır tarihi}'den beri sende; son tarih {son_tarih}." (yoksa API özeti)
  let cumle: string = v.ozet;
  if (a && a.durum === 'hazir' && a.durum_at) cumle = `${adimAdi(a)} ${tarihEk(gunAyUzun(a.durum_at), 'den')} beri sende${a.son_tarih ? `; son tarih ${gunAyUzun(a.son_tarih)}` : ''}.`;
  else if (a && a.durum === 'suruyor') cumle = `${adimAdi(a)} sende sürüyor${a.son_tarih ? `; son tarih ${gunAyUzun(a.son_tarih)}` : ''}.`;
  const satir = doluSatir(cumle, 350, '20px Caladea', 5);
  const kart = 430, b1 = kart + 108, b2 = b1 + 68, b3 = b2 + 68;
  const ey: string[] = a?.eylemler || [];
  const beklemede = a && !BITTI(a.durum) && !ey.includes('tamam');
  const digerleri = adimlar.filter((x) => x.no !== a?.no && !BITTI(x.durum));
  const sonraki = digerleri.sort((x, y) => (sirasiGelir(v.harita, x.no) ?? 0) - (sirasiGelir(v.harita, y.no) ?? 0))[0];
  let svg = cizim;
  if (a) {
    svg += `<rect x="16" y="${kart}" width="358" height="332" rx="28" fill="url(#sheet)" stroke="#FFC9A3" stroke-opacity=".35"/>`;
    svg += planet(62, kart + 52, 20, BITTI(a.durum) ? 'lit' : a.durum === 'engelli' ? 'block' : 'wait', { waitRings: 2 });
  }
  if (sonraki) {
    svg += `<rect x="16" y="774" width="358" height="46" rx="23" fill="#120B2C" fill-opacity=".7" stroke="#FFFFFF" stroke-opacity=".08"/>`;
    svg += planet(42, 797, 7, 'dark', { life: false }) + `<circle cx="58" cy="797" r="4" fill="#2A2452" stroke="#8E80D6"/><circle cx="70" cy="797" r="4" fill="#2A2452" stroke="#8E80D6"/>`;
    svg += `<path d="M352,791 L358,797 L352,803" stroke="#B9A6F2" stroke-width="1.7" fill="none" stroke-linecap="round"/>`;
  }
  const alt = a ? (BITTI(a.durum) ? `${a.durum_etiket || 'Bitti'}${a.durum_at ? ' · ' + gunAy(Date.parse(a.durum_at)) : ''}`
    : beklemede && a.bekledigi?.length ? `Önce ${a.bekledigi.map((x: any) => x.ad).join(', ')} bitmeli`
    : [a.son_tarih ? `Son ${gunAy(Date.parse(a.son_tarih + 'T12:00:00+03:00'))}` : null, a.bekleme_saat ? `${bekleme(a.bekleme_saat)} ${a.durum === 'engelli' ? 'engelli' : 'bekliyor'}` : null].filter(Boolean).join(' · ')) : '';
  const hata = eylem.isError ? (eylem.error as Error).message : null;
  const ac = (x: 'teslim' | 'engel' | 'not') => { if (!onizleme) setSayfa(x); };

  return (
    <>
      <Sahne gok={GOK_F1} cizim={svg} etiket={v.akis?.baslik || 'Devir'}>
        <UstSatir kisi={v.kisi} />
        <Metin y={116} fs={20} lh={26} serif as="h1" style={{ fontWeight: 400, whiteSpace: 'nowrap' }}>{satir.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}</Metin>
        <KararSeridi oz={v.akis?.karar_ozeti} style={{ left: 20, right: 20, top: 104 + satir.length * 26 }} />
        {a && <>
          <Metin y={kart + 48} x={100} fs={21} lh={26} serif agirlik={700} as="h2" className="tek-satir" style={{ right: 32 }}>{a.ad}</Metin>
          <Metin y={kart + 70} x={100} fs={12.5} lh={16} renk="ink3" className="tek-satir" style={{ right: 32 }}>{alt}</Metin>
          {ey.includes('basladim') && (
            <Dugme yukseklik={56} fs={17} style={{ top: b1, left: 36, right: 36 }} ikonX={74} mesgul={eylem.isPending && eylem.variables?.eylem === 'basladim'} disabled={!!onizleme} onClick={() => eylem.mutate({ eylem: 'basladim' })}
              ikon={<svg aria-hidden width="40" height="40" viewBox="-20 -20 40 40" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -10, 'dis', '', '#E8738A', .7) }} />}>Başladım</Dugme>
          )}
          {ey.includes('tamam') && (
            <Dugme tur="ikincil" ton="altin" yukseklik={52} fs={16} style={{ top: ey.includes('basladim') ? b2 : b1, left: 36, right: 36 }} ikonX={84} onClick={() => ac('teslim')} disabled={!!onizleme}
              ikon={<svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><circle r="9" fill="url(#pLit2)" /><path d="M-4,0 L-1,3 L4,-3" stroke="#2A1D4F" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>}>Tamam</Dugme>
          )}
          {ey.includes('engel') && (
            <Dugme tur="ikincil" ton="mercan" yukseklik={48} style={{ top: b3, left: 36, right: 201 }} ikonX={32} kayma={10} onClick={() => ac('engel')} disabled={!!onizleme}
              ikon={<svg aria-hidden width="24" height="24" viewBox="-12 -12 24 24" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: iconCloud(0, -2, .5) }} />}>Engel var</Dugme>
          )}
          {ey.includes('not') && (
            <Dugme tur="ikincil" ton="lila" yukseklik={48} style={ey.length === 1 ? { top: b1, left: 36, right: 36 } : { top: b3, left: 201, right: 36 }} ikonX={ey.length === 1 ? undefined : 31} kayma={ey.length === 1 ? 0 : 10} onClick={() => ac('not')} disabled={!!onizleme}
              ikon={<svg aria-hidden width="16" height="20" viewBox="-8 -10 16 20"><path d="M-5,6 L-5,-4 Q-5,-8 -1,-8 Q3,-8 3,-4 L3,4 Q3,6 1,6 Q-1,6 -1,4 L-1,-3" stroke="#D9CCFF" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>}>Not ekle</Dugme>
          )}
          {hata && !sayfa && <p className="canli-hata" role="alert" style={{ top: b3 + 60 }}>{hata}</p>}
        </>}
        {!a && <Metin y={520} fs={17} lh={22} serif renk="ink2" hiza="orta">Bu bağlantıda sana atanmış bir adım görünmüyor.</Metin>}
        {onizleme && <div className="onizleme-serit" role="status"><span>Önizleme · {kisiAdi(v.kisi)} bağlantıyı açınca bunu görür</span><button type="button" onClick={() => (history.length > 1 ? history.back() : git(`/akis/${encodeURIComponent(onizleme.kod)}`))}>Kapat</button></div>}
        {sonraki && (
          <Kutu as="button" x={16} y={774} w={358} h={46} className="dis-sonra" onClick={() => setSecili(sonraki.no)} aria-label={`Sonra: ${sonraki.ad}`}>
            Sonra: {adimAdi(sonraki)}{digerleri.length > 1 ? ` · +${digerleri.length - 1} adım` : ''}
          </Kutu>
        )}
      </Sahne>
      {a && sayfa === 'teslim' && <Teslim token={token} a={a} kapat={() => setSayfa(null)} gonder={(g) => eylem.mutate({ eylem: 'tamam', ...g })} mesgul={eylem.isPending} hata={hata} />}
      {a && (sayfa === 'engel' || sayfa === 'not') && <KisaMetin tur={sayfa} a={a} kapat={() => setSayfa(null)} gonder={(metin) => eylem.mutate({ eylem: sayfa, metin })} mesgul={eylem.isPending} hata={hata} />}
    </>
  );
}

interface YerelDosya { ad: string; tur: string; boyut: number; yuzde: number; id?: string; hata?: string; iptal?: () => void }

/** F2 · Teslim et: Bağlantı / Metin / Dosya (dosya varsayılan); çıktısız bitirmek de olur. */
function Teslim({ token, a, kapat, gonder, mesgul, hata }: { token: string; a: any; kapat: () => void; gonder: (g: any) => void; mesgul: boolean; hata: string | null }) {
  const [tur, setTur] = useState(2);
  const [url, setUrl] = useState(''), [ad, setAd] = useState(''), [metin, setMetin] = useState(''), [not, setNot] = useState('');
  const [dosya, setDosya] = useState<YerelDosya | null>(null);
  const girdi = useRef<HTMLInputElement>(null);
  const y0 = 286, P = (y: number) => y - (y0 + 28);
  const sec = (fs: FileList | null) => {
    const fl = fs?.[0]; if (!fl) return;
    const h = dosyaDenetle(fl);
    const d: YerelDosya = { ad: fl.name, tur: turOf(fl), boyut: fl.size, yuzde: 0, hata: h || undefined };
    setDosya(d);
    if (h) return;
    const y = dosyaYukle({ yol: '', dosya: fl, ilerle: (p) => setDosya((x) => (x && x.ad === fl.name ? { ...x, yuzde: p } : x)), iste: (g) => api.baglanti.dosya(token, { no: a.no, ...(g as object) }) });
    setDosya({ ...d, iptal: y.iptal });
    y.bitti.then((r) => setDosya((x) => (x && x.ad === fl.name ? { ...x, yuzde: 1, id: r.dosya_id } : x)))
      .catch((e: Error) => setDosya((x) => (e.message === 'iptal' ? null : x ? { ...x, hata: e.message === 'Dosya yüklenemedi; bağlantı kopmuş olabilir.' ? 'Yükleme yarıda kaldı.' : e.message } : x)));
  };
  const yukleniyor = !!dosya && !dosya.hata && !dosya.id;
  const urlGecerli = /^https?:\/\/\S+$/i.test(url.trim());
  const hazir = tur === 0 ? urlGecerli : tur === 1 ? metin.trim().length >= 3 : !!dosya?.id;
  const teslim = () => {
    if (tur === 0) gonder({ cikti: { ad: ad.trim() || adimAdi(a), url: url.trim() } });
    else if (tur === 1) gonder({ cikti: { ad: ad.trim() || adimAdi(a), icerik: metin.trim(), ozet: metin.trim().slice(0, 200) } });
    else gonder({ cikti: { dosya: dosya!.id, ozet: not.trim() || null } });
  };
  const butonY = P(y0 + 336);
  return (
    <AltSayfa acik kapat={kapat} baslik="Teslim et" yukseklik={y0} duraklar={['orta', 'yuksek']}>
      <form className="karar-panel" style={{ height: butonY + 56 + 12 + 48 + 40 }} onSubmit={(e) => { e.preventDefault(); if (hazir) teslim(); }}>
        <Metin y={P(y0 + 54)} fs={24} lh={28} serif agirlik={700} as="h2">Teslim et</Metin>
        <Metin y={P(y0 + 76)} fs={13} lh={16} renk="ink3" className="tek-satir">{a.ad}</Metin>
        <div className="dis-segment" style={{ top: P(y0 + 94) }}><Segment secenekler={['Bağlantı', 'Metin', 'Dosya']} aktif={tur} sec={setTur} /></div>
        {tur === 0 && <>
          <label className="dis-alan" style={{ top: P(y0 + 172) - 21 }}><span className="alan-etiket">Bağlantı</span><input className="alan" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
          <label className="dis-alan" style={{ top: P(y0 + 252) - 21 }}><span className="alan-etiket">Ad (isteğe bağlı)</span><input className="alan" value={ad} onChange={(e) => setAd(e.target.value)} /></label>
          {url.trim() && !urlGecerli && <p className="dis-ipucu mercan" style={{ top: P(y0 + 310) }}>Bağlantı http ya da https ile başlamalı.</p>}
        </>}
        {tur === 1 && <>
          <label className="dis-alan" style={{ top: P(y0 + 172) - 21 }}><span className="alan-etiket">Metin</span><textarea className="alan" rows={3} value={metin} onChange={(e) => setMetin(e.target.value)} placeholder="Ne teslim ettiğini yaz" /></label>
        </>}
        {tur === 2 && <>
          <input ref={girdi} type="file" accept={KABUL_UZANTI} hidden onChange={(e) => { sec(e.target.files); e.target.value = ''; }} aria-label="Dosya seç" />
          {!dosya ? (
            <button type="button" className="dis-birak" style={{ top: P(y0 + 156) }} onClick={() => girdi.current?.click()}>
              <span className="dis-birak-ikon"><YukleIkon /></span>
              <b>Dosya seç</b>
              <small>PDF, görsel, Office, CSV ya da metin · en çok 20 MB</small>
            </button>
          ) : (
            <ul className="dosya-listesi dis-dosya" style={{ top: P(y0 + 156) }}>
              {dosya.hata ? <DosyaSatiri ad={dosya.ad} tur={dosya.tur} hal="hata" alt={dosya.hata} eylemler={[{ ad: `Kaldır: ${dosya.ad}`, ikon: <CarpiIkon />, tikla: () => setDosya(null) }]} />
                : dosya.id ? <DosyaSatiri ad={dosya.ad} tur={dosya.tur} hal="hazir" alt={`${dosya.ad.split('.').pop()?.toUpperCase()} · ${boyutYaz(dosya.boyut)} · yüklendi`} eylemler={[{ ad: `Kaldır: ${dosya.ad}`, ikon: <CopIkon />, ton: 'mercan', tikla: () => setDosya(null) }]} />
                : <DosyaSatiri ad={dosya.ad} tur={dosya.tur} hal="yukleniyor" yuzde={dosya.yuzde} alt={`%${Math.round(dosya.yuzde * 100)} · ${boyutYaz(dosya.boyut * dosya.yuzde).replace(' MB', '')} / ${boyutYaz(dosya.boyut)}`} eylemler={[{ ad: `İptal: ${dosya.ad}`, ikon: <CarpiIkon />, tikla: () => dosya.iptal?.() }]} />}
            </ul>
          )}
          {dosya?.hata ? <>
            <p className="dis-ipucu" style={{ top: P(y0 + 244) - 13 }}>{/yarıda/.test(dosya.hata) ? 'Bağlantın koptu; yeniden dene.' : `${dosya.boyut >= 1e6 ? Math.round(dosya.boyut / 1e6) + ' MB' : boyutYaz(dosya.boyut)} seçildi. Küçült ya da bağlantı olarak ekle.`}</p>
            <Dugme type="button" tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: P(y0 + 262) }} ikonX={98} kayma={10} ikon={<YukleIkon />} onClick={() => girdi.current?.click()}>{/yarıda/.test(dosya.hata) ? 'Yeniden dene' : 'Başka dosya seç'}</Dugme>
          </> : dosya && (
            <label className="dis-alan" style={{ top: P(y0 + 254) - 21 }}><span className="alan-etiket">Kısa not (isteğe bağlı)</span><input className="alan" value={not} onChange={(e) => setNot(e.target.value)} placeholder="Ne gönderdiğini bir cümleyle yaz" /></label>
          )}
        </>}
        <Dugme type="submit" yukseklik={56} fs={16.5} style={{ top: butonY }} disabled={!hazir || yukleniyor} mesgul={mesgul} ikonX={88}
          ikon={yukleniyor ? undefined : <svg aria-hidden width="20" height="20" viewBox="-10 -10 20 20"><circle r="9" fill="#2A1D4F" /><path d="M-4,0 L-1,3 L4,-3" stroke="#FFC9A3" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>}>
          {yukleniyor ? 'Yükleniyor…' : 'Teslim et ve bitir'}
        </Dugme>
        <Dugme type="button" tur="ikincil" ton="lila" yukseklik={48} fs={14.5} style={{ top: butonY + 68 }} onClick={kapat}>Vazgeç</Dugme>
        {!hazir && !dosya && tur !== 0 && tur !== 1 && <button type="button" className="metin-dugme dis-ciktisiz" style={{ top: butonY + 124 }} onClick={() => gonder({})} disabled={mesgul}>Çıktısız bitir</button>}
        {hata && <p className="canli-hata" role="alert" style={{ top: butonY + 160 }}>{hata}</p>}
      </form>
    </AltSayfa>
  );
}

/** Engel ya da not: tek alan. */
function KisaMetin({ tur, a, kapat, gonder, mesgul, hata }: { tur: 'engel' | 'not'; a: any; kapat: () => void; gonder: (m: string) => void; mesgul: boolean; hata: string | null }) {
  const [m, setM] = useState('');
  const y0 = 430, P = (y: number) => y - (y0 + 28);
  return (
    <AltSayfa acik kapat={kapat} baslik={tur === 'engel' ? 'Engel var' : 'Not ekle'} yukseklik={y0} duraklar={['orta', 'yuksek']}>
      <form className="karar-panel" style={{ height: 330 }} onSubmit={(e) => { e.preventDefault(); if (m.trim()) gonder(m.trim()); }}>
        <Metin y={P(y0 + 54)} fs={24} lh={28} serif agirlik={700} as="h2">{tur === 'engel' ? 'Engel var' : 'Not ekle'}</Metin>
        <Metin y={P(y0 + 76)} fs={13} lh={16} renk="ink3" className="tek-satir">{a.ad}</Metin>
        <label className="dis-alan" style={{ top: P(y0 + 100) }}><span className="gorunmez">{tur === 'engel' ? 'Ne bekliyorsun?' : 'Not'}</span>
          <textarea className="alan" rows={3} value={m} onChange={(e) => setM(e.target.value)} placeholder={tur === 'engel' ? 'Ne bekliyorsun? Kısaca yaz' : 'Ekibe kısa bir not'} autoFocus /></label>
        <Dugme type="submit" tur={tur === 'engel' ? 'ikincil' : 'birincil'} ton="mercan" yukseklik={tur === 'engel' ? 52 : 54} style={{ top: P(y0 + 210) }} disabled={!m.trim()} mesgul={mesgul}>{tur === 'engel' ? 'Engeli bildir' : 'Notu gönder'}</Dugme>
        {hata && <p className="canli-hata" role="alert" style={{ top: P(y0 + 274) }}>{hata}</p>}
      </form>
    </AltSayfa>
  );
}

/** F3 · Teşekkür ve yanma anı. */
function Tesekkur({ v, no, kapat, bak }: { v: any; no: number; kapat: () => void; bak: (no: number) => void }) {
  const a = v.adimlar.find((x: any) => x.no === no);
  const sira = v.adimlar.filter((x: any) => !BITTI(x.durum));
  const sonraki = sira.find((x: any) => x.eylemler?.includes('tamam')) || sira.sort((x: any, y: any) => (sirasiGelir(v.harita, x.no) ?? 0) - (sirasiGelir(v.harita, y.no) ?? 0))[0];
  const cizim = useMemo(() => {
    let s = `<circle cx="195" cy="270" r="190" fill="url(#bloom)"/><circle cx="195" cy="270" r="96" fill="url(#bloom)" opacity=".9"/>`;
    const rr = rng(5);
    for (let i = 0; i < 28; i++) { const t = rr() * Math.PI * 2, d = 70 + rr() * 90, L = 8 + rr() * 22; s += `<line x1="${f(195 + Math.cos(t) * d)}" y1="${f(270 + Math.sin(t) * d)}" x2="${f(195 + Math.cos(t) * (d + L))}" y2="${f(270 + Math.sin(t) * (d + L))}" stroke="#FFE7B8" stroke-width="${f(1 + rr())}" stroke-linecap="round" opacity="${f(.4 + rr() * .5)}"/>`; }
    for (let i = 0; i < 8; i++) s += sparkle(195 + Math.cos(i * .8) * (110 + i * 6), 270 + Math.sin(i * .8) * (90 + i * 5), 4 + (i % 3) * 2, '#FFF1D6', 1);
    s += `<g class="yanma">${planet(195, 270, 52, 'lit', { ring: true })}</g>` + ship(110, 330, -18, 'dis', '', C.peach, 1.2);
    if (sonraki) s += `<rect x="16" y="528" width="358" height="118" rx="22" fill="#120B2C" fill-opacity=".72" stroke="#FFC9A3" stroke-opacity=".3"/>` + planet(54, 600, 15, 'dark', { life: false });
    return s;
  }, [sonraki]);
  const ilk = kisiAdi(v.kisi).split(' ')[0];
  const sahip = v.akis?.sahip;
  const gelir = sonraki ? sirasiGelir(v.harita, sonraki.no) : null;
  const sonrakiAlt = sonraki ? (sonraki.eylemler?.includes('tamam') ? 'Sırası geldi' : gelir ? `Sırası ${tarihEk(gunAy(gelir), 'de')} gelir` : 'Sırası gelince açılır') + (sonraki.son_tarih ? ` · son ${gunAy(Date.parse(sonraki.son_tarih + 'T12:00:00+03:00'))}` : '') : '';
  return (
    <Sahne gok={{ tohum: 47, yildiz: 260, bulutsu: [[195, 300, 300, 'neb1']] }} cizim={cizim} etiket="Teşekkürler">
      <UstSatir kisi={v.kisi} />
      <Metin y={420} fs={30} lh={36} serif agirlik={700} hiza="orta" as="h1">Teşekkürler {ilk}.</Metin>
      <Metin y={454} fs={18} lh={24} serif renk="ink2" hiza="orta">{a ? `${adimAdi(a)} teslim edildi;` : 'Teslim edildi;'}<br />{sahip ? `${ozelEk(sahip, 'in')} ekranında görünüyor.` : 'ekibin ekranında görünüyor.'}</Metin>
      {sonraki && <>
        <Metin y={556} x={36} fs={12} lh={16} agirlik={700} renk="ink3" style={{ letterSpacing: '.6px' }}>SIRADAKİ</Metin>
        <Metin y={596} x={84} fs={15} lh={19} agirlik={700} className="tek-satir">{adimAdi(sonraki)}</Metin>
        <Metin y={616} x={84} fs={12.5} lh={16} renk="ink3" className="tek-satir">{sonrakiAlt}</Metin>
        <Dugme style={{ top: 672 }} fs={16} onClick={() => bak(sonraki.no)}>Sıradakine bak</Dugme>
      </>}
      <Dugme tur="ikincil" ton="lila" fs={14.5} style={{ top: sonraki ? 738 : 600 }} onClick={kapat}>Kapat</Dugme>
    </Sahne>
  );
}

/** F4 · Geçersiz ya da yenilenmiş bağlantı (ağ hatasında aynı ekran, başka cümle). */
export function GecersizBaglanti({ ag, suresi, yeniden }: { ag?: boolean; suresi?: string; yeniden: () => void }) {
  const cizim = useMemo(() => {
    let s = `<rect width="390" height="844" fill="#07051A" opacity=".35"/><circle cx="195" cy="300" r="110" fill="url(#glowLilac)" opacity=".5"/>`;
    for (let i = 0; i < 9; i++) { const a0 = i * 40 + 6, a1 = a0 + 16, r = 92, p = (t: number) => [195 + Math.cos(t * Math.PI / 180) * r, 300 + Math.sin(t * Math.PI / 180) * r]; const [x0, y0] = p(a0), [x1, y1] = p(a1); s += `<path d="M${f(x0)},${f(y0)} A${r},${r} 0 0 1 ${f(x1)},${f(y1)}" fill="none" stroke="#8E80D6" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`; }
    s += planet(195, 300, 26, 'dark', { life: false }) + `<g opacity=".7">${ship(292, 236, 14, 'dis', '', '#B9A6F2', 1)}</g>`;
    return s;
  }, []);
  return (
    <Sahne gok={{ tohum: 13, yildiz: 160, parilti: 2 }} cizim={cizim} etiket="Bağlantı">
      <UstSatir />
      <Metin y={472} fs={26} lh={32} serif agirlik={700} hiza="orta" as="h1">{ag ? 'Şu an açılamadı.' : suresi ? 'Bu bağlantının süresi doldu.' : 'Bu bağlantı artık açılmıyor.'}</Metin>
      <Metin y={506} fs={17.5} lh={23} serif renk="ink2" hiza="orta">{ag ? <>Bağlantı kurulamadı;<br />biraz sonra yeniden dene.</> : suresi ? <>{suresi.replace(/; bağlantı.*$/, '.')}<br />Bir şey gerekirse gönderen kişiye yaz.</> : <>Gönderen kişi yeni bir bağlantı gönderdi ya da<br />bunu kapattı; yenisini ondan iste.</>}</Metin>
      <Dugme tur="ikincil" ton="lila" yukseklik={50} fs={15} style={{ top: 600 }} onClick={yeniden}>Yeniden dene</Dugme>
    </Sahne>
  );
}
