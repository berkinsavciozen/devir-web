import { useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import { hareketAz } from '../../ayar/hareket';
import { durumAn, kur, yorungeHaritasi, type YorungeOrnegi } from '../../cizim/yorunge/index.js';

/**
 * Kişi Yörüngeleri haritası (13 Kas, sentez; `?harita=yorunge`): her kişi kendi yörüngesinde, bugün tepedeki iğnede, gelecek
 * saat yönünde. Çizim motoru DOM'u bir kez kurar; zaman (an) değişince yalnız öznitelikler değişir. Bir parmak kaydırır,
 * iki parmak ve tekerlek yakınlaştırır; işe dokununca `adim`, araca dokununca `kisi` çağrılır.
 */
export interface YorungeTutamak { yakinlas: (kat: number) => void; sigdir: () => void }
interface Oz {
  d: any; bakan: string; simdi: number; an: number; cihaz: 'tel' | 'mas';
  x: number; y: number; w: number; h: number; ust?: number;
  secili?: number | null; kisi?: string | null; vurgu?: string | null;
  adim: (no: number) => void; kisiSec: (ad: string) => void; bos?: () => void; etiket: string;
}

/** API akış detayı → harita modelinin girdisi. */
const hamVeri = (d: any, simdi: number) => ({ simdi: new Date(simdi).toISOString(), akis: { ...d.akis, bitis: d.bitis || d.akis?.bitis, kritik_yol: d.kritik_yol || d.akis?.kritik_yol || [], adimlar: d.adimlar || [], sahipler: d.sahipler || [], katilimcilar: d.katilimcilar || [], olaylar: d.olaylar || [] } });

export const YorungeHarita = forwardRef<YorungeTutamak, Oz>(function YorungeHarita({ d, bakan, simdi, an, cihaz, x, y, w, h, ust = 10, secili = null, kisi = null, vurgu = null, adim, kisiSec, bos, etiket }, ref) {
  const svg = useRef<SVGSVGElement>(null);
  const hr = useRef<YorungeOrnegi | null>(null);
  const M = useMemo(() => kur(hamVeri(d, simdi), bakan), [d, simdi, bakan]);
  const geri = useRef({ adim, kisiSec, bos }); geri.current = { adim, kisiSec, bos };
  const durum = useRef({ an, secili, kisi, vurgu }); durum.current = { an, secili, kisi, vurgu };

  // kurulum: akış, bakan ya da düzen değişince
  useEffect(() => {
    const e = svg.current; if (!e) return;
    const H = yorungeHaritasi(); hr.current = H;
    H.kur(M, { svg: e, cihaz, ust });
    const s = durum.current;
    H.sec(s.secili, s.kisi); H.guncelle(s.an, durumAn(M, s.an)); H.vurgu(s.vurgu);
    return () => { hr.current = null; e.innerHTML = ''; };
  }, [M, cihaz, ust]);
  useEffect(() => { hr.current?.sigdir(); const s = durum.current; hr.current?.guncelle(s.an, durumAn(M, s.an)); }, [w, h]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const H = hr.current; if (!H) return; H.sec(secili, kisi); H.guncelle(an, durumAn(M, an)); }, [an, secili, kisi, M]);
  useEffect(() => { hr.current?.vurgu(vurgu); }, [vurgu, M]);

  // ekran → svg yerel koordinatı (sahne ölçeklenmiş olabilir)
  const yerel = (cx: number, cy: number): [number, number] => {
    const e = svg.current!, r = e.getBoundingClientRect();
    return [(cx - r.left) * ((e.clientWidth || r.width) / (r.width || 1)), (cy - r.top) * ((e.clientHeight || r.height) / (r.height || 1))];
  };
  const oran = () => { const e = svg.current!, r = e.getBoundingClientRect(); return (e.clientWidth || r.width) / (r.width || 1); };
  const anim = useRef(0);
  const zoomGit = (k2: number) => {
    const H = hr.current, e = svg.current; if (!H || !e) return;
    const k0 = H.H.k, px = e.clientWidth / 2, py = e.clientHeight / 2; cancelAnimationFrame(anim.current);
    if (hareketAz()) { H.zoomAt(k2, px, py); return; }
    const t0 = performance.now();
    const kare = (t: number) => { const u = Math.min(1, (t - t0) / 260); H.zoomAt(k0 * Math.pow(k2 / k0, u), px, py); if (u < 1) anim.current = requestAnimationFrame(kare); };
    anim.current = requestAnimationFrame(kare);
  };
  useImperativeHandle(ref, () => ({
    yakinlas: (kat) => { const H = hr.current; if (H) zoomGit(H.H.k * kat); },
    // sığdır: bütün tarihler; zaten oradaysa açılış görünümü
    sigdir: () => {
      const H = hr.current; if (!H) return; cancelAnimationFrame(anim.current);
      const T = H.hedefTam(), S = H.H, tamda = Math.abs(S.k - T.k) < .02 && Math.abs(S.tx - T.tx) < 4;
      const Z = tamda || !S.tam ? { k: 1, tx: 0, ty: 0 } : T;
      S.k = Z.k; S.tx = Z.tx; S.ty = Z.ty; H.kamera();
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // tekerlek: edilgen olmayan dinleyici (sayfa kaymasın)
  useEffect(() => {
    const e = svg.current; if (!e) return;
    const t = (ev: WheelEvent) => { const H = hr.current; if (!H) return; ev.preventDefault(); const [px, py] = yerel(ev.clientX, ev.clientY); H.zoomAt(H.H.k * Math.exp(-ev.deltaY * .0016), px, py); };
    e.addEventListener('wheel', t, { passive: false });
    return () => e.removeEventListener('wheel', t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ptr = useRef(new Map<number, [number, number]>());
  const jest = useRef<{ surukle: [number, number] | null; kistir: { d: number; k: number } | null; tasindi: boolean }>({ surukle: null, kistir: null, tasindi: false });
  const tikla = (cx: number, cy: number) => {
    const g = document.elementFromPoint(cx, cy) as Element | null;
    const gz = g?.closest('.gz, .pay') as SVGElement | null, ar = g?.closest('.arac-g') as SVGElement | null;
    if (gz?.dataset.no) geri.current.adim(+gz.dataset.no);
    else if (ar?.dataset.kisi) geri.current.kisiSec(ar.dataset.kisi);
    else geri.current.bos?.();
  };
  const tus = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target as SVGElement, gz = t.closest?.('.gz') as SVGElement | null, ar = t.closest?.('.arac-g') as SVGElement | null;
    if (gz?.dataset.no) { e.preventDefault(); adim(+gz.dataset.no); } else if (ar?.dataset.kisi) { e.preventDefault(); kisiSec(ar.dataset.kisi); }
  };

  return (
    <div className="ky-kap" style={{ left: x, top: y, width: w, height: h }}>
      <svg ref={svg} className="ky-svg kd0" role="group" aria-label={etiket} onKeyDown={tus}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId); ptr.current.set(e.pointerId, [e.clientX, e.clientY]); jest.current.tasindi = false; cancelAnimationFrame(anim.current);
          if (ptr.current.size === 2) { const [a, b] = [...ptr.current.values()]; jest.current.kistir = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: hr.current?.H.k ?? 1 }; } else jest.current.surukle = [e.clientX, e.clientY];
        }}
        onPointerMove={(e) => {
          const H = hr.current, J = jest.current; if (!H || !ptr.current.has(e.pointerId)) return; ptr.current.set(e.pointerId, [e.clientX, e.clientY]);
          if (ptr.current.size === 2 && J.kistir) { const [a, b] = [...ptr.current.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); const [px, py] = yerel((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); H.zoomAt(J.kistir.k * dd / J.kistir.d, px, py); J.tasindi = true; }
          else if (J.surukle) { const dx = e.clientX - J.surukle[0], dy = e.clientY - J.surukle[1]; if (Math.abs(dx) + Math.abs(dy) > 3) J.tasindi = true; if (J.tasindi) { const o = oran(); H.kaydir(dx * o, dy * o); J.surukle = [e.clientX, e.clientY]; } }
        }}
        onPointerUp={(e) => { const J = jest.current, t = J.tasindi; ptr.current.delete(e.pointerId); if (ptr.current.size < 2) J.kistir = null; if (!ptr.current.size) { J.surukle = null; if (!t) tikla(e.clientX, e.clientY); } }}
        onPointerCancel={(e) => { ptr.current.delete(e.pointerId); jest.current.kistir = null; if (!ptr.current.size) jest.current.surukle = null; }} />
    </div>
  );
});
