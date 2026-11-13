import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { ilerleme } from '../../api/ilerleme';
import { sorguIstemcisi, useBen } from '../../api/sorgular';
import { hedefPayi } from '../../bilesen/KararSeridi';
import { isSimge, kisiSimge } from '../../cizim/yorunge/simge';
import { gunAy, gunAyHafta, kisaAd, otoRozet, saat } from '../../cizim/yol.js';
import { adimAdi, akisAdi, tarihEk } from '../../metin/turkce';
import { arama, git } from '../../yonlendirme';
import { AdimGecmis, Ciktilar, isPayi, sureKisa, takvimIhlali, tuttuklari } from './Adim';
import { BaglantiSatiri } from './BaglantiGonder';
import { EylemCubugu } from './EylemCubugu';
import { aiArdilCumlesi, ajanMi, BITTI, ciktiCumlesi, eylemPlani, otoDurumCumlesi, otoUygun, sonHatirlatma } from './eylemler';
import { useSohbet } from './sohbet';
import { useAkis } from './Galaksi';
import { KararBolumu } from './Karar';
import { TarihNedenIcerik } from './TarihNeden';
import { GorevKart, kartCumlesi, kartTonu } from '../../bilesen/GorevKart';
import { damla, hamle, rutinYok } from '../../cizim/hamle';

const GUN = 864e5;
const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);
const durumGor = (a: any) => (BITTI(a.durum) ? (a.durum === 'atlandi' ? 'ghost' : 'lit') : a.durum === 'engelli' ? 'block' : a.durum === 'hazir' || a.durum === 'suruyor' ? 'wait' : 'dark');
// 13 Kas (U7c): haritadaki gezegenin aynısı (halka sahibinin renginde, ışık durum, içinde numara)
const gezegen = (a: any, r: number) => isSimge(a, 0, 0, r * .8);

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

// bölüm simgeleri (NE · NEDEN · NE ZAMAN): aynı çizgi dili, lila
const BOLUM_IKON: Record<string, string> = {
  ne: '<circle r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><circle r="2.4" fill="currentColor"/>',
  neden: '<path d="M-6,4 L0,-5 L6,4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><circle cy="-5" r="1.8" fill="currentColor"/>',
  zaman: '<circle r="7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M0,-4 V0 L3,2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
};
/** Tek bölüm bileşeni (W5 ikinci tur): her bölüm aynı kart, aynı başlık. */
function Bolum({ baslik, children, id, ikon }: { baslik: string; children: ReactNode; id?: string; ikon?: keyof typeof BOLUM_IKON }) {
  return <section className={`gd-bolum gd-kart${ikon ? ` gd-kart-${ikon}` : ''}`} aria-label={baslik} id={id}>
    <h3 className="gd-bolum-baslik">{ikon && <svg aria-hidden width="16" height="16" viewBox="-8 -8 16 16" dangerouslySetInnerHTML={{ __html: BOLUM_IKON[ikon] }} />}{baslik}</h3>{children}</section>;
}

/**
 * Tek görev detayı (W2; el notları N18–N22): bütün yüzeylerde aynı bileşen ve aynı bölüm sırası. Telefonda alt sayfanın,
 * masaüstünde akış panelinin içinde akar; sayfa ölçüsü kabuktan gelir.
 * Başlık ve durum → ne yapılacak → kim → ne zaman → etkileyen / etkilediği → karar (yalnız karar adımı) →
 * çıktı (bekleniyorsa ya da varsa) → alt görevler (varsa) → geçmiş (katlı).
 */
/** AI YAPSIN bölümünün tek satırı (W1): açık mı, açıksa ne olur. Ayrıntılı durum başlık altındaki cümlede. */
export function otoSatiri(a: any): string {
  const ag = a.sahip;
  return a.oto ? `Açık. Görev hazır olunca ${ag} kendiliğinden yapacak; çıktı onayına gelecek.` : `Kapalı. Açarsan görev hazır olunca ${ag} kendiliğinden yapacak. Karar, ödeme ve dışarıya gönderme işleri otomatik yapılmaz.`;
}

export function GorevDetay(o: { kod: string; no: number; ben: string; kapat?: () => void }) {
  // alt görevin adresi (plan 28 Eki, karar 4): üst görev sayfası, o alt görevin akordiyonu açık
  const akis = useAkis(o.kod);
  if (!akis.data) return <div className="gd"><div className="adim-yukleniyor" role="status" aria-label="Yükleniyor"><span /><span /></div></div>;
  const ust = akis.data.adimlar.find((x: any) => x.no === o.no)?.ust_adim;
  return ust != null ? <GorevIci {...o} no={ust} secAlt={o.no} /> : <GorevIci {...o} />;
}

