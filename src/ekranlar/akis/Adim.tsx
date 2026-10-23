import { useMemo, useRef, useState, type ReactNode, type KeyboardEvent as RKeyboardEvent } from 'react';
import { boyutYaz, dosyaDenetle, dosyaIndir, dosyaSil, dosyaYukle, KABUL_UZANTI, turOf } from '../../api/dosya';
import { BaglantiIkon, CarpiIkon, CopIkon, DisAcIkon, DosyaSatiri, IndirIkon, YukleIkon } from '../../bilesen/DosyaSatiri';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { sorguIstemcisi } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { iconCloud } from '../../cizim/ekran';
import { C, ship, sparkle } from '../../cizim/ortak.js';
import { akisModeli, gunAy, gunAyHafta, saat, yolCiz, kisaAd } from '../../cizim/yol.js';
import { adimAdi, akisAdi, ikiSatir, ozelEk } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { haritaCumlesi, useAkis } from './Galaksi';
import { GorevDetay } from './GorevDetay';

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
export function isPayi(olaylar: any[]) {
  const p = new Map<string, number>();
  for (const e of olaylar || []) {
    if (!['durum', 'guncelleme', 'not', 'adim_eklendi'].includes(e.tip) || e.kim_tip === 'sistem') continue;
    const k = e.kim_tip === 'agent' ? e.arac || e.kim : e.kim;
    p.set(k, (p.get(k) || 0) + 1);
  }
  return [...p.entries()].sort((a, b) => b[1] - a[1]).map(([ad, n]) => ({ ad, n, agent: ajanMi(ad) }));
}

/** Geçişli bekleyenler */
/** Takvim ihlali (P1-E madde 10): en erken bitiş son tarihi aşıyor; tarih kendiliğinden taşınmaz. */
export const takvimIhlali = (a: any) => !!a.gec_risk && !!a.en_erken_bitis && !BITTI(a.durum);
/** Üçüncü sayı kutusu: son tarih; ihlalde altında en erken bitiş. */
export function tarihSayisi(a: any): [string, string] {
  if (!a.son_tarih) return a.en_erken_bitis ? [gunAy(Date.parse(a.en_erken_bitis)), 'en erken'] : ['–', 'son tarih'];
  return [gunAy(Date.parse(a.son_tarih + 'T12:00:00+03:00')), takvimIhlali(a) ? `en erken ${gunAy(Date.parse(a.en_erken_bitis))}` : 'son tarih'];
}
export const IHLAL_IPUCU = 'Takvim ihlali: bekledikleri ve süresiyle bu adım son tarihinden sonra biter.';

