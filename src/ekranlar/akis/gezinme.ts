import { useCallback, useEffect, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from 'react';

/**
 * Harita gezinme (§12, B3 "Pinch"): iki parmak = yakınlaşma, bir parmak = kaydırma, tekerlek, çift dokunma = sığdır.
 * Dönüşüm p' = p·k + t (tasarım koordinatlarında). Bölge her zaman dolu kalır: k = 1'de kaydırma yok.
 * Kayma 6 px'i aşınca altta kalan düğmenin tıklaması yutulur.
 */
export type Bolge = { x: number; y: number; w: number; h: number };
export type Donusum = { k: number; tx: number; ty: number };
const BIR: Donusum = { k: 1, tx: 0, ty: 0 };
const ESIK = 6;

export function useGezinme(b: Bolge, o: { max?: number; asiri?: (p: [number, number]) => void; hareket?: () => void } = {}) {
  const max = o.max ?? 4;
  const [g, setG] = useState<Donusum>(BIR);
  const gr = useRef(g); gr.current = g;
  const ref = useRef<HTMLDivElement>(null);
  const oRef = useRef(o); oRef.current = o;
  const anim = useRef(0);

  const sinirla = useCallback((d: Donusum): Donusum => {
    const k = Math.max(1, Math.min(max, d.k));
    const tx = Math.min(b.x * (1 - k), Math.max((b.x + b.w) * (1 - k), d.tx));
    const ty = Math.min(b.y * (1 - k), Math.max((b.y + b.h) * (1 - k), d.ty));
    return { k, tx, ty };
  }, [b.x, b.y, b.w, b.h, max]);
  // bölge değişince (pencere boyu) dönüşüm sınır içine
  useEffect(() => setG((d) => sinirla(d)), [sinirla]);

  const azalt = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** p noktası yerinde kalarak k2'ye */
  const etrafinda = (d: Donusum, k2: number, p: [number, number]): Donusum => {
    const k = Math.max(1, Math.min(max, k2)), r = k / d.k;
    return sinirla({ k, tx: p[0] - (p[0] - d.tx) * r, ty: p[1] - (p[1] - d.ty) * r });
  };
  const git = useCallback((hedef: Donusum) => {
    cancelAnimationFrame(anim.current);
    const h = sinirla(hedef), a = gr.current;
    if (azalt()) { setG(h); return; }
    const t0 = performance.now(), T = 200;
    const kare = (t: number) => {
      const q = Math.min(1, (t - t0) / T), e = 1 - Math.pow(1 - q, 3);
      // k logaritmik ara değer; t ölçekle tutarlı kalsın diye aynı oranla
      setG({ k: a.k + (h.k - a.k) * e, tx: a.tx + (h.tx - a.tx) * e, ty: a.ty + (h.ty - a.ty) * e });
      if (q < 1) anim.current = requestAnimationFrame(kare);
    };
    anim.current = requestAnimationFrame(kare);
  }, [sinirla]);
  const merkez = (): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
  const yakinlas = (f: number) => git(etrafinda(gr.current, gr.current.k * f, merkez()));
  const sigdir = () => git(BIR);

  // istemci → tasarım koordinatı
  const yerel = (cx: number, cy: number): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [b.x + (cx - r.left) * (b.w / (r.width || b.w)), b.y + (cy - r.top) * (b.h / (r.height || b.h))];
  };

  const ip = useRef(new Map<number, [number, number]>());
  const jest = useRef<{ tur: 'yok' | 'kaydir' | 'kistir'; p0: [number, number]; d0: Donusum; m0: [number, number]; mesafe0: number; kaydi: boolean; asti: number }>({ tur: 'yok', p0: [0, 0], d0: BIR, m0: [0, 0], mesafe0: 1, kaydi: false, asti: 1 });
  const sonDokunma = useRef<{ t: number; p: [number, number] }>({ t: 0, p: [0, 0] });

  const kistirBasla = () => {
    const [a, c] = [...ip.current.values()];
    jest.current = { ...jest.current, tur: 'kistir', d0: gr.current, m0: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], mesafe0: Math.max(10, Math.hypot(a[0] - c[0], a[1] - c[1])), kaydi: true, asti: 1 };
  };
  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(anim.current);
    const p = yerel(e.clientX, e.clientY);
    ip.current.set(e.pointerId, p);
    if (ip.current.size === 2) { kistirBasla(); oRef.current.hareket?.(); }
    else if (ip.current.size === 1) jest.current = { ...jest.current, tur: 'kaydir', p0: p, d0: gr.current, kaydi: false };
  };
  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (!ip.current.has(e.pointerId)) return;
    const p = yerel(e.clientX, e.clientY); ip.current.set(e.pointerId, p);
    const J = jest.current;
    if (J.tur === 'kistir' && ip.current.size >= 2) {
      const [a, c] = [...ip.current.values()], m: [number, number] = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      const oran = Math.hypot(a[0] - c[0], a[1] - c[1]) / J.mesafe0, k = J.d0.k * oran;
      J.asti = k / max;
      const r = Math.max(1, Math.min(max, k)) / J.d0.k;
      setG(sinirla({ k: J.d0.k * r, tx: m[0] - (J.m0[0] - J.d0.tx) * r, ty: m[1] - (J.m0[1] - J.d0.ty) * r }));
    } else if (J.tur === 'kaydir') {
      const dx = p[0] - J.p0[0], dy = p[1] - J.p0[1];
      if (!J.kaydi && Math.hypot(dx, dy) > ESIK) {
        J.kaydi = true; oRef.current.hareket?.();
        try { ref.current?.setPointerCapture(e.pointerId); } catch { /* yok */ }
      }
      if (J.kaydi) setG(sinirla({ k: J.d0.k, tx: J.d0.tx + dx, ty: J.d0.ty + dy }));
    }
  };
  const bitir = (e: RPointerEvent<HTMLDivElement>) => {
    const J = jest.current, p = ip.current.get(e.pointerId);
    ip.current.delete(e.pointerId);
    if (J.tur === 'kistir') {
      if (J.asti > 1.15 && oRef.current.asiri) oRef.current.asiri(J.m0);
      if (ip.current.size === 1) { const [q] = [...ip.current.values()]; jest.current = { ...J, tur: 'kaydir', p0: q, d0: gr.current, kaydi: true }; }
      else if (!ip.current.size) J.tur = 'yok';
      return;
    }
    if (!ip.current.size) {
      // çift dokunma (boşlukta): sığdır ya da 2×
      if (!J.kaydi && p && e.type === 'pointerup') {
        const now = performance.now(), s = sonDokunma.current;
        if (now - s.t < 320 && Math.hypot(p[0] - s.p[0], p[1] - s.p[1]) < 30 && e.target === ref.current) {
          sonDokunma.current = { t: 0, p };
          git(gr.current.k > 1.05 ? BIR : etrafinda(gr.current, 2, p));
        } else sonDokunma.current = { t: now, p };
      }
      J.tur = 'yok';
    }
  };
  // kaydırınca altta kalan düğmenin tıklaması yutulur
  const onClickCapture = (e: RMouseEvent) => { if (jest.current.kaydi) { e.stopPropagation(); e.preventDefault(); jest.current.kaydi = false; } };

  // tekerlek: pasif olmayan dinleyici (sayfa kaymasın); k = 1'de uzaklaşma sayfaya kalır
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const tek = (e: WheelEvent) => {
      const d = gr.current, f = Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0025));
      if ((f < 1 && d.k <= 1) || (f > 1 && d.k >= max)) { if (f > 1 && d.k >= max && oRef.current.asiri) { e.preventDefault(); oRef.current.asiri(yerel(e.clientX, e.clientY)); } return; }
      e.preventDefault(); cancelAnimationFrame(anim.current);
      // ardışık olaylar çizimden önce gelebilir: son değer hemen yazılır
      const n = etrafinda(d, d.k * f, yerel(e.clientX, e.clientY)); gr.current = n; setG(n);
    };
    el.addEventListener('wheel', tek, { passive: false });
    return () => el.removeEventListener('wheel', tek);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  const yaklasik = g.k > 1.001;
  return {
    g, yaklasik, ref, yakinlas, sigdir, git,
    /** tasarım noktası → ekran */
    p: (x: number, y: number): [number, number] => [x * g.k + g.tx, y * g.k + g.ty],
    /** p ekranda bölgenin içinde mi (pay px dışarı taşabilir) */
    icinde: (x: number, y: number, pay = 0) => x >= b.x - pay && x <= b.x + b.w + pay && y >= b.y - pay && y <= b.y + b.h + pay,
    olaylar: { onPointerDown, onPointerMove, onPointerUp: bitir, onPointerCancel: bitir, onClickCapture },
  };
}
