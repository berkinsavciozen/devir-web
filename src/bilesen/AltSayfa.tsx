import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Alt sayfa (spesifikasyon §3.12, §12).
 * Yükseklikler 390×844 tasarım karesinde üst kenarın y'sidir (orta 330, yüksek 150); başka ekran
 * yüksekliğinde sayfa boyu sabit kalır (üst = ekran − (844 − y)).
 * Tutamaçtan sürükle: orta ↔ yüksek. Aşağı fırlat ya da arkaya dokun: kapat. Geri hareketi önce sayfayı kapatır.
 * Güçlü onayda (guclu) yalnız "Vazgeç" ve geri hareketi kapatır.
 * Masaüstünde (≥ 1280) sağ panele dönüşür.
 */
export interface AltSayfaOz {
  acik: boolean;
  kapat: () => void;
  baslik?: string;
  /** tasarım karesinde üst kenar; 'orta' = 330, 'yuksek' = 150 ya da sayı */
  yukseklik?: 'orta' | 'yuksek' | number;
  /** sürükleyince geçilebilecek yükseklikler */
  duraklar?: Array<'orta' | 'yuksek' | number>;
  guclu?: boolean;
  /** yazı girilmişse geri hareketi önce sorar */
  kirli?: boolean;
  /** arka örtüyü sayfa çizmez (ekran kendi kararmasını ve üstündeki seçimi çizer); dokununca yine kapatır */
  perdesiz?: boolean;
  /** Perdenin üstünde, sayfanın dışında kalan denetimler (ör. adımlar arası gezinme) */
  ust?: ReactNode;
  children: ReactNode;
}

const TASARIM_H = 844;
const acikSayfalar = new Set<string>();
const Y = { orta: 330, yuksek: 150 } as const;
const yOf = (v: 'orta' | 'yuksek' | number) => (typeof v === 'number' ? v : Y[v]);

export function AltSayfa({ acik, kapat, baslik, yukseklik = 'orta', duraklar, guclu, kirli, perdesiz, ust, children }: AltSayfaOz) {
  const [durak, setDurak] = useState(yukseklik);
  const [cek, setCek] = useState(0); // sürükleme ofseti (px, aşağı +)
  const surukle = useRef<{ y0: number; t0: number; son: number; ts: number } | null>(null);
  const kutu = useRef<HTMLDivElement>(null);
  const id = useId();
  const kapatRef = useRef(kapat);
  kapatRef.current = kapat;
  // kirli bir ref'ten okunur: yazı girildikçe etki yeniden kurulmaz (kurulsa odak yazı alanından sayfaya kaçar)
  const kirliRef = useRef(kirli);
  kirliRef.current = kirli;

  useEffect(() => { if (acik) setDurak(yukseklik); }, [acik, yukseklik]);

  // Geçmiş kaydı: geri hareketi önce bu sayfayı kapatır.
  useEffect(() => {
    if (!acik) return;
    acikSayfalar.add(id);
    if (history.state?.altSayfa !== id) history.pushState({ altSayfa: id }, '');
    let bizden = false;
    const geri = () => {
      if (kirliRef.current && !window.confirm('Vazgeçilsin mi?')) { history.pushState({ altSayfa: id }, ''); return; }
      bizden = true;
      kapatRef.current();
    };
    window.addEventListener('popstate', geri);
    const tus = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guclu) history.back(); };
    window.addEventListener('keydown', tus);
    const onceki = document.activeElement as HTMLElement | null;
    kutu.current?.focus();
    return () => {
      window.removeEventListener('popstate', geri);
      window.removeEventListener('keydown', tus);
      acikSayfalar.delete(id);
      // React geliştirme kipinde etki iki kez kurulur: hemen yeniden açılan sayfa için geri gitme
      if (!bizden) setTimeout(() => { if (!acikSayfalar.has(id) && history.state?.altSayfa === id) history.back(); }, 0);
      // odak geri döner ama sayfa kaydırılmaz (menüden bir bölüme inilmiş olabilir)
      onceki?.focus?.({ preventScroll: true });
    };
  }, [acik, id, guclu]);

  const kapanis = useCallback(() => history.back(), []);

  const ekranH = typeof window !== 'undefined' ? window.innerHeight : TASARIM_H;
  const ustY = Math.max(40, ekranH - (TASARIM_H - yOf(durak)));

  const basla = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    surukle.current = { y0: e.clientY, t0: e.timeStamp, son: e.clientY, ts: e.timeStamp };
  };
  const tasi = (e: React.PointerEvent) => {
    const s = surukle.current; if (!s) return;
    s.son = e.clientY; s.ts = e.timeStamp;
    setCek(e.clientY - s.y0);
  };
  const birak = (e: React.PointerEvent) => {
    const s = surukle.current; surukle.current = null; if (!s) return;
    const dy = e.clientY - s.y0, hiz = dy / Math.max(1, e.timeStamp - s.t0); // px/ms
    setCek(0);
    const d = (duraklar || [yukseklik]).map(yOf).sort((a, b) => a - b);
    if (!guclu && (hiz > 0.8 || dy > 120) && yOf(durak) >= d[d.length - 1]) return kapanis();
    if (Math.abs(dy) < 24) return;
    const hedef = yOf(durak) + dy;
    const yakin = d.reduce((m, x) => (Math.abs(x - hedef) < Math.abs(m - hedef) ? x : m), d[0]);
    if (!guclu && hedef > d[d.length - 1] + 80) return kapanis();
    setDurak(yakin);
  };

  if (!acik) return null;
  return createPortal(
    <div className={`alt-sayfa-kok ${guclu ? 'guclu' : ''}`}>
      <div className={`alt-sayfa-perde ${perdesiz ? 'saydam' : ''}`} onClick={guclu ? undefined : kapanis} aria-hidden />
      {ust}
      <div
        ref={kutu}
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
        tabIndex={-1}
        className="alt-sayfa"
        style={{ top: ustY, transform: cek > 0 || cek < 0 ? `translateY(${Math.max(-ustY + 40, cek)}px)` : undefined, transition: surukle.current ? 'none' : undefined }}
      >
        <svg className="alt-sayfa-doku" aria-hidden width="100%" height="100%"><rect width="100%" height="100%" filter="url(#paper)" opacity=".6" /></svg>
        <div className="alt-sayfa-tutamac" onPointerDown={basla} onPointerMove={tasi} onPointerUp={birak} onPointerCancel={birak}>
          <span />
        </div>
        <div className="alt-sayfa-icerik">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Güçlü onayda "Vazgeç" düğmesi için: geri hareketiyle aynı kapanış. */
export const sayfayiKapat = () => history.back();