export function tuttuklari(adimlar: any[], no: number): number[] {
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

// görev alt sayfası ekranın en çok %60'ı (N20): tasarım karesinde üst kenar 844 − 0.6 × 844 ≈ 338; sürüklenince büyümez
export const GOREV_SAYFA_Y = 338;

/** Telefonda görev: üstte akışın haritası, altta tek görev detayı (W2). Masaüstünde aynı detay akış panelinde açılır. */
export function Adim({ kod, no, ben }: { kod: string; no: number; ben: string }) {
  const akis = useAkis(kod);
  const q = useQuery({ queryKey: ['adim', kod, no], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`) });
  const kapat = () => git(`/akis/${encodeURIComponent(kod)}`, { yerine: true });
  const a = q.data?.adim;
  return (
    <>
      <AdimArka d={akis.data} no={no} sheetY={GOREV_SAYFA_Y} sahip={ben} />
      <AltSayfa acik kapat={kapat} baslik={a ? adimAdi(a) : 'Görev'} yukseklik={GOREV_SAYFA_Y} duraklar={[GOREV_SAYFA_Y]} perdesiz>
        <GorevDetay kod={kod} no={no} ben={ben} />
      </AltSayfa>
    </>
  );
}

interface YerelYukleme { anahtar: string; ad: string; tur: string; boyut: number; yuzde: number; hata?: string; iptal?: () => void }

/** ÇIKTILAR (§5 B8): kayıtlı dosyalar (İndir, Sil), yüklenenler (%, İptal), bağlantılar (Aç), "Dosya ekle". */
export function Ciktilar({ a, kod }: { a: any; kod: string }) {
  const dosyalar = useQuery({ queryKey: ['dosyalar', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/dosyalar`) });
  const [yerel, setYerel] = useState<YerelYukleme[]>([]);
  const [silinecek, setSilinecek] = useState<any | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);
  const kok = useRef<HTMLElement>(null);
  const byId = new Map<string, any>((dosyalar.data?.dosyalar || []).map((x: any) => [x.id, x]));
  const tazele = () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['adim', kod, a.no] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['dosyalar', kod] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['akis', kod] }); };
  const guncelle = (k: string, p: Partial<YerelYukleme>) => setYerel((L) => L.map((x) => (x.anahtar === k ? { ...x, ...p } : x)));
  const sec = (fs: FileList | null) => {
    if (!fs) return;
    for (const f of Array.from(fs)) {
      const anahtar = `${f.name}-${f.size}-${Math.random()}`;
      const h = dosyaDenetle(f);
      setYerel((L) => [...L, { anahtar, ad: f.name, tur: turOf(f), boyut: f.size, yuzde: 0, hata: h || undefined }]);
      if (h) continue;
      sira.ekle(() => {
        const y = dosyaYukle({
          yol: `/akis/${encodeURIComponent(kod)}/adim/${a.no}/dosya`, dosya: f, ilerle: (p) => guncelle(anahtar, { yuzde: p }),
          teslim: (id) => api.post(`/akis/${encodeURIComponent(kod)}/adim/${a.no}`, { cikti: { dosya: id, ozet: f.name } }),
        });
        guncelle(anahtar, { iptal: y.iptal });
        return y.bitti.then(() => { setYerel((L) => L.filter((x) => x.anahtar !== anahtar)); tazele(); })
          .catch((e: Error) => { if (e.message === 'iptal') setYerel((L) => L.filter((x) => x.anahtar !== anahtar)); else guncelle(anahtar, { hata: e.message }); });
      });
    }
  };
  const saatOf = (t: string) => saat(Date.parse(t));
  const claude = a.linkler?.claude;
  // dosyalar önce (yeniden eskiye), sonra bağlantı ve metin çıktıları
  const ciktilar = ((a.ciktilar || []) as any[]).slice().sort((x, y) => Number(!!y.dosya_id) - Number(!!x.dosya_id) || Date.parse(y.tarih) - Date.parse(x.tarih));
  return (
    <section ref={kok} className="ciktilar" aria-label="Çıktılar">
      <h3 className="bolum">ÇIKTILAR</h3>
      <ul className="dosya-listesi">
        {[...ciktilar.filter((c) => c.dosya_id), null, ...ciktilar.filter((c) => !c.dosya_id)].map((c) => {
          if (c === null) return yerel.map((y) => y.hata
            ? <DosyaSatiri key={y.anahtar} ad={y.ad} tur={y.tur} hal="hata" alt={y.hata} eylemler={[{ ad: `Kaldır: ${y.ad}`, ikon: <CarpiIkon />, tikla: () => setYerel((L) => L.filter((x) => x.anahtar !== y.anahtar)) }]} />
            : <DosyaSatiri key={y.anahtar} ad={y.ad} tur={y.tur} hal="yukleniyor" yuzde={y.yuzde} alt={`%${Math.round(y.yuzde * 100)} · ${boyutYaz(y.boyut * y.yuzde).replace(' MB', '')} / ${boyutYaz(y.boyut)}`} eylemler={[{ ad: `İptal: ${y.ad}`, ikon: <CarpiIkon />, tikla: () => y.iptal?.() }]} />);
          const d = c.dosya_id ? byId.get(c.dosya_id) : null;
          if (c.dosya_id) return (
            <DosyaSatiri key={c.id} ad={c.ad} tur={d?.tur} alt={[d?.tur_ad || 'dosya', d ? boyutYaz(d.boyut) : null, c.kim, saatOf(c.tarih)].filter(Boolean).join(' · ')}
              eylemler={[{ ad: `İndir: ${c.ad}`, ikon: <IndirIkon />, tikla: () => void dosyaIndir(c.dosya_id).catch((e) => setHata(e.message)) }, { ad: `Sil: ${c.ad}`, ikon: <CopIkon />, ton: 'mercan', tikla: () => setSilinecek({ ...c, d }) }]} />
          );
          if (/silindi/.test(c.kaynak || '')) return <DosyaSatiri key={c.id} ad={c.ad} hal="silindi" alt={`Dosya silindi · ${gunAy(Date.parse(c.tarih))}`} />;
          if (c.url) return (
            <DosyaSatiri key={c.id} ad={c.ad} ikon={<BaglantiIkon />} alt={['bağlantı', c.arac || c.kim, gunAy(Date.parse(c.tarih))].filter(Boolean).join(' · ')}
              eylemler={[{ ad: `Aç: ${c.ad}`, ikon: <DisAcIkon />, tikla: () => window.open(c.url, '_blank', 'noopener') }]} />
          );
          return <DosyaSatiri key={c.id} ad={c.ad} ikon={<BaglantiIkon />} alt={['metin', c.arac || c.kim, gunAy(Date.parse(c.tarih))].filter(Boolean).join(' · ')} />;
        })}
      </ul>
      {hata && <p className="canli-hata-satir" role="alert">{hata}</p>}
      <p className="bilgi-satiri"><svg aria-hidden width="16" height="16" viewBox="-8 -8 16 16"><circle r="7" fill="none" stroke="currentColor" strokeWidth="1.4" /><rect x="-.8" y="-1" width="1.6" height="4.6" fill="currentColor" /><circle cy="-3.4" r=".9" fill="currentColor" /></svg>En çok 20 MB: PDF, görsel, Office, CSV, metin.</p>
      <input ref={girdi} type="file" multiple accept={KABUL_UZANTI} hidden onChange={(e) => { sec(e.target.files); e.target.value = ''; }} aria-label="Dosya seç" />
      <Dugme className="statik" ikon={<YukleIkon />} ikonX={130} kayma={12} onClick={() => girdi.current?.click()}>Dosya ekle</Dugme>
      {claude && <Dugme className="statik" tur="ikincil" ton="lila" yukseklik={48} fs={15} onClick={() => window.open(claude, '_blank', 'noopener')}>Claude’da aç</Dugme>}
      <DosyaSilOnay dosya={silinecek} kapat={() => setSilinecek(null)} bitti={() => { setSilinecek(null); tazele(); }} />
    </section>
  );
}

