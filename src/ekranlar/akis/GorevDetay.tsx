import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi } from '../../api/sorgular';
import { hedefPayi } from '../../bilesen/KararSeridi';
import { Dugme } from '../../bilesen/Dugme';
import { C, planet, ship } from '../../cizim/ortak.js';
import { gunAy, gunAyHafta, kisaAd } from '../../cizim/yol.js';
import { adimAdi, akisAdi, ozelEk } from '../../metin/turkce';
import { arama, git } from '../../yonlendirme';
import { adimCumlesi, AdimGecmis, Ciktilar, IHLAL_IPUCU, isPayi, sureKisa, takvimIhlali, tarihSayisi, tuttuklari } from './Adim';
import { BaglantiGonder } from './BaglantiGonder';
import { useAkis } from './Galaksi';
import { KararBolumu } from './Karar';
import { TarihNeden } from './TarihNeden';

const BITTI = (d: string) => ['tamam', 'atlandi', 'ertelendi'].includes(d);
const ajanMi = (ad: string, tip?: string) => tip === 'agent' || /agent|Claude/i.test(ad);
const GUN = 864e5;
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const durumGor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark');
const gezegen = (a: any, r: number) => planet(0, 0, r, durumGor(a), { life: false, karar: a.karar_adimi, cloudGap: r > 16 ? 6 : 2 });

/** Görevin başlangıcı: başladıysa ilk "başladı" kaydı; sırası geldiyse şimdi; değilse öncüllerin en geç en erken bitişi. */
export function baslangic(a: any, by: Map<number, any>): { ms: number | null; etiket: string } {
  const basladi = (a.olaylar || []).find((e: any) => e.tip === 'durum' && e.durum === 'suruyor');
  if (basladi) return { ms: Date.parse(basladi.zaman), etiket: 'başladı' };
  if (a.durum === 'hazir') return { ms: Date.parse(a.durum_at), etiket: 'sırası geldi' };
  if (BITTI(a.durum)) return { ms: null, etiket: '' };
  const once = (a.bagimli || []).map((n: number) => by.get(n)).filter((b: any) => b && !BITTI(b.durum) && b.en_erken_bitis).map((b: any) => Date.parse(b.en_erken_bitis));
  return once.length ? { ms: Math.max(...once), etiket: 'en erken' } : { ms: null, etiket: '' };
}

/**
 * Bu görev geciktikçe ardılın ne kadar kayacağı (N22): ardıl, bütün öncülleri bitince başlar; bu görev öteki öncüllerden
 * önce bitiyorsa aradaki gün kadar gecikme ardılı kaydırmaz. null: tarih bilinmiyor.
 */
export function kaydirmaPayi(a: any, ardil: any, by: Map<number, any>): number | null {
  if (!a.en_erken_bitis) return null;
  const bu = Date.parse(a.en_erken_bitis);
  const oteki = (ardil.bagimli || []).filter((n: number) => n !== a.no).map((n: number) => by.get(n)).filter((b: any) => b && !BITTI(b.durum) && b.en_erken_bitis).map((b: any) => Date.parse(b.en_erken_bitis));
  return oteki.length ? Math.max(0, Math.floor((Math.max(...oteki) - bu) / GUN)) : 0;
}

function Bolum({ baslik, children, id }: { baslik: string; children: ReactNode; id?: string }) {
  return <section className="gd-bolum" aria-label={baslik} id={id}><h3 className="gd-bolum-baslik">{baslik}</h3>{children}</section>;
}

/**
 * Tek görev detayı (W2; el notları N18–N22): bütün yüzeylerde aynı bileşen ve aynı bölüm sırası. Telefonda alt sayfanın,
 * masaüstünde akış panelinin içinde akar; sayfa ölçüsü kabuktan gelir.
 * Başlık ve durum → ne yapılacak → kim → ne zaman → etkileyen / etkilediği → karar (yalnız karar adımı) →
 * çıktı (bekleniyorsa ya da varsa) → alt görevler (varsa) → geçmiş (katlı).
 */
