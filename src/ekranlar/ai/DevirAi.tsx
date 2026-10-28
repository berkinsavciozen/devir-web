import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiHatasi } from '../../api/istemci';
import { sorguIstemcisi, useBen } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { useBoyut } from '../../bilesen/Gok';
import { akisAdi } from '../../metin/turkce';
import { Dugme } from '../../bilesen/Dugme';
import { eslestir, yolAl } from '../../yonlendirme';

/**
 * Devir AI sohbeti (plan 27 Eki, Epic 5; sunucu 0.28.0 /sohbet). Sohbet bulunduğu sayfayı bilir (akış, adım);
 * okuma hemen olur, değişiklikler önizleme kartı olarak gelir ve "Uygula" ile yazılır. Atlama ve kapatma ayrıca onay ister.
 * Dış katılımcıda yoktur. Düğmeler (üst küme, panel üstü, akış başlığı) tek pencereyi açar.
 * Masaüstünde sağ panelin içeriği olur (plan 28 Eki, Q1: üst üste panel yok); telefonda alt sayfa. Sohbet kapanınca kaybolmaz.
 */
let aiAcik = false;
const dinleyenler = new Set<() => void>();
const yay = () => dinleyenler.forEach((f) => f());
export const devirAiAc = () => { aiAcik = true; yay(); };
export const devirAiKapat = () => { if (aiAcik) { aiAcik = false; yay(); } };
export const useAiAcik = () => useSyncExternalStore((f) => { dinleyenler.add(f); return () => { dinleyenler.delete(f); }; }, () => aiAcik);
// sohbet pencere kapanıp açılınca sürer (aynı oturumda)
const kayit: { mesajlar: Mesaj[]; yazi: string } = { mesajlar: [], yazi: '' };

export type Oneri = { id: string; arac: string; girdi: unknown; ozet: string; onay_gerekir?: boolean };
type Sonuc = { arac: string; ozet: string; mesaj?: string; hata?: string };
type Mesaj = { rol: 'kullanici' | 'asistan'; metin: string; oneriler?: Oneri[]; durum?: 'bekliyor' | 'onay' | 'uygulaniyor' | 'uygulandi' | 'vazgecildi'; sonuclar?: Sonuc[] };
type Kullanim = { oran: number; doldu: boolean; yenilenme_metin?: string };

/** Bulunulan sayfa: /akis/:kod ya da /akis/:kod/adim/:no (ve alt sayfaları). */
export function sayfaBaglami(yol: string): { akis?: string; adim?: number } {
  const a = eslestir('/akis/:kod/adim/:no', yol);
  if (a) return { akis: a.kod, adim: Number(a.no) };
  const k = /^\/akis\/([^/]+)/.exec(yol);
  return k ? { akis: decodeURIComponent(k[1]) } : {};
}

const ORNEKLER_GENEL = ['Bugün neye bakayım?', 'Hangi akışlar gecikmede?'];
const ORNEKLER_AKIS = ['Bu akışta ne gecikiyor?', 'Sırada ne var?'];

const YildizIkon = ({ r = 'var(--renk-vurgu-altin)' }: { r?: string }) => (
  <svg aria-hidden width="24" height="24" viewBox="-12 -12 24 24"><path d="M0,-9 C1,-3 3,-1 9,0 C3,1 1,3 0,9 C-1,3 -3,1 -9,0 C-3,-1 -1,-3 0,-9 Z" fill={r} /><circle cx="6.5" cy="-6.5" r="1.6" fill="var(--renk-vurgu-lila)" /></svg>
);

/** Devir AI düğmesi; dış katılımcıda çizilmez. `sinif` yerleşim içindir (üst küme, panel üstü, başlık sağı). */
export function DevirAiDugme({ sinif = '' }: { sinif?: string }) {
  const ben = useBen().data;
  if (!ben || ben.rol === 'dis') return null;
  return <button type="button" className={`zil-dugme ai-dugme ${sinif}`} aria-label="Devir AI" aria-haspopup="dialog" onClick={devirAiAc}><YildizIkon /></button>;
}

/** Uygulamaya bir kez yerleşir. Telefonda alt sayfa; masaüstünde panel sahipleri (DevirAiPanel) çizer. */
export function DevirAiKok() {
  const acik = useAiAcik();
  const boy = useBoyut();
  const genis = boy.w >= 1024 && boy.h >= 600;
  // başka sayfaya geçilince masaüstü paneli o sayfaya döner
  useEffect(() => {
    window.addEventListener('devir:yol', devirAiKapat);
    return () => window.removeEventListener('devir:yol', devirAiKapat);
  }, []);
  if (genis) return null;
  return (
    <AltSayfa acik={acik} kapat={devirAiKapat} baslik="Devir AI" yukseklik={60}>
      <DevirAiIcerik acik={acik} />
    </AltSayfa>
  );
}