/** En çok 3 eşzamanlı yükleme. */
const sira = (() => {
  let calisan = 0; const bekleyen: Array<() => Promise<unknown>> = [];
  const dene = () => { while (calisan < 3 && bekleyen.length) { const is = bekleyen.shift()!; calisan++; void is().finally(() => { calisan--; dene(); }); } };
  return { ekle: (is: () => Promise<unknown>) => { bekleyen.push(is); dene(); } };
})();

/** B9 · güçlü onay: tek dosya silme. */
function DosyaSilOnay({ dosya, kapat, bitti }: { dosya: any | null; kapat: () => void; bitti: () => void }) {
  const sil = useMutation({ mutationFn: () => dosyaSil(dosya.dosya_id), onSuccess: bitti });
  return (
    <AltSayfa acik={!!dosya} kapat={kapat} guclu baslik="Bu dosya silinsin mi?" yukseklik={482}>
      {dosya && (
        <div className="onay-sayfa" role="alertdialog" aria-labelledby="dosya-sil-baslik">
          <h2 id="dosya-sil-baslik">Bu dosya silinsin mi?</h2>
          <ul className="dosya-listesi"><DosyaSatiri ad={dosya.ad} tur={dosya.d?.tur} alt={[dosya.d?.tur_ad || 'dosya', dosya.d ? boyutYaz(dosya.d.boyut) : null, dosya.kim].filter(Boolean).join(' · ')} /></ul>
          <p className="onay-cumle">Dosya kalıcı olarak silinir; çıktı kaydı kalır.</p>
          {sil.isError && <p className="canli-hata-satir" role="alert">{(sil.error as Error).message}</p>}
          <Dugme className="statik" tur="tehlike" ikon={<CopIkon />} kayma={10} mesgul={sil.isPending} onClick={() => sil.mutate()}>Sil</Dugme>
          <Dugme className="statik" tur="ikincil" ton="lila" yukseklik={48} fs={15} autoFocus onClick={() => history.back()}>Vazgeç</Dugme>
        </div>
      )}
    </AltSayfa>
  );
}