export function GorevDetay({ kod, no, ben, kapat }: { kod: string; no: number; ben: string; kapat?: () => void }) {
  const akis = useAkis(kod);
  const q = useQuery({ queryKey: ['adim', kod, no], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`) });
  const d = akis.data, a = q.data?.adim;
  const kok = useRef<HTMLDivElement>(null);
  const [neden, setNeden] = useState(false);
  const [paylas, setPaylas] = useState(false);
  const [gecmisAcik, setGecmisAcik] = useState(() => arama().get('sekme') === 'gecmis');
  // ?bolum=ciktilar (bildirimden) / ?sekme=gecmis: o bölüme iner
  const hedefBolum = useMemo(() => (arama().get('bolum') === 'ciktilar' ? 'gd-ciktilar' : arama().get('sekme') === 'gecmis' ? 'gd-gecmis' : null), []);
  useEffect(() => {
    if (!a || !hedefBolum) return;
    const t = setTimeout(() => kok.current?.querySelector(`#${hedefBolum}`)?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [a?.no, hedefBolum]); // eslint-disable-line react-hooks/exhaustive-deps
  // başka göreve geçince detay başa döner
  const ilkNo = useRef(no);
  useEffect(() => {
    if (ilkNo.current === no) return;
    ilkNo.current = no;
    const kap = kok.current?.closest('.alt-sayfa-icerik, .gd-kaydir') as HTMLElement | null;
    kap?.scrollTo({ top: 0 });
  }, [no]);
  // önceki / sonraki görev (numara sırası); ← → tuşları (yazı alanında değilken)
  const nolar: number[] = d ? d.adimlar.map((x: any) => x.no).sort((p: number, r: number) => p - r) : [];
  const i = nolar.indexOf(no), onceki = i > 0 ? nolar[i - 1] : null, sonraki = i >= 0 && i < nolar.length - 1 ? nolar[i + 1] : null;
  const adimaGit = (n: number | null) => { if (n != null) git(`/akis/${encodeURIComponent(kod)}/adim/${n}`, { yerine: true }); };
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable], [role=slider], [role=tablist]')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      // adres çizimden önce değişmiş olabilir (hızlı basış): komşu, adresteki görevden hesaplanır
      const m = location.pathname.match(/\/adim\/(\d+)/), j = nolar.indexOf(m ? +m[1] : no);
      const h = j < 0 ? null : e.key === 'ArrowLeft' ? nolar[j - 1] : nolar[j + 1];
      if (h != null) { e.preventDefault(); adimaGit(h); }
    };
    addEventListener('keydown', t); return () => removeEventListener('keydown', t);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const yenile = () => { for (const k of [['akis', kod], ['adim', kod, no], ['ozet']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); };
  const bitir = useMutation({
    mutationFn: () => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`, { durum: 'tamam' }),
    onSuccess: yenile,
  });
  // 1.3: alt görevi akordiyondan bitir
  const altBitir = useMutation({
    mutationFn: (n: number) => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${n}`, { durum: 'tamam' }),
    onSuccess: yenile,
  });
  // W5: alt görev ekleme (tek düzey; alt görevin altına eklenmez)
  const [altAd, setAltAd] = useState('');
  const altEkle = useMutation({
    mutationFn: (ad: string) => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}/alt`, { alt_gorevler: [{ ad }] }),
    onSuccess: () => { setAltAd(''); yenile(); },
  });

  if (!a || !d) return <div className="gd" ref={kok}><div className="adim-yukleniyor" role="status" aria-label="Yükleniyor"><span /><span /></div></div>;

  const by = new Map<number, any>(d.adimlar.map((x: any) => [x.no, x]));
  const dx = by.get(a.no) || {};
  const A = { ...dx, ...a };
  const kritik = new Set<number>(d.kritik_yol || []);
  const krt = kritik.has(A.no) && !BITTI(A.durum);
  const tut = tuttuklari(d.adimlar, A.no);
  const sahipAjan = ajanMi(A.sahip, A.sahip_tip), sahipDis = !sahipAjan && A.sahip_tip === 'dis' && A.sahip !== ben;
  const benim = A.sahip === ben && !BITTI(A.durum);
  const claude = A.linkler?.claude;
  const ihlal = takvimIhlali(A);
  const sayilar: [string, string][] = [
    [A.durum === 'engelli' || A.durum === 'hazir' || A.durum === 'suruyor' ? sureKisa(A.bekleme_saat) : BITTI(A.durum) ? gunAy(Date.parse(A.durum_at)) : '–', A.durum === 'engelli' ? 'engelli' : A.durum === 'hazir' ? 'bekliyor' : A.durum === 'suruyor' ? 'sürüyor' : A.durum_etiket || A.durum],
    [`${tut.length} görev`, 'tutuyor'],
    tarihSayisi(A),
  ];
  const cumle = adimCumlesi(A, ben);
  const bekledigi: number[] = (A.bekledigi || []).filter((b: any) => !BITTI(b.durum)).map((b: any) => b.no);
  // ne yapılacak (P1-F): açıklama, kabul kriteri, beklenen çıktı (adın tamamı yol izinde, plan 27 Eki 2.7)
  const yapilacak: [string, string][] = ([['Amaç', A.aciklama || ''], ['Kabul kriteri', A.kriter || ''], ['Beklenen çıktı', A.beklenen_cikti || '']] as [string, string][]).filter(([, v]) => v);
  // kim: sahip + iş payı (kim ne kadar yazdı)
  const pay = isPayi(A.olaylar).filter((p) => p.ad !== A.sahip);
  const tip = A.sahip === ben ? 'sen' : sahipAjan ? 'AI agent' : A.sahip_tip === 'dis' ? 'dış katılımcı' : 'ekip';
  const gemi = ship(0, 0, -8, sahipAjan ? 'agent' : sahipDis ? 'dis' : 'insan', sahipDis ? '' : kisaAd(A.sahip)[0], sahipAjan ? C.lilac : C.peach, .62, { flame: false });
  // ne zaman
  const bas = baslangic(A, by);
  const bitis = BITTI(A.durum) ? { ms: Date.parse(A.durum_at), etiket: A.durum === 'tamam' ? 'bitti' : A.durum_etiket || A.durum } : A.en_erken_bitis ? { ms: Date.parse(A.en_erken_bitis), etiket: 'en erken' } : null;
  const hp = hedefPayi(d.akis);
  // bağlar: öncüller (bitmeden başlayamaz) ve ardıllar (kaç gün kaydırır)
  const onde: any[] = (A.bagimli || []).map((n: number) => by.get(n)).filter(Boolean);
  const sonra: any[] = d.adimlar.filter((x: any) => (x.bagimli || []).includes(A.no));
  const dolayli = tut.length - sonra.filter((z) => !BITTI(z.durum)).length;
  const ardilNotu = (z: any) => {
    if (BITTI(A.durum)) return 'bu görev bittiği için onu tutmuyor';
    if (BITTI(z.durum)) return z.durum === 'tamam' ? 'bitti' : z.durum_etiket || z.durum;
    const g = kaydirmaPayi(A, z, by);
    if (g == null) return 'bu görev bitmeden başlayamaz';
    return g === 0 ? 'bu görev bitmeden başlayamaz; her gün gecikme onu bir gün kaydırır' : `bu görev bitmeden başlayamaz; ${g} güne kadar gecikme onu kaydırmaz`;
  };
  const onculNotu = (z: any) => (BITTI(z.durum) ? (z.durum === 'tamam' ? `bitti ${gunAy(Date.parse(z.durum_at))}` : z.durum_etiket || z.durum) : `${z.durum_etiket || z.durum}${z.en_erken_bitis ? ` · en erken ${gunAy(Date.parse(z.en_erken_bitis))}` : ''}; bitmeden bu görev başlayamaz`);
  // N17: çıktı bölümü yalnız gerekiyorsa; planlamada "çıktı yok" denen adımda, çıktı yazılmadıkça görünmez
  const ciktiVar = !!A.beklenen_cikti || A.cikti_bekleniyor === true || (A.ciktilar || []).length > 0 || A.cikti_sayisi > 0 || (benim && !A.karar_adimi && A.cikti_bekleniyor !== false);
  const altlar: any[] = A.tekrar?.kalemler || [];
  // W5 (N23, N24): gerçek alt görevler; alt görevin üstü
  const altGorevler: any[] = (A.alt_gorevler || []).map((n: number) => by.get(n)).filter(Boolean);
  const acikAlt = altGorevler.filter((z) => !BITTI(z.durum));
  const ust = A.ust_adim != null ? by.get(A.ust_adim) : null;
  const altEklenir = !ust && !BITTI(A.durum) && !A.tekrar;
  const gorevSatiri = (z: any, not: string) => (
    <li key={z.no}>
      <button type="button" className="gd-bag" onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${z.no}`)} aria-label={`${z.no}. görev: ${z.ad}. ${not}`}>
        <svg aria-hidden width="28" height="28" viewBox="-14 -14 28 28" dangerouslySetInnerHTML={{ __html: gezegen(z, 9) }} />
        <span><b>{adimAdi(z)}</b><small>{kisaAd(z.sahip)} · {not}</small></span>
      </button>
    </li>
  );

  // 1.3: alt görevler aynı sayfada akordiyon; her biri kendi durum, sahip, tarih, çıktı ve düğmeleriyle
  const altAkordiyon = (z: any) => {
    const t = BITTI(z.durum) ? (z.durum_at ? `bitti ${gunAy(Date.parse(z.durum_at))}` : '–') : z.en_erken_bitis ? `en erken ${gunAyHafta(Date.parse(z.en_erken_bitis))}` : 'öncülleri bitince';
    const zBenim = z.sahip === ben && !BITTI(z.durum);
    return (
      <li key={z.no}>
        <details className="gd-akordiyon">
          <summary aria-label={`${z.no}. alt görev: ${z.ad}. ${z.durum_etiket || z.durum}`}>
            <svg aria-hidden width="28" height="28" viewBox="-14 -14 28 28" dangerouslySetInnerHTML={{ __html: gezegen(z, 9) }} />
            <span><b>{adimAdi(z)}</b><small>{kisaAd(z.sahip)} · {z.durum_etiket || z.durum}</small></span>
            <svg aria-hidden className="gd-akordiyon-ok" width="14" height="14" viewBox="-7 -7 14 14"><path d="M-4,-2 L0,2 L4,-2" /></svg>
          </summary>
          <dl className="gd-liste">
            <div><dt>Sahip</dt><dd>{z.sahip}{ajanMi(z.sahip, z.sahip_tip) && z.agent_sahibi ? ` · ${kisaAd(z.agent_sahibi)} adına` : ''}</dd></div>
            <div><dt>Durum</dt><dd>{z.durum_etiket || z.durum}{z.engel ? ` · ${z.engel}` : ''}</dd></div>
            <div><dt>Bitiş</dt><dd>{t}{z.son_tarih ? ` · son tarih ${gunAy(tarihMs(z.son_tarih))}` : ''}</dd></div>
            {z.kriter && <div><dt>Kabul kriteri</dt><dd>{z.kriter}</dd></div>}
            <div><dt>Çıktı</dt><dd>{z.cikti_sayisi ? `${z.cikti_sayisi} çıktı` : 'henüz yok'}</dd></div>
          </dl>
          <div className="gd-akordiyon-eylem">
            {zBenim && !z.karar_adimi && (z.durum === 'hazir' || z.durum === 'suruyor') && <button type="button" className="gd-alt-ekle-dugme" disabled={altBitir.isPending} onClick={() => altBitir.mutate(z.no)}>Bitti</button>}
            <button type="button" className="metin-baglanti" onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${z.no}`)}>{zBenim && z.karar_adimi ? 'Karar ver' : 'Ayrıntılar'}</button>
          </div>
        </details>
      </li>
    );
  };

  return (
    <div className="gd" ref={kok}>
      {/* yol izi (plan 27 Eki, 2.7): Akış › Üst görev › Görev; adlar tam, kesilmez, satıra sarar */}
      <nav className="gd-yol" aria-label="Konum">
        <button type="button" onClick={() => git(`/akis/${encodeURIComponent(kod)}`)} aria-label={`Akış: ${d.akis.baslik || akisAdi(d.akis)}`}>{d.akis.baslik || akisAdi(d.akis)}</button>
        {ust && <><i aria-hidden>›</i><button type="button" className="gd-ust" onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${ust.no}`)} aria-label={`Üst görev: ${ust.no}. ${ust.ad}`}>{ust.ad}</button></>}
        <i aria-hidden>›</i><span aria-current="page">{A.ad}</span>
      </nav>
      <header className={`gd-bas${ust ? ' gd-bas-alt' : ''}`}>
        {/* alt görev uydu boyunda (N24): üst görevinden küçük gezegen, "alt görev" etiketi */}
        <svg aria-hidden className="gd-gezegen" width="64" height="64" viewBox="-32 -32 64 64" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: gezegen(A, ust ? 13 : 22) + (altGorevler.length ? `<ellipse rx="31" ry="8" fill="none" stroke="#B9A6F2" stroke-width="1.6" stroke-opacity=".8" transform="rotate(-16)"/><text x="0" y="31" text-anchor="middle" font-size="10" font-weight="700" fill="#D9CCFF">${altGorevler.length - acikAlt.length}/${altGorevler.length}</text>` : '') }} />
        <div className="gd-bas-metin">
          {ust && <span className="gd-tur">ALT GÖREV</span>}
          <h2>{adimAdi(A)}</h2>
          <small>{kisaAd(A.sahip)} · {A.durum_etiket || A.durum}{krt ? ' · kritik yol' : ''}{A.karar_adimi ? ' · karar' : ''}{altGorevler.length ? ` · ${altGorevler.length - acikAlt.length}/${altGorevler.length} alt görev` : ''}</small>
        </div>
        <nav className="gd-gez" aria-label="Görevler arasında">
          <button type="button" aria-label={onceki != null ? `Önceki görev: ${onceki}` : 'Önceki görev yok'} disabled={onceki == null} onClick={() => adimaGit(onceki)}><svg aria-hidden viewBox="-9 -9 18 18"><path d="M3,-6 L-3,0 L3,6" /></svg></button>
          <button type="button" aria-label={sonraki != null ? `Sonraki görev: ${sonraki}` : 'Sonraki görev yok'} disabled={sonraki == null} onClick={() => adimaGit(sonraki)}><svg aria-hidden viewBox="-9 -9 18 18"><path d="M-3,-6 L3,0 L-3,6" /></svg></button>
          {kapat && <button type="button" aria-label="Kapat" onClick={kapat}><svg aria-hidden viewBox="-9 -9 18 18"><path d="M-5,-5 L5,5 M5,-5 L-5,5" /></svg></button>}
        </nav>
      </header>
      <p className="gd-cumle">{bekledigi.length && /adım bitince başlar\.$/.test(cumle)
        ? <>{bekledigi.map((n, j) => <span key={n}>{j ? ', ' : ''}<button type="button" className="metin-baglanti" aria-label={`${n}. görev: ${by.get(n)?.ad ?? ''}`} onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${n}`)}>{n}</button></span>)}. görev bitince başlar.</>
        : cumle.replace(/\badım\b/g, 'görev')}</p>
      <div className="gd-sayilar">
        {sayilar.map(([b, k], j) => <div key={k} className={`sayi-kutusu${j === 2 && ihlal ? ' ihlal' : ''}`} title={j === 2 && ihlal ? IHLAL_IPUCU : undefined}><b>{b}</b><small>{k}</small></div>)}
      </div>
      <div className="gd-eylem">
        {benim && !A.karar_adimi && !acikAlt.length && <Dugme className="statik" mesgul={bitir.isPending} onClick={() => bitir.mutate()}>Bitti olarak işaretle</Dugme>}
        {benim && acikAlt.length > 0 && <p className="gd-satir">Alt görevlerin hepsi bitince {A.karar_adimi || A.cikti_bekleniyor ? 'bu görevi sen tamamlarsın' : 'bu görev kendiliğinden tamamlanır'}.</p>}
        {benim && A.karar_adimi && <Dugme className="statik" onClick={() => kok.current?.querySelector('#gd-karar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Seçenekleri gör</Dugme>}
        {sahipDis && !BITTI(A.durum) && <Dugme className="statik" ikonX={56} kayma={14} onClick={() => setPaylas(true)}
          ikon={<svg aria-hidden width="40" height="30" viewBox="-20 -15 40 30" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 1, 0, 'dis', '', '#2A1D4F', .75) }} />}>{`${ozelEk(kisaAd(A.sahip), 'e')} bağlantı gönder`}</Dugme>}
        {claude && <Dugme className="statik" tur={benim || sahipDis ? 'ikincil' : 'birincil'} ton="lila" yukseklik={benim || sahipDis ? 48 : undefined} fs={benim || sahipDis ? 15 : undefined} onClick={() => window.open(claude, '_blank', 'noopener')}>Claude’da aç</Dugme>}
        {bitir.isError && <p className="canli-hata-satir" role="alert">{(bitir.error as Error).message}</p>}
      </div>

      {(altGorevler.length > 0 || altEklenir) && <Bolum baslik={altGorevler.length ? `ALT GÖREVLER · ${altGorevler.length - acikAlt.length}/${altGorevler.length}` : 'ALT GÖREVLER'} id="gd-alt-gorevler">
        {altGorevler.length > 0 && <ul className="gd-baglar gd-alt-liste">{altGorevler.map(altAkordiyon)}</ul>}
        {altEklenir && <form className="gd-alt-ekle" onSubmit={(e) => { e.preventDefault(); const t = altAd.trim(); if (t && !altEkle.isPending) altEkle.mutate(t); }}>
          <input className="alan" value={altAd} onChange={(e) => setAltAd(e.target.value)} placeholder="Alt görev ekle" aria-label="Yeni alt görevin adı" maxLength={120} />
          <button type="submit" className="gd-alt-ekle-dugme" disabled={!altAd.trim() || altEkle.isPending} aria-label="Alt görevi ekle">Ekle</button>
        </form>}
        {altBitir.isError && <p className="canli-hata-satir" role="alert">{(altBitir.error as Error).message}</p>}
        {altEkle.isError && <p className="canli-hata-satir" role="alert">{(altEkle.error as Error).message}</p>}
      </Bolum>}

      {yapilacak.length > 0 && <Bolum baslik="NE YAPILACAK">
        <dl className="gd-liste">{yapilacak.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      </Bolum>}

      <Bolum baslik="KİM">
        <div className="gd-kim">
          <svg aria-hidden width="36" height="30" viewBox="-18 -15 36 30" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: gemi }} />
          <span><b>{A.sahip}</b><small>{tip}{A.arac ? ` · ${A.arac}` : ''}{sahipAjan && A.agent_sahibi ? ` · ${kisaAd(A.agent_sahibi)} adına çalışır` : ''}{krt ? ' · kritik yolda' : ''}</small></span>
        </div>
        {pay.length > 0 && <p className="gd-satir">Katkı: {pay.map((p) => `${kisaAd(p.ad)} ${p.n} kayıt`).join(' · ')}</p>}
      </Bolum>

      <Bolum baslik="NE ZAMAN">
        <dl className="gd-liste gd-tarih">
          <div><dt>Başlangıç</dt><dd>{bas.ms ? `${gunAyHafta(bas.ms)} · ${bas.etiket}` : BITTI(A.durum) ? '–' : 'öncülleri bitince'}</dd></div>
          <div><dt>Bitiş</dt><dd>{bitis ? `${gunAyHafta(bitis.ms)} · ${bitis.etiket}` : 'tarih belli değil'}{A.sure_tahmin_gun ? ` · süre ${String(A.sure_tahmin_gun).replace('.', ',')} gün` : ''}</dd></div>
          <div className={ihlal ? 'ihlal' : ''}><dt>Son tarih</dt><dd>{A.son_tarih ? `${gunAyHafta(tarihMs(A.son_tarih))}${ihlal ? ' · en erken bitiş bunu aşıyor' : ''}` : 'yok'}</dd></div>
          {hp && <div><dt>Akış</dt><dd>{hp}</dd></div>}
        </dl>
        {d.bitis && !BITTI(A.durum) && <button type="button" className="metin-baglanti gd-neden" onClick={() => setNeden(true)}>Bu tarih neden?</button>}
      </Bolum>

      {(onde.length > 0 || sonra.length > 0) && <Bolum baslik="ETKİLEYEN VE ETKİLEDİĞİ">
        {onde.length > 0 && <><h4 className="gd-alt-baslik">Önce bitmesi gerekenler</h4><ul className="gd-baglar">{onde.map((z) => gorevSatiri(z, onculNotu(z)))}</ul></>}
        {sonra.length > 0 && <><h4 className="gd-alt-baslik">Bunu bekleyenler{dolayli > 0 ? ` · +${dolayli} dolaylı` : ''}</h4><ul className="gd-baglar">{sonra.map((z) => gorevSatiri(z, ardilNotu(z)))}</ul></>}
      </Bolum>}

      {A.karar_adimi && <Bolum baslik="KARAR" id="gd-karar"><KararBolumu a={A} kod={kod} ben={ben} /></Bolum>}

      {ciktiVar && <div id="gd-ciktilar" className="gd-bolum gd-ciktilar"><Ciktilar a={A} kod={kod} /></div>}

      {altlar.length > 0 && <Bolum baslik={`KALEMLER · ${altlar.length}`}>
        <ul className="gd-baglar">{altlar.map((k) => <li key={k.ad}><button type="button" className="gd-bag" onClick={() => (k.akis ? git(`/akis/${encodeURIComponent(k.akis)}`) : git(`/akis/${encodeURIComponent(kod)}/tekrar/${A.no}`))}><span><b>{k.ad}</b><small>{A.tekrar.kalem_turu || 'kalem'}</small></span></button></li>)}</ul>
      </Bolum>}

      <details id="gd-gecmis" className="gd-bolum gd-gecmis" open={gecmisAcik} onToggle={(e) => setGecmisAcik((e.target as HTMLDetailsElement).open)}>
        <summary className="gd-bolum-baslik">GEÇMİŞ{(A.olaylar || []).length ? ` · ${(A.olaylar || []).filter((e: any) => e.tip !== 'okuma').length}` : ''}</summary>
        {gecmisAcik && <AdimGecmis a={A} d={d} ben={ben} kod={kod} />}
      </details>

      {neden && <TarihNeden acik kapat={() => setNeden(false)} d={d} adimaGit={(n) => { setNeden(false); adimaGit(n); }} />}
      {paylas && <BaglantiGonder kod={kod} kisi={A.sahip} kisiId={A.sahip_kisi_id || (d.sahipler || []).find((x: any) => x.ad === A.sahip)?.kisi_id} adimSayisi={d.adimlar.filter((x: any) => x.sahip === A.sahip).length} kapat={() => setPaylas(false)} />}
    </div>
  );
}