/** Masaüstü: sağ panelin içeriği. Esc kapatır. */
export function DevirAiPanel() {
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === 'Escape') devirAiKapat(); };
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, []);
  return <section className="ai-panel" role="region" aria-label="Devir AI"><DevirAiIcerik acik /></section>;
}

function hataMetni(e: unknown) {
  if (e instanceof ApiHatasi) {
    if (e.durum === 503) return 'Devir AI şu an kapalı. Akışları elle güncellemeye devam edebilirsin.';
    if (e.durum === 403) return 'Devir AI bu hesapta kullanılamıyor.';
    return e.hata;
  }
  return (e as Error)?.message || 'Bir şey ters gitti.';
}

function DevirAiIcerik({ acik }: { acik: boolean }) {
  const [mesajlar, setMesajlar] = useState<Mesaj[]>(kayit.mesajlar);
  const [yazi, setYazi] = useState(kayit.yazi);
  useEffect(() => { kayit.mesajlar = mesajlar; kayit.yazi = yazi; }, [mesajlar, yazi]);
  const [bekle, setBekle] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sayfa, setSayfa] = useState<{ akis?: string; adim?: number }>({});
  const sonRef = useRef<HTMLDivElement>(null);
  const ku = useQuery({ queryKey: ['kullanim'], queryFn: () => api.get<{ kullanim: Kullanim }>('/kullanim'), enabled: acik, retry: false, staleTime: 60_000 });
  const k = ku.data?.kullanim;
  const doldu = !!k?.doldu;

  // pencere açılınca bağlam o anki sayfadan alınır (pencere açıkken sayfa değişmez)
  useEffect(() => { if (acik) setSayfa(sayfaBaglami(yolAl())); }, [acik]);
  useEffect(() => { sonRef.current?.scrollIntoView?.({ block: 'end' }); }, [mesajlar.length, bekle]);

  const guncelle = (i: number, d: Partial<Mesaj>) => setMesajlar((L) => L.map((m, j) => (j === i ? { ...m, ...d } : m)));

  async function gonder(metin: string) {
    const t = metin.trim();
    if (!t || bekle || doldu) return;
    const L: Mesaj[] = [...mesajlar, { rol: 'kullanici', metin: t }];
    setMesajlar(L); setYazi(''); setHata(null); setBekle(true);
    try {
      const r = await api.post<{ mesaj: string; oneriler?: Oneri[]; kullanim?: Kullanim }>('/sohbet', {
        mesajlar: L.map((m) => ({ rol: m.rol, metin: m.metin })),
        sayfa: { akis: sayfa.akis ?? null, adim: sayfa.adim ?? null },
      });
      const O = r.oneriler || [];
      setMesajlar((M) => [...M, { rol: 'asistan', metin: r.mesaj || '', oneriler: O, durum: O.length ? 'bekliyor' : undefined }]);
      if (r.kullanim) sorguIstemcisi.setQueryData(['kullanim'], { kullanim: r.kullanim });
    } catch (e) {
      setHata(hataMetni(e));
      if (e instanceof ApiHatasi && e.durum === 429) void ku.refetch();
    } finally { setBekle(false); }
  }

  async function uygula(i: number, onay: boolean) {
    const m = mesajlar[i];
    if (!m.oneriler?.length) return;
    if (!onay && m.oneriler.some((o) => o.onay_gerekir)) return guncelle(i, { durum: 'onay' });
    guncelle(i, { durum: 'uygulaniyor' });
    try {
      const r = await api.post<{ sonuclar: Sonuc[] }>('/sohbet/uygula', { oneriler: m.oneriler, ...(onay ? { onay: true } : {}) });
      guncelle(i, { durum: 'uygulandi', sonuclar: r.sonuclar });
      void sorguIstemcisi.invalidateQueries();
    } catch (e) {
      guncelle(i, { durum: 'bekliyor' });
      setHata(hataMetni(e));
    }
  }

  const ornekler = sayfa.akis ? ORNEKLER_AKIS : ORNEKLER_GENEL;
  // başlıkta akışın kısa adı (K7); veri önbellekte yoksa kod
  const ak = useQuery({ queryKey: ['akis', sayfa.akis], queryFn: () => api.get<any>(`/akis/${encodeURIComponent(sayfa.akis!)}`), enabled: !!sayfa.akis, staleTime: 60_000 });
  const akAd = sayfa.akis ? (ak.data?.akis ? akisAdi(ak.data.akis) : sayfa.akis) : '';
  return (
      <div className="ai-sohbet">
        <header className="ai-bas">
          <YildizIkon />
          <div>
            <h2>Devir AI</h2>
            <small>{sayfa.akis ? `${akAd}${sayfa.adim ? ` · ${sayfa.adim}. görev` : ''} hakkında` : 'Tüm akışların hakkında'}</small>
          </div>
        </header>
        {k && <p className={`ai-kullanim ${doldu ? 'doldu' : ''}`} aria-label="Devir AI kullanımı">
          {doldu ? `Bu ayın Devir AI kullanımı doldu; ${k.yenilenme_metin || 'ay başında'} yenilenir. Akışları elle güncellemeye devam edebilirsin.` : `Bu ayın kullanımı: %${Math.round(k.oran * 100)}`}
        </p>}
        <div className="ai-mesajlar" role="log" aria-label="Sohbet" aria-live="polite">
          {!mesajlar.length && <div className="ai-bos">
            <p>Akışların, görevlerin ve kararların hakkında sor. Bir değişiklik önerirsem önce gösteririm; sen Uygula demeden yazılmaz.</p>
            <div className="ai-ornekler">
              {ornekler.map((x) => <button key={x} type="button" className="filtre-cip" disabled={doldu || bekle} onClick={() => void gonder(x)}>{x}</button>)}
            </div>
          </div>}
          {mesajlar.map((m, i) => (
            <div key={i} className={`ai-mesaj ${m.rol}`}>
              {m.metin && <p>{m.metin}</p>}
              {!!m.oneriler?.length && <OneriKarti m={m} uygula={(onay) => void uygula(i, onay)} vazgec={() => guncelle(i, { durum: 'vazgecildi' })} />}
            </div>
          ))}
          {bekle && <div className="ai-mesaj asistan"><span className="nabiz" aria-label="Devir AI yazıyor"><i /><i /><i /></span></div>}
          <div ref={sonRef} />
        </div>
        {hata && <p className="canli-hata-satir ai-hata" role="alert">{hata}</p>}
        <form className="ai-giris" onSubmit={(e) => { e.preventDefault(); void gonder(yazi); }}>
          <textarea
            aria-label="Devir AI'a mesaj" rows={2} value={yazi} maxLength={4000} disabled={doldu}
            placeholder={doldu ? 'Kullanım sınırı doldu' : 'Bir şey sor ya da iste…'}
            onChange={(e) => setYazi(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void gonder(yazi); } }}
          />
          <button type="submit" className="ai-gonder" aria-label="Gönder" disabled={doldu || bekle || !yazi.trim()}>
            <svg aria-hidden width="22" height="22" viewBox="-11 -11 22 22"><path d="M-7,0 L7,0 M2,-5 L7,0 L2,5" stroke="var(--renk-metin-koyu-uzerine)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      </div>
  );
}

