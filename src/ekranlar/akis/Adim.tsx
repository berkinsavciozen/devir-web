import { useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent as RKeyboardEvent } from 'react';
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
import { C, planet, route, shareRing, ship, sparkle } from '../../cizim/ortak.js';
import { akisModeli, gunAy, gunAyHafta, saat, uyeRenkleri, yolCiz, kisaAd } from '../../cizim/yol.js';
import { adimAdi, adimEtiketi, akisAdi, ikiSatir, ozelEk } from '../../metin/turkce';
import { git, arama } from '../../yonlendirme';
import { haritaCumlesi, useAkis } from './Galaksi';
import { Karar } from './Karar';

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

const SEKME_Y = { durum: 330, gecmis: 150 } as const;

export function Adim({ kod, no, ben }: { kod: string; no: number; ben: string }) {
  const akis = useAkis(kod);
  const q = useQuery({ queryKey: ['adim', kod, no], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`) });
  const [sekme, setSekme] = useState<'durum' | 'gecmis'>(() => (arama().get('sekme') === 'gecmis' ? 'gecmis' : 'durum'));
  const kapat = () => git(`/akis/${encodeURIComponent(kod)}`, { yerine: true });
  const d = akis.data, a = q.data?.adim;
  // ?bolum=ciktilar → sayfa yüksek açılır, çıktılar görünür (B8; bildirimden gelinen yer)
  const ciktilaraGit = useMemo(() => arama().get('bolum') === 'ciktilar', []);
  const [yuksek, setYuksek] = useState(ciktilaraGit);
  const durumBasligi = useRef<HTMLDivElement>(null);
  // başka adıma geçince sayfa başa döner
  const ilkNo = useRef(no);
  useEffect(() => {
    if (ilkNo.current === no) return;
    ilkNo.current = no; setYuksek(false); setKucukBaslik(false);
    (durumBasligi.current?.closest('.alt-sayfa-icerik') as HTMLElement | null)?.scrollTo({ top: 0 });
  }, [no]);
  const [kucukBaslik, setKucukBaslik] = useState(ciktilaraGit);
  // durum bloğunun başlığı yukarı kayınca küçük başlık satırı yapışkan alana gelir
  useEffect(() => {
    const el = durumBasligi.current, kap = el?.closest('.alt-sayfa-icerik') as HTMLElement | null; if (!el || !kap) return;
    const bak = () => setKucukBaslik(kap.scrollTop > 200);
    bak(); kap.addEventListener('scroll', bak, { passive: true });
    return () => kap.removeEventListener('scroll', bak);
  }, [a, sekme]);
  // önceki / sonraki adım (numara sırası); ← → tuşları (yazı alanında değilken)
  const nolar: number[] = d ? d.adimlar.map((x: any) => x.no).sort((p: number, q: number) => p - q) : [];
  const i = nolar.indexOf(no), onceki = i > 0 ? nolar[i - 1] : null, sonraki = i >= 0 && i < nolar.length - 1 ? nolar[i + 1] : null;
  const adimaGit = (n: number | null) => { if (n != null) git(`/akis/${encodeURIComponent(kod)}/adim/${n}`, { yerine: true }); };
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable], [role=slider], [role=tablist]')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      // adres çizimden önce değişmiş olabilir (hızlı basış): komşu, adresteki adımdan hesaplanır
      const m = location.pathname.match(/\/adim\/(\d+)/), j = nolar.indexOf(m ? +m[1] : no);
      const h = j < 0 ? null : e.key === 'ArrowLeft' ? nolar[j - 1] : nolar[j + 1];
      if (h != null) { e.preventDefault(); adimaGit(h); }
    };
    addEventListener('keydown', t); return () => removeEventListener('keydown', t);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  // karar adımı: verildiyse ya da seçenekleri yazıldıysa karar ekranı (C1, C2)
  if (a?.karar_adimi && (a.durum === 'tamam' || (a.karar?.secenekler?.length && !BITTI(a.durum)))) return <Karar kod={kod} no={no} ben={ben} />;
  const y = sekme === 'gecmis' || yuksek ? 150 : 330;
  return (
    <>
      <AdimArka d={d} no={no} sheetY={y} sahip={ben} />
      <AltSayfa acik kapat={kapat} baslik={a ? adimAdi(a) : 'Adım'} yukseklik={y} duraklar={['orta', 'yuksek']} perdesiz ust={d && <nav className="adim-gez" aria-label="Adımlar arasında">
        <button type="button" aria-label={onceki != null ? `Önceki adım: ${onceki}` : 'Önceki adım yok'} disabled={onceki == null} onClick={() => adimaGit(onceki)}><svg aria-hidden viewBox="-9 -9 18 18"><path d="M3,-6 L-3,0 L3,6" /></svg></button>
        <button type="button" aria-label={sonraki != null ? `Sonraki adım: ${sonraki}` : 'Sonraki adım yok'} disabled={sonraki == null} onClick={() => adimaGit(sonraki)}><svg aria-hidden viewBox="-9 -9 18 18"><path d="M-3,-6 L3,0 L-3,6" /></svg></button>
      </nav>}>
        <div className="adim-panel">
          <div className="adim-yapiskan">
            <Segment secenekler={['Durum', 'Geçmiş']} aktif={sekme === 'durum' ? 0 : 1} sec={(i) => setSekme(i ? 'gecmis' : 'durum')} />
            {a && (sekme === 'gecmis' || kucukBaslik) && <KucukBaslik a={a} />}
          </div>
          {!a || !d ? <div className="adim-yukleniyor" role="status" aria-label="Yükleniyor"><span /><span /></div>
            : sekme === 'durum' ? <>
              <div ref={durumBasligi}><AdimDurum a={a} d={d} ben={ben} kod={kod} /></div>
              <Ciktilar a={a} kod={kod} acilista={ciktilaraGit} yuksel={() => setYuksek(true)} />
            </> : <AdimGecmis a={a} d={d} ben={ben} kod={kod} />}
        </div>
      </AltSayfa>
    </>
  );
}

/** Başlık satırı: küçük gezegen + ad + "Claude · engelli · son 28 Eki" (B5, B8). */
function KucukBaslik({ a }: { a: any }) {
  const durumGor = BITTI(a.durum) ? 'lit' : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark';
  return (
    <div className="gecmis-baslik">
      <svg aria-hidden width="40" height="40" viewBox="-20 -20 40 40" dangerouslySetInnerHTML={{ __html: planet(0, 0, 13, durumGor, { cloudGap: 3, life: false }) }} />
      <div><h2>{adimAdi(a)}</h2><small>{kisaAd(a.sahip)} · {a.durum_etiket || a.durum}{a.son_tarih ? ` · son ${gunAy(Date.parse(a.son_tarih + 'T12:00:00+03:00'))}` : ''}</small></div>
    </div>
  );
}

interface YerelYukleme { anahtar: string; ad: string; tur: string; boyut: number; yuzde: number; hata?: string; iptal?: () => void }

/** ÇIKTILAR (§5 B8): kayıtlı dosyalar (İndir, Sil), yüklenenler (%, İptal), bağlantılar (Aç), "Dosya ekle". */
function Ciktilar({ a, kod, acilista, yuksel }: { a: any; kod: string; acilista: boolean; yuksel: () => void }) {
  const dosyalar = useQuery({ queryKey: ['dosyalar', kod], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/dosyalar`) });
  const [yerel, setYerel] = useState<YerelYukleme[]>([]);
  const [silinecek, setSilinecek] = useState<any | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);
  const kok = useRef<HTMLElement>(null);
  const byId = new Map<string, any>((dosyalar.data?.dosyalar || []).map((x: any) => [x.id, x]));
  useEffect(() => {
    if (!acilista || !kok.current) return;
    const k = kok.current, kap = k.closest('.alt-sayfa-icerik') as HTMLElement | null;
    const t = setTimeout(() => { if (!kap) return; k.style.minHeight = `${kap.clientHeight - 131}px`; kap.scrollTop = k.offsetTop - 131; }, 50);
    return () => clearTimeout(t);
  }, [acilista, dosyalar.isSuccess]);
  const tazele = () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['adim', kod, a.no] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['dosyalar', kod] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['akis', kod] }); };
  const guncelle = (k: string, p: Partial<YerelYukleme>) => setYerel((L) => L.map((x) => (x.anahtar === k ? { ...x, ...p } : x)));
  const sec = (fs: FileList | null) => {
    if (!fs) return;
    yuksel();
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
  const bekledigi: number[] = (a.bekledigi || []).filter((b: any) => !BITTI(b.durum)).map((b: any) => b.no);
  const durumGor = BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark';
  const sahipAjan = ajanMi(a.sahip, a.sahip_tip), sahipDis = !sahipAjan && a.sahip_tip === 'dis' && a.sahip !== ben;
  const y0 = 10;
  // bağ zinciri (madde 14): solda bu adımı etkileyenler (doğrudan önündekiler, bitenler yanık), ortada adım, sağda etkiledikleri
  const ry = y0 + 384;
  const gor = (z: any) => (BITTI(z.durum) ? (z.durum === 'atlandi' ? 'ghost' : 'lit') : z.durum === 'engelli' ? 'block' : z.durum === 'hazir' || z.durum === 'suruyor' ? 'wait' : 'dark');
  const onde: any[] = (a.bagimli || d.adimlar.find((x: any) => x.no === a.no)?.bagimli || []).map((n: number) => by.get(n)).filter(Boolean).slice(ist ? -2 : -3);
  const sonra: any[] = d.adimlar.filter((x: any) => (x.bagimli || []).includes(a.no)).slice(0, 3);
  let svg = `<ellipse cx="195" cy="${y0 + 138}" rx="160" ry="70" fill="url(#${durumGor === 'block' ? 'glowCoral' : 'glowGold'})" opacity=".35"/>`;
  svg += planet(195, y0 + 142, 30, durumGor, { cloudGap: 10, karar: a.karar_adimi, waitRings: 2 });
  const pay = isPayi(a.olaylar);
  if (pay.length) svg += shareRing(195, y0 + 142, 44, pay, { br: 7.5, bead: 1.9 });
  svg += ship(116, y0 + 150, -8, sahipAjan ? 'agent' : sahipDis ? 'dis' : 'insan', sahipDis ? '' : kisaAd(a.sahip)[0], renk[a.sahip] || C.mint, 1.15, { flame: false });
  const chipRenk = ['#FF8A78', '#B9A6F2', '#FFD27A'];
  for (let i = 0; i < 3; i++) svg += `<rect x="${20 + i * 119}" y="${y0 + 276}" width="112" height="54" rx="18" fill="#FFFFFF" fill-opacity=".06" stroke="${chipRenk[i]}" stroke-opacity=".6"/>`;
  const basta = ist ? { ad: 'Sen', gemi: '' } : null;
  const solX = (i: number) => 140 - i * 56, sagX = (i: number) => 250 + i * 56;
  const soldakiler: { no?: number; x: number; ad: string }[] = onde.slice().reverse().map((z, i) => ({ no: z.no, x: solX(i), ad: adimEtiketi(z) }));
  if (basta) { const x = solX(soldakiler.length); soldakiler.push({ x, ad: 'Sen' }); svg += ship(x, ry, 0, 'insan', (ben[0] || 'S').toLocaleUpperCase('tr'), C.peach, .95, { flame: false }); }
  onde.slice().reverse().forEach((z, i) => {
    svg += route([solX(i) + 12, ry], [i ? solX(i - 1) - 12 : 195 - 15, ry], BITTI(z.durum) ? { col: '#FFD27A' } : { col: C.peach });
    svg += planet(solX(i), ry, 10, gor(z), { life: false, karar: z.karar_adimi });
  });
  if (basta && onde.length === 0) svg += route([solX(0) + 16, ry], [195 - 15, ry], { col: C.peach });
  svg += `<g transform="translate(195,${ry})">${planet(0, 0, 13, durumGor, { life: false, waitRings: 1, cloudGap: 2 })}<circle r="16" fill="none" stroke="#FFF3E8" stroke-width="1.4" opacity=".7"/></g>`;
  sonra.forEach((z, i) => {
    const kr = kritik.has(z.no) && kritik.has(a.no);
    svg += route([i ? sagX(i - 1) + 12 : 195 + 15, ry], [sagX(i) - 12, ry], kr ? { kind: 'critical' } : { col: C.peach });
    svg += planet(sagX(i), ry, 10, gor(z), { life: false, karar: z.karar_adimi });
  });
  // tuttuğu ama doğrudan bağlı olmayanlar: "+n"
  const dolayli = tut.length - sonra.filter((z) => !BITTI(z.durum)).length;
  const sayilar: [string, string][] = [
    [a.durum === 'engelli' || a.durum === 'hazir' || a.durum === 'suruyor' ? sureKisa(a.bekleme_saat) : BITTI(a.durum) ? gunAy(Date.parse(a.durum_at)) : '–', a.durum === 'engelli' ? 'engelli' : a.durum === 'hazir' ? 'bekliyor' : a.durum === 'suruyor' ? 'sürüyor' : a.durum_etiket || a.durum],
    [`${tut.length} adım`, 'tutuyor'],
    a.son_tarih ? [gunAy(Date.parse(a.son_tarih + 'T12:00:00+03:00')), 'son tarih'] : a.en_erken_bitis ? [gunAy(Date.parse(a.en_erken_bitis)), 'en erken'] : ['–', 'son tarih'],
  ];
  const benim = a.sahip === ben && !BITTI(a.durum);
  // ne yapılacak (madde 14): beklenen çıktı ya da kısaltılmış adın tamamı; bitmiş adımda yazılmaz
  const yapilacak = BITTI(a.durum) ? null : a.beklenen_cikti || (a.ad !== adimAdi(a) ? a.ad : null);
  const bitir = useMutation({
    mutationFn: () => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${a.no}`, { durum: 'tamam' }),
    onSuccess: () => { void sorguIstemcisi.invalidateQueries({ queryKey: ['akis', kod] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['adim', kod, a.no] }); void sorguIstemcisi.invalidateQueries({ queryKey: ['ozet'] }); },
  });
  const claude = a.linkler?.claude;
  return (
    <div className="adim-durum">
      <svg className="panel-cizim" aria-hidden width="390" height="480" viewBox={`0 ${28} 390 480`} dangerouslySetInnerHTML={{ __html: svg }} />
      <Metin y={P(y0 + 218)} fs={24} lh={30} serif agirlik={700} hiza="orta" as="h2">{adimAdi(a)}</Metin>
      <Metin y={P(y0 + 244)} fs={16.5} lh={21} serif renk="ink2" hiza="orta" style={{ whiteSpace: 'nowrap' }}>{bekledigi.length && /adım bitince başlar\.$/.test(cumle.join(' '))
        ? <>{bekledigi.map((n: number, i: number) => <span key={n}>{i ? ', ' : ''}<button type="button" className="metin-baglanti" aria-label={`${n}. adım: ${by.get(n)?.ad ?? ''}`} onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${n}`)}>{n}</button></span>)}. adım bitince başlar.</>
        : cumle.map((c, i) => <span key={i}>{i ? <br /> : null}{c}</span>)}</Metin>
      {sayilar.map(([b, k], i) => (
        <div key={k} className="sayi-kutusu" style={{ left: 20 + i * 119, top: P(y0 + 276) }}><b>{b}</b><small>{k}</small></div>
      ))}
      {(soldakiler.length > 0 || sonra.length > 0) && <>
        {soldakiler.length > 0 && <Metin y={P(ry - 30)} x={20} fs={11} agirlik={700} renk="ink3" style={{ width: 150, letterSpacing: '.6px' }}>ETKİLEYEN</Metin>}
        {sonra.length > 0 && <Metin y={P(ry - 30)} hiza="sag" x={370} fs={11} agirlik={700} renk="ink3" style={{ letterSpacing: '.6px' }}>{`ETKİLEDİĞİ${dolayli > 0 ? ` · +${dolayli} dolaylı` : ''}`}</Metin>}
        {[...soldakiler, ...sonra.map((z, i) => ({ no: z.no, x: sagX(i), ad: adimEtiketi(z) }))].map((z) => <Metin key={'e' + (z.no ?? 'sen')} y={P(ry + 30)} x={z.x - 28} fs={11.5} agirlik={z.no == null ? 700 : 600} renk={z.no == null ? 'ink' : 'ink2'} style={{ width: 56, textAlign: 'center' }}>{z.ad}</Metin>)}
        {[...soldakiler.filter((z) => z.no != null), ...sonra.map((z, i) => ({ no: z.no, x: sagX(i) }))].map((z) => { const b = by.get(z.no!); return <button key={'h' + z.no} type="button" className="zincir-hedef" style={{ left: z.x - 28, top: P(ry) - 22 }} aria-label={`${sonra.some((x) => x.no === z.no) ? 'Bu adım bitince' : 'Önce'}: ${z.no}. adım, ${b?.ad ?? ''}.`} onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${z.no}`)} />; })}
      </>}
      <Metin y={P(y0 + 182)} x={76} fs={11.5} agirlik={700} renk={kritik.has(a.no) && !BITTI(a.durum) ? 'altin' : 'ink2'} style={{ width: 80, textAlign: 'center', lineHeight: '14px' }}>{kisaAd(a.sahip)}{kritik.has(a.no) && !BITTI(a.durum) ? <><br />kritik yol</> : null}</Metin>
      {yapilacak && <Metin y={P(y0 + 440)} fs={14} lh={19} renk="ink2" className="yapilacak"><b>Yapılacak:</b> {yapilacak}</Metin>}
      <div className="adim-eylem" style={{ top: P(y0 + (yapilacak ? 470 : 430)) }}>
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
      {bitir.isError && <p className="canli-hata" role="alert" style={{ top: P(y0 + 534) }}>{(bitir.error as Error).message}</p>}
    </div>
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

function AdimGecmis({ a, d, ben, kod }: { a: any; d: any; ben: string; kod: string }) {
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
  const kim = (e: any) => e.kim_tip === 'agent' ? e.arac || e.kim : e.kim;
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
          return <Satir key={e.id} ikon={ikonOf(e)} ust={`${gunAy(z)} ${saat(z)} · ${e.kim_tip === 'sistem' ? 'Devir' : kim(e)}`} baslik={e.kim_tip === 'sistem' && e.durum === 'hazir' ? sistemHazir(e) : olayBasligi(e)} metin={metin} cikti={cikti} cizgi="dolu" git={e.kim_tip === 'sistem' && e.durum === 'hazir' && ilkHazir ? adimaGit(ilkHazir) : undefined} />;
        })}
      </ol>
      {olaylar.length >= 60 && <p className="gecmis-not">Son 60 kayıt gösteriliyor.</p>}
    </div>
  );
}