/** İki parçalı seçici (44 px). */
export function Segment({ secenekler, aktif, sec }: { secenekler: string[]; aktif: number; sec: (i: number) => void }) {
  return (
    <div className="segment" role="tablist">
      {secenekler.map((s, i) => <button key={s} type="button" role="tab" aria-selected={i === aktif} className={i === aktif ? 'secili' : ''} onClick={() => sec(i)}>{s}</button>)}
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
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={d ? akisAdi(d.akis) : ''} geri={() => history.back()} sagBos={96} /></Kutu>
        {c && <Metin y={110} fs={17} lh={22} serif renk="ink2" style={{ whiteSpace: 'nowrap' }}>{ikiSatir(c.join(' ')).map((x, i) => <span key={i}>{i ? <br /> : null}{x}</span>)}</Metin>}
      </div>
    </Sahne>
  );
}

function Satir({ ikon, ust, baslik, metin, cikti, cizgi, git: gidis }: { ikon: string; ust: string; baslik: string; metin?: string; cikti?: string | null; cizgi?: 'kesik' | 'dolu' | null; git?: () => void }) {
  const bag = gidis ? { role: 'link', tabIndex: 0, onClick: gidis, onKeyDown: (e: RKeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); gidis(); } } } : {};
  return (
    <li className={`gecmis-satir ${cizgi ? 'cizgi-' + cizgi : ''} ${gidis ? 'baglanti' : ''}`} {...bag}>
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

export function AdimGecmis({ a, d, ben, kod }: { a: any; d: any; ben: string; kod: string }) {
  const adimaGit = (n: number) => () => git(`/akis/${encodeURIComponent(kod)}/adim/${n}`);
  const by = new Map<number, any>(d.adimlar.map((x: any) => [x.no, x]));
  const ist = a.durum === 'engelli' && a.engel ? istekBul(a.engel, ben) : null;
  const sonraki = (a.bekleyen_adimlar || []).map((b: any) => by.get(b.no)).filter(Boolean)[0];
  const sirada: ReactNode[] = [];
  if (ist) sirada.push(<Satir key="sen" ikon={ship(0, 0, 0, 'insan', (ben[0] || 'S').toLocaleUpperCase('tr'), C.peach, .62, { flame: false })} ust={`Senden bekleniyor · ${sureKisa(a.bekleme_saat)}`} baslik={ist.emir} cizgi="kesik" />);
  else if (!BITTI(a.durum)) sirada.push(<Satir key="sahip" ikon={IKON.gelecek} ust={`${kisaAd(a.sahip)} · ${a.durum_etiket || a.durum}`} baslik={a.en_erken_bitis ? `En erken ${gunAyHafta(Date.parse(a.en_erken_bitis))} biter` : 'Tarihi belli değil'} cizgi="kesik" />);
  if (sonraki && !BITTI(a.durum)) sirada.push(<Satir key="sonraki" ikon={IKON.gelecek} ust={sonraki.en_erken_bitis ? `En erken ${gunAyHafta(Date.parse(sonraki.en_erken_bitis))} ${saat(Date.parse(sonraki.en_erken_bitis))}` : 'Sonra'} baslik={`${sonraki.ad} ${sonraki.sahip === ben ? 'sana' : ozelEk(kisaAd(sonraki.sahip), 'e')} gelir`} git={adimaGit(sonraki.no)} />);
  // yeniden eskiye; aynı anda (2 sn) yazılan durum + ilerleme: durum önce, ilerleme yalnız çıktı taşıyorsa ayrı satır
  const ham = (a.olaylar || []).filter((e: any) => e.tip !== 'okuma').map((e: any) => ({ ...e, _t: Date.parse(e.zaman) }));
  const olaylar = ham
    .filter((e: any) => !(e.tip === 'guncelleme' && !olayMetni(e).cikti && ham.some((x: any) => x.tip === 'durum' && Math.abs(x._t - e._t) < 2000)))
    .sort((x: any, y: any) => (Math.abs(x._t - y._t) < 2000 ? Number(y.tip === 'durum') - Number(x.tip === 'durum') : y._t - x._t));
  const ikonOf = (e: any) => e.tip === 'durum' ? (e.durum === 'engelli' ? IKON.engel : e.durum === 'suruyor' ? `<circle r="10" fill="#150E33" stroke="#B9A6F2" stroke-width="1.3"/>` + ship(0, 0, 0, e.kim_tip === 'agent' ? 'agent' : 'insan', (e.kim_tip === 'agent' ? e.arac || e.kim : e.kim || '?')[0], e.kim_tip === 'agent' ? C.lilac : C.peach, .42, { flame: false }) : e.durum === 'tamam' ? IKON.bitti : IKON.hazir) : e.tip === 'not' ? IKON.not : IKON.ilerleme;
  // agent kaydı kimin adına yazıldığını gösterir; kanalı olmayan (0.13.0 öncesi) kayıt doğrulanmamış eski kayıttır
  const kim = (e: any) => e.kim_tip === 'agent' ? `${e.arac || 'AI'} (${kisaAd(e.kim)} adına)` : e.kim;
  const eski = (e: any) => (e.kim_tip !== 'sistem' && !e.kanal ? ' · doğrulanmamış eski kayıt' : '');
  const ilkHazir: number | null = (a.bekledigi || []).find((b: any) => b.durum === 'tamam')?.no ?? null;
  const sistemHazir = (e: any) => { const h = (a.bekledigi || []).filter((b: any) => b.durum === 'tamam').map((b: any) => adimAdi(by.get(b.no) || b)); return h.length ? `Sırası geldi; ${h.map((x: string, i: number) => (i || true) && /^[A-ZÇĞİÖŞÜ][^A-ZÇĞİÖŞÜ]*$/.test(x.split(' ')[0]) ? x[0].toLocaleLowerCase('tr') + x.slice(1) : x).join(', ').replace(/, ([^,]+)$/, ' ve $1')} hazır` : olayBasligi(e); };
  return (
    <div className="adim-gecmis">
      {sirada.length > 0 && <><h3 className="bolum">SIRADA</h3><ol className="gecmis-liste gelecek">{sirada}</ol></>}
      <h3 className="bolum">GEÇMİŞ</h3>
      <ol className="gecmis-liste">
        {olaylar.map((e: any) => {
          const { metin, cikti } = olayMetni(e);
          const z = Date.parse(e.zaman);
          return <Satir key={e.id} ikon={ikonOf(e)} ust={`${gunAy(z)} ${saat(z)} · ${e.kim_tip === 'sistem' ? 'Devir' : kim(e)}${eski(e)}`} baslik={e.kim_tip === 'sistem' && e.durum === 'hazir' ? sistemHazir(e) : olayBasligi(e)} metin={metin} cikti={cikti} cizgi="dolu" git={e.kim_tip === 'sistem' && e.durum === 'hazir' && ilkHazir ? adimaGit(ilkHazir) : undefined} />;
        })}
      </ol>
      {olaylar.length >= 60 && <p className="gecmis-not">Son 60 kayıt gösteriliyor.</p>}
    </div>
  );
}