/** Önizleme kartı: değişikliklerin özeti; Uygula, ayrıca onay gerekenlerde ikinci adım. */
function OneriKarti({ m, uygula, vazgec }: { m: Mesaj; uygula: (onay: boolean) => void; vazgec: () => void }) {
  const O = m.oneriler || [];
  const S = m.sonuclar || [];
  return (
    <section className="ai-oneri" aria-label="Önerilen değişiklikler">
      <h3>{m.durum === 'uygulandi' ? 'UYGULANDI' : m.durum === 'vazgecildi' ? 'VAZGEÇİLDİ' : 'ÖNERİLEN DEĞİŞİKLİK'}</h3>
      <ul>
        {O.map((o, j) => {
          const s = S[j];
          return <li key={o.id} className={s?.hata ? 'hata' : s ? 'tamam' : ''}>
            <span>{o.ozet}</span>
            {o.onay_gerekir && !s && <small>Ayrıca onay ister</small>}
            {s && <small>{s.hata || 'Yazıldı'}</small>}
          </li>;
        })}
      </ul>
      {m.durum === 'bekliyor' && <div className="ai-oneri-eylem">
        <Dugme tur="ikincil" yukseklik={44} onClick={vazgec}>Vazgeç</Dugme>
        <Dugme yukseklik={44} onClick={() => uygula(false)}>Uygula</Dugme>
      </div>}
      {m.durum === 'onay' && <>
        <p className="ai-onay-cumle">Bu değişiklik bir adımı atlar ya da akışı kapatır. Emin misin?</p>
        <div className="ai-oneri-eylem">
          <Dugme tur="ikincil" yukseklik={44} onClick={vazgec}>Vazgeç</Dugme>
          <Dugme yukseklik={44} onClick={() => uygula(true)}>Evet, uygula</Dugme>
        </div>
      </>}
      {m.durum === 'uygulaniyor' && <span className="nabiz" aria-label="Uygulanıyor"><i /><i /><i /></span>}
    </section>
  );
}