function GorevIci({ kod, no, ben, kapat, secAlt }: { kod: string; no: number; ben: string; kapat?: () => void; secAlt?: number }) {
  const akis = useAkis(kod);
  const q = useQuery({ queryKey: ['adim', kod, no], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`) });
  const d = akis.data, a = q.data?.adim;
  const kok = useRef<HTMLDivElement>(null);
  const [neden, setNeden] = useState(false);
  const [paylas, setPaylas] = useState(false);
  const ciktiGirdisi = () => (kok.current?.querySelector('#gd-ciktilar input[type=file]') as HTMLInputElement | null)?.click();
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
  // alt görevler üst görevlerinin akordiyonunda; gezinme yalnız üst düzey görevler arasında
  const nolar: number[] = d ? d.adimlar.filter((x: any) => x.ust_adim == null).map((x: any) => x.no).sort((p: number, r: number) => p - r) : [];
  const i = nolar.indexOf(no), onceki = i > 0 ? nolar[i - 1] : null, sonraki = i >= 0 && i < nolar.length - 1 ? nolar[i + 1] : null;
  const adimaGit = (n: number | null) => { if (n != null) git(`/akis/${encodeURIComponent(kod)}/adim/${n}`, { yerine: true }); };
  useEffect(() => {
    const t = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || (e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable], [role=slider], [role=tablist]')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      // adres çizimden önce değişmiş olabilir (hızlı basış): komşu, adresteki görevden hesaplanır
      const m = location.pathname.match(/\/adim\/(\d+)/), an = m ? +m[1] : no, j = nolar.indexOf(d?.adimlar.find((x: any) => x.no === an)?.ust_adim ?? an);
      const h = j < 0 ? null : e.key === 'ArrowLeft' ? nolar[j - 1] : nolar[j + 1];
      if (h != null) { e.preventDefault(); adimaGit(h); }
    };
    addEventListener('keydown', t); return () => removeEventListener('keydown', t);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const yenile = () => { for (const k of [['akis', kod], ['adim', kod, no], ['ozet']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); };
  // W5: alt görev ekleme (tek düzey; alt görevin altına eklenmez)
  const [altAd, setAltAd] = useState('');
  const altEkle = useMutation({
    mutationFn: (ad: string) => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}/alt`, { alt_gorevler: [{ ad }] }),
    onSuccess: () => { setAltAd(''); yenile(); },
  });
  // AI yapsın (0.29.0): agent görevinin sahibi işaretler (W1: aç/kapat eylem çubuğunda; burada planlanan gün ayarı)
  const otoYaz = useMutation({ mutationFn: (g: Record<string, unknown>) => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${no}`, g), onSuccess: yenile });
  const tetikler = useQuery({ queryKey: ['tetikler'], queryFn: () => api.get<any>('/tetikler'), retry: false, staleTime: 60_000 });
  const { U, claudeYok } = useSohbet();
  // akışın sahibi: çalışma alanının sahibi (karar 4–5)
  const akisSahibi = useBen().data?.rol === 'sahip';

  if (!a || !d) return <div className="gd" ref={kok}><div className="adim-yukleniyor" role="status" aria-label="Yükleniyor"><span /><span /></div></div>;

  const by = new Map<number, any>(d.adimlar.map((x: any) => [x.no, x]));
  const dx = by.get(a.no) || {};
  const A = { ...dx, ...a };
  const kritik = new Set<number>(d.kritik_yol || []);
  const krt = kritik.has(A.no) && !BITTI(A.durum);
  const tut = tuttuklari(d.adimlar, A.no);
  const sahipAjan = ajanMi(A.sahip, A.sahip_tip), sahipDis = !sahipAjan && A.sahip_tip === 'dis' && A.sahip !== ben;
  const benim = A.sahip === ben && !BITTI(A.durum);
  const agentBenim = sahipAjan && (!A.agent_sahibi || A.agent_sahibi === ben);
  const otoGoster = agentBenim && !BITTI(A.durum) && otoUygun(A);
  const tetikYok = !!tetikler.data && !(tetikler.data.tetikler || []).length;
  const ihlal = takvimIhlali(A);
  const otoC = otoDurumCumlesi(A, { ben, tetikYok, sorular: d.acik_sorular, by, zaman: (ms) => (new Date(ms).toDateString() === new Date().toDateString() ? saat(ms) : `${gunAy(ms)} ${saat(ms)}`), ek: (t) => tarihEk(t, 'de'), kisa: (x) => (ajanMi(x) ? x : kisaAd(x)) });
  // kim: sahip + iş payı (kim ne kadar yazdı)
  const pay = isPayi(A.olaylar).filter((p) => p.ad !== A.sahip);
  const tip = A.sahip === ben ? 'sen' : sahipAjan ? 'AI agent' : A.sahip_tip === 'dis' ? 'dış katılımcı' : 'ekip';
  // ne zaman
  const bas = baslangic(A, by);
  const bitis = BITTI(A.durum) ? { ms: Date.parse(A.durum_at), etiket: A.durum === 'tamam' ? 'bitti' : A.durum_etiket || A.durum } : A.en_erken_bitis ? { ms: Date.parse(A.en_erken_bitis), etiket: 'en erken' } : null;
  const hp = hedefPayi(d.akis);
  // bağlar: öncüller (bitmeden başlayamaz) ve ardıllar (kaç gün kaydırır)
  const onde: any[] = (A.bagimli || []).map((n: number) => by.get(n)).filter(Boolean);
  const sonra: any[] = d.adimlar.filter((x: any) => (x.bagimli || []).includes(A.no));
  const dolayli = tut.length - sonra.filter((z) => !BITTI(z.durum)).length;
  // N17: çıktı bölümü yalnız gerekiyorsa; planlamada "çıktı yok" denen adımda, çıktı yazılmadıkça görünmez
  const ciktiVar = !!A.beklenen_cikti || A.cikti_bekleniyor === true || (A.ciktilar || []).length > 0 || A.cikti_sayisi > 0 || (benim && !A.karar_adimi && A.cikti_bekleniyor !== false);
  const altlar: any[] = A.tekrar?.kalemler || [];
  // W5 (N23, N24): gerçek alt görevler; alt görevin üstü
  const altGorevler: any[] = (A.alt_gorevler || []).map((n: number) => by.get(n)).filter(Boolean);
  const acikAlt = altGorevler.filter((z) => !BITTI(z.durum));
  // gösterilen k/n sunucunun ilerleme kuralıyla (m6) ve haritadaki uydu halkasıyla aynı: atlanan alt görev toplamdan düşer
  const altIl = ilerleme(altGorevler), altKN = `${altIl.tamam}/${altIl.toplam}`;
  const ust = A.ust_adim != null ? by.get(A.ust_adim) : null;
  const altEklenir = !ust && !BITTI(A.durum) && !A.tekrar;

  // alt görevler aynı sayfada akordiyon (plan 28 Eki, B5): bütün yönetimi içinde; ayrı sayfa yok
  const altAkordiyon = (z: any) => <AltGorev key={z.no} kod={kod} z={z} d={d} ben={ben} ustNo={A.no} acik={secAlt === z.no} />;

  const ciktiBolumu = <div id="gd-ciktilar" className="gd-bolum gd-kart gd-ciktilar"><Ciktilar a={A} kod={kod} claudeGizle /></div>;
  const hatirlatildi = sonHatirlatma(A.olaylar, ben, simdi());
  const plan = eylemPlani({ a: A, ben, acikAlt: acikAlt.length, tetikYok, akisSahibi, claudeYok, hatirlatildi });
  // AI yapsın işini etkileyen görev: bitince hangi agent kendiliğinden başlar (9 Kas, AI yapsın netliği)
  const aiArdil = aiArdilCumlesi(A, d.adimlar, ben, (x) => (ajanMi(x) ? x : kisaAd(x)));

  // W5 ikinci tur (Berkin 20:26): bölüm bölüm, hepsi aynı kart bileşeni; ilk bakışta NE yapılacak, NEDEN ve NE ZAMAN.
  // Başlık kartı (kim, durum) · eylem · ÇIKTILAR · NE YAPILACAK · NEDEN (bunu bekleyenler) · NE ZAMAN (zaman çizgisi, önce bitmesi
  // gerekenler) · karar / çıktı / AI yapsın / alt görevler / kalemler · geçmiş. Alt sayfa yok: tarih nedeni ve bağlantı satır içinde.
  // tek ipucu cümlesi: AI durumu ya da beklenen çıktı ("…bekleniyor. Ekleyince bitirebilirsin.")
  const ipucu = otoC || ciktiCumlesi(A, ben);
  const h = hamle(A, { ben, rutinYok: tetikYok });
  const simdiMs = simdi();
  const kc = kartCumlesi(A, ben), G = { ton: kartTonu(A, ben) };
  const adBas = adimAdi(A) + ': ';
  const gCumle = kc.startsWith(adBas) ? kc.slice(adBas.length).replace(/^./, (c) => c.toLocaleUpperCase('tr')) : kc;
  // durum hapları: tek satır, renk yalnız uyarıda
  const haplar: { t: string; ton?: 'uyari' | 'vurgu' }[] = [];
  if (BITTI(A.durum)) haplar.push({ t: `${A.durum === 'tamam' ? 'Bitti' : A.durum_etiket || A.durum}${A.durum_at ? ` · ${gunAy(Date.parse(A.durum_at))}` : ''}` });
  else if (A.durum === 'engelli') haplar.push({ t: `Engelli · ${sureKisa(A.bekleme_saat)}`, ton: 'uyari' });
  else if (A.durum === 'hazir') haplar.push({ t: `Sırası geldi · ${sureKisa(A.bekleme_saat)}`, ton: 'vurgu' });
  else if (A.durum === 'suruyor') haplar.push({ t: `Sürüyor · ${sureKisa(A.bekleme_saat)}`, ton: 'vurgu' });
  else haplar.push({ t: (A.durum_etiket || 'sırada').replace(/^./, (c: string) => c.toLocaleUpperCase('tr')) });
  if (ihlal) haplar.push({ t: 'Son tarih riskte', ton: 'uyari' });
  if (krt) haplar.push({ t: 'Kritik yol' });
  if (A.karar_adimi) haplar.push({ t: 'Karar' });
  if (altGorevler.length) haplar.push({ t: `${altKN} alt görev` });
  const soruOf = (k: string) => [...(d.acik_sorular || []), ...(d.sorular || [])].find((q: any) => q.kod === k);
  const ne: [string, string][] = [];
  if (A.aciklama) ne.push(['Amaç', A.aciklama]);
  if (A.beklenen_cikti) ne.push(['Çıktı', A.beklenen_cikti]);
  if (A.kriter) ne.push(['Bitti sayılır', A.kriter]);
  if (A.kosul?.soru) ne.push(['Koşul', `“${soruOf(A.kosul.soru)?.soru || A.kosul.soru}” cevabı ${String(A.kosul.deger).split('|').map((x) => `“${x}”`).join(' ya da ')} olursa yapılır.`]);
  if (A.durum === 'atlandi' || A.durum === 'ertelendi') { const n = (A.olaylar || []).find((e: any) => e.tip === 'durum' && e.durum === A.durum); ne.push([A.durum === 'atlandi' ? 'Atlandı' : 'Ertelendi', n?.ozet || A.durum_etiket || '']); }
  // NEDEN: bu görev kimi tutuyor
  const acikSonra = sonra.filter((z) => !BITTI(z.durum));
  const neden0 = BITTI(A.durum) ? (sonra.length ? 'Bitti; bekleyenlerin önü açıldı.' : 'Bitti.')
    : tut.length ? `${tut.length} görev bunun bitmesini bekliyor${krt ? '; kritik yolda, her gün gecikmesi akışın bitişini bir gün kaydırır' : ''}.`
    : ust ? `${adimAdi(ust)} görevinin parçası; o, alt görevleri bitince tamamlanacak.` : 'Bunu bekleyen başka görev yok.';
  // zaman çizgisi: başlangıç · bugün · bitiş · son tarih (yalnız bilinenler)
  const nokta: { k: string; ms: number; t: 'bas' | 'bugun' | 'bitis' | 'son' }[] = [];
  if (bas.ms) nokta.push({ k: bas.etiket === 'başladı' ? 'başladı' : bas.etiket === 'sırası geldi' ? 'sırası geldi' : 'en erken başlayacak', ms: bas.ms, t: 'bas' });
  if (!BITTI(A.durum)) nokta.push({ k: 'bugün', ms: simdiMs, t: 'bugun' });
  if (bitis) nokta.push({ k: bitis.etiket === 'en erken' ? 'en erken bitecek' : bitis.etiket, ms: bitis.ms, t: 'bitis' });
  if (A.son_tarih) nokta.push({ k: 'son tarih', ms: tarihMs(A.son_tarih), t: 'son' });
  const gunu = (ms: number) => new Date(ms).toDateString();
  for (let j = nokta.length - 1; j > 0; j--) for (let i = 0; i < j; i++) if (nokta[i].t !== 'bugun' && nokta[j].t !== 'bugun' && gunu(nokta[i].ms) === gunu(nokta[j].ms)) { nokta[i].k = nokta[i].t === 'bas' && nokta[j].t === 'bitis' ? 'başlayıp bitecek' : `${nokta[i].k} · ${nokta[j].k}`; nokta.splice(j, 1); break; }
  nokta.sort((p, r) => p.ms - r.ms);
  const z0 = nokta.length ? nokta[0].ms : 0, z1 = nokta.length ? nokta[nokta.length - 1].ms : 1, zw = Math.max(z1 - z0, GUN);
  const zx = (ms: number) => (nokta.length < 2 ? 50 : 4 + 92 * ((ms - z0) / zw));
  const yukari = nokta.map(() => false);
  for (let j = 1; j < nokta.length; j++) if (!yukari[j - 1] && zx(nokta[j].ms) - zx(nokta[j - 1].ms) < 16) yukari[j] = true;
  const ne_zaman: [string, string, boolean?][] = [];
  if (A.son_tarih) ne_zaman.push(['Son tarih', gunAyHafta(tarihMs(A.son_tarih)) + (ihlal ? ' · en erken bitiş bunu aşıyor' : ''), ihlal]);
  if (bitis) ne_zaman.push([BITTI(A.durum) ? 'Bitti' : 'En erken bitiş', gunAyHafta(bitis.ms)]);
  if (A.sure_tahmin_gun && !BITTI(A.durum)) ne_zaman.push(['Süre', `${String(A.sure_tahmin_gun).replace('.', ',')} gün`]);
  if (hp) ne_zaman.push(['Akış', hp]);
  const acikOnce = onde.filter((z) => !BITTI(z.durum));
  const sahipAd = A.sahip === ben ? 'Sen' : sahipAjan ? A.sahip : kisaAd(A.sahip);
  const gemiKucuk = kisiSimge({ ad: A.sahip, tip: sahipAjan ? 'agent' : sahipDis ? 'dis' : 'insan', sahibi: A.agent_sahibi }, 0, 0, .58);
  const kartlar = (l: any[], not: (z: any) => string | null) => <ul className="gd-kartlar">{l.map((z) => { const n = not(z); return (
    <li key={z.no}><GorevKart a={z} d={d} ben={ben} now={simdiMs} ac={() => git(`/akis/${encodeURIComponent(kod)}/adim/${z.no}`)} />{n && <small className="gd-kart-not">{n}</small>}</li>); })}</ul>;
  const ardilKisa = (z: any) => {
    if (BITTI(A.durum) || BITTI(z.durum)) return null;
    const g = kaydirmaPayi(A, z, by);
    return g == null ? null : g === 0 ? 'Bu görevin her gün gecikmesi onu bir gün kaydırır.' : `Bu görev ${g} güne kadar gecikirse onu kaydırmaz.`;
  };
  const satirlar = (L: [string, string, boolean?][]) => <dl className="gd-satirlar">{L.map(([k, v, uy]) => <div key={k} className={uy ? 'ihlal' : undefined}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;

  const komsu = (n: number | null, yon: 'Önceki' | 'Sonraki') => {
    const z = n == null ? null : d.adimlar.find((x: any) => x.no === n);
    if (!z) return null;
    return (
      <button type="button" className={`gd-komsu gd-komsu-${yon === 'Önceki' ? 'ust' : 'alt'}`} aria-label={`${yon} görev: ${z.no}. ${z.ad}`} title={`${yon} görev (${yon === 'Önceki' ? '←' : '→'})`} onClick={() => adimaGit(n)}>
        <svg aria-hidden width="52" height="22" viewBox="-26 -11 52 22" dangerouslySetInnerHTML={{ __html: gezegen(z, 6.5) }} />
        <span><small>{yon.toLocaleUpperCase('tr')}</small> {z.ad}</span>
      </button>
    );
  };
  return (
    <div className="gd" ref={kok}>
      {/* başlık kartı: akış ve sahip; gezegen, ad, görev cümlesi; durum hapları; engel */}
      <header className={`gd-kart gd-bas-kart${ust ? ' gd-bas-alt' : ''}`}>
        <div className="gd-r1">
          <nav className="gd-yol" aria-label="Konum">
            <button type="button" onClick={() => git(`/akis/${encodeURIComponent(kod)}`)} aria-label={`Akış: ${d.akis.baslik || akisAdi(d.akis)}`}><i className="gd-maske" aria-hidden>{(akisAdi(d.akis) || '?')[0]}</i>{akisAdi(d.akis)}</button>
            {ust && <><i aria-hidden>›</i><button type="button" className="gd-ust" onClick={() => git(`/akis/${encodeURIComponent(kod)}/adim/${ust.no}`)} aria-label={`Üst görev: ${ust.no}. ${ust.ad}`}>{adimAdi(ust)}</button></>}
          </nav>
          <span className="gd-r1-kim" title={`${A.sahip} · ${tip}${A.arac ? ` · ${A.arac}` : ''}`}>
            <svg aria-hidden width="26" height="22" viewBox="-13 -11 26 22" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: gemiKucuk }} />
            <span>{sahipAd}</span>
          </span>
          {kapat && <button type="button" className="gd-kapat" aria-label="Kapat" onClick={kapat}><svg aria-hidden viewBox="-9 -9 18 18"><path d="M-5,-5 L5,5 M5,-5 L-5,5" /></svg></button>}
        </div>
        {/* Berkin 6 Kas 20:49: ok yerine zincir; önceki ve sonraki görev büyük gezegenin üstünde ve altında, küçük adıyla, durumu gezegeninde */}
        {komsu(onceki, 'Önceki')}
        <div className={`gd-bas${onceki != null ? ' z-ust' : ''}${sonraki != null ? ' z-alt' : ''}`}>
          <svg aria-hidden className="gd-gezegen" width="52" height="52" viewBox="-26 -26 52 52" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: gezegen(A, ust ? 12 : 17) + (altGorevler.length ? `<ellipse rx="25" ry="6.5" fill="none" stroke="#B9A6F2" stroke-width="1.5" stroke-opacity=".8" transform="rotate(-16)"/>` : '') + (h ? damla(h, 0, ust ? -20 : -25, .85) : '') }} />
          <div className="gd-bas-metin">
            {ust && <span className="gd-tur">ALT GÖREV</span>}
            {/* detayda tam ad (P1-F; satırlarda kısa ad) */}
            <h2>{A.ad}</h2>
            <p className={`gd-gorev-cumle ton-${G.ton}`}>{gCumle}{sahipAjan && A.agent_sahibi ? ` · ${kisaAd(A.agent_sahibi)} adına` : ''}</p>
          </div>
        </div>
        {komsu(sonraki, 'Sonraki')}
        <ul className="gd-haplar" aria-label="Durum">{haplar.map((x) => <li key={x.t} className={x.ton ? `h-${x.ton}` : undefined}>{x.t}</li>)}</ul>
        {A.durum === 'engelli' && A.engel ? <p className="gd-engel" role="status"><b>Engel</b> {A.engel}</p>
          : ipucu ? <p className="gd-cumle">{ipucu}</p> : null}
      </header>

      <EylemCubugu a={A} kod={kod} plan={plan} hamle={h} ciktiEkle={ciktiGirdisi} baglantiAc={() => setPaylas((x) => !x)}>
        {hatirlatildi && !plan.ana && !plan.ikincil && <p className="gd-satir">Bugün hatırlattın; {kisaAd(A.sahip_tip === 'agent' && A.agent_sahibi ? A.agent_sahibi : A.sahip)} bildirim aldı.</p>}
        {A.sahip === ben && acikAlt.length > 0 && <p className="gd-satir">Alt görevlerin hepsi bitince {A.karar_adimi || A.cikti_bekleniyor ? 'bu görevi sen tamamlayacaksın' : 'bu görev kendiliğinden tamamlanacak'}.</p>}
      </EylemCubugu>
      {paylas && <BaglantiSatiri kod={kod} kisi={A.sahip} kisiId={A.sahip_kisi_id || (d.sahipler || []).find((x: any) => x.ad === A.sahip)?.kisi_id} adimSayisi={d.adimlar.filter((x: any) => x.sahip === A.sahip).length} kapat={() => setPaylas(false)} />}

      {/* karar görevinde karar formu eylemin kendisi: eylemlerin hemen altında (W1) */}
      {A.karar_adimi && <Bolum baslik="KARAR" id="gd-karar"><KararBolumu a={A} kod={kod} ben={ben} /></Bolum>}

      {/* 12 Kas (Berkin): çıktılar eylemlerin (karar görevinde karar formunun) hemen altında */}
      {ciktiVar && ciktiBolumu}

      {/* NE · NEDEN · NE ZAMAN */}
      <Bolum baslik="NE YAPILACAK" ikon="ne">
        {ne.length ? satirlar(ne) : <p className="gd-satir">{adimAdi(A)}. Ayrıntı yazılmamış.</p>}
      </Bolum>

      <Bolum baslik="NEDEN" ikon="neden">
        <p className="gd-lead">{neden0}</p>
        {aiArdil && <p className="gd-satir gd-ai-ardil" role="note">{aiArdil}</p>}
        {acikSonra.length > 0 && kartlar(acikSonra.slice(0, 3), ardilKisa)}
        {acikSonra.length > 3 && <p className="gd-satir">+{acikSonra.length - 3} görev daha{dolayli > 0 ? `, ${dolayli} dolaylı` : ''}</p>}
        {acikSonra.length <= 3 && dolayli > 0 && <p className="gd-satir">Onların ardından {dolayli} görev daha dolaylı bekliyor.</p>}
      </Bolum>

      <Bolum baslik="NE ZAMAN" ikon="zaman">
        {nokta.length > 1 && <div className="gd-zaman-cizgi" aria-hidden>
          <span className="gd-zaman-yol" style={{ left: `${zx(nokta[0].ms)}%`, right: `${100 - zx(nokta[nokta.length - 1].ms)}%` }} />
          {nokta.map((n, j) => <span key={n.t} className={`gd-zaman-nokta z-${n.t}${n.t === 'son' && ihlal ? ' ihlal' : ''}${yukari[j] ? ' alt' : ''}`} style={{ left: `${zx(n.ms)}%` }}>
            <i /><b>{n.t === 'bugun' ? 'Bugün' : gunAy(n.ms)}</b><small>{n.t === 'bugun' ? '' : n.k}</small>
          </span>)}
        </div>}
        {ne_zaman.length > 0 ? satirlar(ne_zaman) : <p className="gd-satir">{BITTI(A.durum) ? '–' : 'Önündeki görevler bitince tarih belli olur.'}</p>}
        {d.bitis && !BITTI(A.durum) && <button type="button" className="metin-baglanti gd-neden" aria-expanded={neden} onClick={() => setNeden(!neden)}>{neden ? 'Gizle' : 'Bu tarih neden?'}</button>}
        {neden && d.bitis && <div className="gd-satir-ici"><TarihNedenIcerik b={d.bitis} oz={d.akis?.karar_ozeti} adimlar={d.adimlar} adimaGit={(n) => { setNeden(false); adimaGit(n); }} /></div>}
        {onde.length > 0 && <>
          <h4 className="gd-alt-baslik">{acikOnce.length ? `Önce bunlar bitmeli · ${onde.length - acikOnce.length}/${onde.length} bitti` : `Önündeki ${onde.length} görev bitti`}</h4>
          {acikOnce.length > 0 && kartlar(acikOnce, () => null)}
        </>}
      </Bolum>


      {otoGoster && <Bolum baslik="AI YAPSIN" id="gd-oto">
        <p className="gd-satir" role="status">{otoSatiri(A)}</p>
        {A.oto && <label className="gd-oto-sec"><input type="checkbox" checked={!!A.oto_tarih_bekle} disabled={otoYaz.isPending} onChange={(e) => otoYaz.mutate({ oto_tarih_bekle: e.target.checked })} /><span>Planlanan başlangıç gününü beklesin</span></label>}
        {claudeYok && tetikYok && <p className="gd-satir">AI yapsın şimdilik yalnız Claude’la çalışır; sende {U.ad} bağlı. Kendiliğinden yapılsın istersen Claude’u da bağlayıp rutini kur, o zamana kadar {U.da} açıp birlikte yap. <button type="button" className="metin-baglanti" onClick={() => git('/bagla?uygulama=claude')}>Claude’u bağla</button></p>}
        {A.oto && !BITTI(A.durum) && rutinYok(A, tetikYok) && (!A.agent_sahibi || A.agent_sahibi === ben) && !claudeYok && <p className="gd-satir">Henüz Claude rutinini kurmadın; görev hazır olunca kendiliğinden başlamaz. <button type="button" className="metin-baglanti" onClick={() => git('/ayarlar?bolum=ben&kur=ai')}>Kurulumu aç</button></p>}
        {otoYaz.isError && <p className="canli-hata-satir" role="alert">{(otoYaz.error as Error).message}</p>}
      </Bolum>}

      {(altGorevler.length > 0 || altEklenir) && <Bolum baslik={altGorevler.length ? `ALT GÖREVLER · ${altKN}` : 'ALT GÖREVLER'} id="gd-alt-gorevler">
        {altGorevler.length > 0 && <ul className="gd-baglar gd-alt-liste">{altGorevler.map(altAkordiyon)}</ul>}
        {altEklenir && <form className="gd-alt-ekle" onSubmit={(e) => { e.preventDefault(); const t = altAd.trim(); if (t && !altEkle.isPending) altEkle.mutate(t); }}>
          <input className="alan" value={altAd} onChange={(e) => setAltAd(e.target.value)} placeholder="Alt görev ekle" aria-label="Yeni alt görevin adı" maxLength={120} />
          <button type="submit" className="gd-alt-ekle-dugme" disabled={!altAd.trim() || altEkle.isPending} aria-label="Alt görevi ekle">Ekle</button>
        </form>}
        {altEkle.isError && <p className="canli-hata-satir" role="alert">{(altEkle.error as Error).message}</p>}
      </Bolum>}

      {altlar.length > 0 && <Bolum baslik={`KALEMLER · ${altlar.length}`}>
        <ul className="gd-baglar">{altlar.map((k) => <li key={k.ad}><button type="button" className="gd-bag" onClick={() => (k.akis ? git(`/akis/${encodeURIComponent(k.akis)}`) : git(`/akis/${encodeURIComponent(kod)}/tekrar/${A.no}`))}><span><b>{k.ad}</b><small>{A.tekrar.kalem_turu || 'kalem'}</small></span></button></li>)}</ul>
      </Bolum>}

      <details id="gd-gecmis" className="gd-bolum gd-kart gd-gecmis" open={gecmisAcik} onToggle={(e) => setGecmisAcik((e.target as HTMLDetailsElement).open)}>
        <summary className="gd-bolum-baslik">GEÇMİŞ{(A.olaylar || []).length ? ` · ${(A.olaylar || []).filter((e: any) => e.tip !== 'okuma').length}` : ''}</summary>
        {gecmisAcik && <>
          <p className="gd-satir">{A.sahip} · {tip}{A.arac ? ` · ${A.arac}` : ''}{pay.length > 0 ? ` · katkı: ${pay.map((p) => `${kisaAd(p.ad)} ${p.n} kayıt`).join(', ')}` : ''}</p>
          <AdimGecmis a={A} d={d} ben={ben} kod={kod} />
        </>}
      </details>
    </div>
  );
}

/**
 * Alt görev akordiyonu (plan 28 Eki, B5): durum düğmeleri, sahip, son tarih, çıktılar, notlar, karar ve "Claude'da aç"
 * aynı yerde. Açılınca alt görevin ayrıntısı yüklenir; alt görevin adresi bu akordiyonu açık getirir.
 */
function AltGorev({ kod, z, d, ben, ustNo, acik: ilkAcik }: { kod: string; z: any; d: any; ben: string; ustNo: number; acik: boolean }) {
  const [acik, setAcik] = useState(ilkAcik);
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!ilkAcik) return;
    setAcik(true);
    const t = setTimeout(() => ref.current?.scrollIntoView({ block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [ilkAcik]);
  return (
    <li>
      <details ref={ref} className="gd-akordiyon" open={acik} onToggle={(e) => setAcik((e.target as HTMLDetailsElement).open)}>
        <summary aria-label={`${z.no}. alt görev: ${z.ad}. ${z.durum_etiket || z.durum}`}>
          <svg aria-hidden width="28" height="28" viewBox="-14 -14 28 28" dangerouslySetInnerHTML={{ __html: gezegen(z, 9) }} />
          <span><b>{adimAdi(z)}</b><small>{kisaAd(z.sahip)} · {z.durum_etiket || z.durum}{z.son_tarih ? ` · son tarih ${gunAy(tarihMs(z.son_tarih))}` : ''}</small></span>
          <svg aria-hidden className="gd-akordiyon-ok" width="14" height="14" viewBox="-7 -7 14 14"><path d="M-4,-2 L0,2 L4,-2" /></svg>
        </summary>
        {acik && <AltGorevIcerik kod={kod} z={z} d={d} ben={ben} ustNo={ustNo} />}
      </details>
    </li>
  );
}

function AltGorevIcerik({ kod, z, d, ben, ustNo }: { kod: string; z: any; d: any; ben: string; ustNo: number }) {
  const q = useQuery({ queryKey: ['adim', kod, z.no], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(kod)}/adim/${z.no}`) });
  const tetikler = useQuery({ queryKey: ['tetikler'], queryFn: () => api.get<any>('/tetikler'), retry: false, staleTime: 60_000 });
  const { claudeYok } = useSohbet();
  const akisSahibi = useBen().data?.rol === 'sahip';
  const Z = { ...z, ...(q.data?.adim || {}) };
  const yenile = () => { for (const k of [['akis', kod], ['adim', kod, z.no], ['adim', kod, ustNo], ['ozet']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); };
  const yaz = useMutation({ mutationFn: (g: Record<string, unknown>) => api.post<any>(`/akis/${encodeURIComponent(kod)}/adim/${z.no}`, g), onSuccess: yenile });
  const [not, setNot] = useState('');
  const [paylas, setPaylas] = useState(false);
  const kok = useRef<HTMLDivElement>(null);
  const bitti = BITTI(Z.durum);
  // karar 5: alt görevi yalnız sahibi (agent'ında agent'ın sahibi) ve akış sahibi yönetir; diğerleri okur
  const yetkili = Z.sahip === ben || (ajanMi(Z.sahip, Z.sahip_tip) && (!Z.agent_sahibi || Z.agent_sahibi === ben)) || akisSahibi;
  const tetikYok = !!tetikler.data && !(tetikler.data.tetikler || []).length;
  // karar 6–7: aynı düğme planı (AI yapsın, Engeli kaldır, Yeniden aç); karar alt görevinde karar formu hemen altta
  const plan = eylemPlani({ a: Z, ben, acikAlt: 0, tetikYok, akisSahibi, alt: true, claudeYok });
  const altPlan = { ...plan, ana: plan.ana === 'karar_ver' ? null : plan.ana };
  const t = bitti ? (Z.durum_at ? `bitti ${gunAy(Date.parse(Z.durum_at))}` : '–') : Z.en_erken_bitis ? `en erken ${gunAyHafta(Date.parse(Z.en_erken_bitis))}` : 'öncülleri bitince';
  const kisiler: { ad: string; tip: string }[] = (d.sahipler || []).map((x: any) => ({ ad: x.ad, tip: x.tip }));
  if (!kisiler.some((x) => x.ad === Z.sahip)) kisiler.unshift({ ad: Z.sahip, tip: Z.sahip_tip });
  const notlar = (Z.olaylar || []).filter((e: any) => e.tip === 'not' && e.ozet).slice(0, 3);
  const id = `alt-${z.no}`;
  const kilitli = bitti || yaz.isPending || !yetkili;
  return (
    <div className="gd-alt-icerik" ref={kok}>
      {q.data && <EylemCubugu a={Z} kod={kod} plan={altPlan} kucuk ustNo={ustNo}
        ciktiEkle={() => (kok.current?.querySelector('.gd-alt-cikti input[type=file]') as HTMLInputElement | null)?.click()}
        baglantiAc={() => setPaylas((x) => !x)} />}
      {paylas && <BaglantiSatiri kod={kod} kisi={Z.sahip} kisiId={Z.sahip_kisi_id || (d.sahipler || []).find((x: any) => x.ad === Z.sahip)?.kisi_id} adimSayisi={d.adimlar.filter((x: any) => x.sahip === Z.sahip).length} kapat={() => setPaylas(false)} />}
      {!yetkili && !bitti && <p className="gd-satir">Bu alt görevi {kisaAd(ajanMi(Z.sahip, Z.sahip_tip) && Z.agent_sahibi ? Z.agent_sahibi : Z.sahip)} ve çalışma alanının sahibi yönetir; sen not ekleyebilirsin.</p>}
      <dl className="gd-liste">
        <div><dt><label htmlFor={`${id}-sahip`}>Sahip</label></dt><dd>
          <select id={`${id}-sahip`} className="gd-alt-secim" value={Z.sahip} disabled={kilitli} onChange={(e) => { const k = kisiler.find((x) => x.ad === e.target.value); if (k) yaz.mutate({ sahip: k.ad, sahip_tip: k.tip }); }}>
            {kisiler.map((k) => <option key={k.ad} value={k.ad}>{k.ad}</option>)}
          </select>
          {ajanMi(Z.sahip, Z.sahip_tip) && Z.agent_sahibi ? <small> {kisaAd(Z.agent_sahibi)} adına</small> : null}
        </dd></div>
        <div><dt>Durum</dt><dd>{Z.durum_etiket || Z.durum}{Z.engel ? ` · ${Z.engel}` : ''}</dd></div>
        <div><dt>Bitiş</dt><dd>{t}</dd></div>
        <div><dt><label htmlFor={`${id}-son`}>Son tarih</label></dt><dd>
          <input id={`${id}-son`} type="date" className="gd-alt-secim" value={(Z.son_tarih || '').slice(0, 10)} disabled={kilitli} onChange={(e) => { if (e.target.value) yaz.mutate({ son_tarih: e.target.value }); }} />
        </dd></div>
        {Z.kriter && <div><dt>Kabul kriteri</dt><dd>{Z.kriter}</dd></div>}
      </dl>
      {Z.karar_adimi && q.data && <div className="gd-alt-karar"><KararBolumu a={Z} kod={kod} ben={ben} /></div>}
      {/* çıktılar ve "Claude'da aç" (Ciktilar içinde) */}
      {q.data && <div className="gd-alt-cikti gd-ciktilar"><Ciktilar a={Z} kod={kod} /></div>}
      <div className="gd-alt-notlar">
        {notlar.length > 0 && <ul aria-label="Notlar">{notlar.map((e: any) => <li key={e.id}><small>{gunAy(Date.parse(e.zaman))} · {kisaAd(e.kim)}</small>{e.ozet}</li>)}</ul>}
        <form className="gd-alt-ekle" onSubmit={(e) => { e.preventDefault(); const v = not.trim(); if (v) yaz.mutate({ not: v }, { onSuccess: () => setNot('') }); }}>
          <input className="alan" value={not} onChange={(e) => setNot(e.target.value)} placeholder="Not ekle" aria-label={`${z.no}. alt göreve not`} maxLength={500} />
          <button type="submit" className="gd-alt-ekle-dugme" aria-label="Notu ekle" disabled={!not.trim() || yaz.isPending}>Ekle</button>
        </form>
      </div>
      {yaz.isError && <p className="canli-hata-satir" role="alert">{(yaz.error as Error).message}</p>}
    </div>
  );
}
