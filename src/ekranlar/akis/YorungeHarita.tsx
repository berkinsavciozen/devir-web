import { useState, useEffect, useImperativeHandle, useMemo, useRef, forwardRef } from 'react';
import { hareketAz } from '../../ayar/hareket';
import { adimAdi } from '../../metin/turkce';
import { anYaz, arac, durumAn, durumRenk, kur, KISI_DURUM_AD, yorungeHaritasi, type YorungeOrnegi } from '../../cizim/yorunge/index.js';

/**
 * Kişi Yörüngeleri haritası (13 Kas, sentez; `?harita=yorunge`): her kişi kendi yörüngesinde, bugün tepedeki iğnede, gelecek
 * saat yönünde. Çizim motoru DOM'u bir kez kurar; zaman (an) değişince yalnız öznitelikler değişir. Bir parmak kaydırır,
 * iki parmak ve tekerlek yakınlaştırır; işe dokununca `adim`, araca dokununca `kisi` çağrılır.
 * Zaman (U3): üstteki gösterge sağa çekilince ileri, sola çekilince geri gider (telefonda 1 px = 15 dk, geniş düzende 10 dk);
 * dokunuş bugüne döner; odaktayken ← → 3 saat, Shift ile 1 gün, Home bugün. Altta kişi şeridi: herkes şu anki durumuyla,
 * dokununca yalnız o kişi, agent'ı ve işleri öne çıkar.
 */
const SA = 36e5, GUN = 864e5, CEYREK = 15 * 60e3;
export interface YorungeTutamak { yakinlas: (kat: number) => void; sigdir: () => void; /** işin harita kutusu içindeki dikey yeri (px), yoksa null */ adimY: (no: number) => number | null }
interface Oz {
  d: any; bakan: string; simdi: number; an: number; cihaz: 'tel' | 'mas';
  x: number; y: number; w: number; h: number; ust?: number;
  secili?: number | null; kisi?: string | null; vurgu?: string | null;
  adim: (no: number) => void; kisiSec: (ad: string) => void; bos?: () => void; etiket: string;
  /** zaman göstergesi çekilince / tuşla */
  anDegis?: (t: number) => void;
  /** alt kişi şeridi: yeri, seçim ve oynat düğmesi */
  serit?: { x: number; y: number; w: number; sec: (ad: string | null) => void; oynuyor: boolean; oynat: () => void };
}

/** API akış detayı → harita modelinin girdisi. */
export const hamVeri = (d: any, simdi: number) => ({ simdi: new Date(simdi).toISOString(), akis: { ...d.akis, bitis: d.bitis || d.akis?.bitis, kritik_yol: d.kritik_yol || d.akis?.kritik_yol || [], adimlar: d.adimlar || [], sahipler: d.sahipler || [], katilimcilar: d.katilimcilar || [], olaylar: d.olaylar || [] } });

export const YorungeHarita = forwardRef<YorungeTutamak, Oz>(function YorungeHarita({ d, bakan, simdi, an, cihaz, x, y, w, h, ust = 10, secili = null, kisi = null, vurgu = null, adim, kisiSec, bos, etiket, anDegis, serit }, ref) {
  const svg = useRef<SVGSVGElement>(null);
  const hr = useRef<YorungeOrnegi | null>(null);
  const [zk, setZk] = useState(1);
  const zr = useRef<HTMLDivElement>(null);
  const M = useMemo(() => kur(hamVeri(d, simdi), bakan), [d, simdi, bakan]);
  const geri = useRef({ adim, kisiSec, bos, anDegis }); geri.current = { adim, kisiSec, bos, anDegis };
  const D = useMemo(() => durumAn(M, an), [M, an]);
  const sinirla = (t: number) => Math.max(M.aralik[0], Math.min(M.aralik[1], t));
  const durum = useRef({ an, secili, kisi, vurgu }); durum.current = { an, secili, kisi, vurgu };

  // kurulum: akış, bakan ya da düzen değişince
  useEffect(() => {
    const e = svg.current; if (!e) return;
    const H = yorungeHaritasi(); hr.current = H;
    H.kur(M, { svg: e, cihaz, ust, zoomDegis: (z: number) => setZk(z) }); setZk(1);
    const s = durum.current;
    H.sec(s.secili, s.kisi); H.guncelle(s.an, durumAn(M, s.an)); H.vurgu(s.vurgu);
    // zaman göstergesi klavyeyle de kullanılır
    const tut = e.querySelector('.igne-tut');
    if (tut && geri.current.anDegis) { tut.setAttribute('tabindex', '0'); tut.setAttribute('role', 'slider'); tut.setAttribute('aria-label', 'Zaman: sağa sola çek, dokununca bugün'); tut.setAttribute('aria-valuemin', String(M.aralik[0])); tut.setAttribute('aria-valuemax', String(M.aralik[1])); }
    return () => { hr.current = null; e.innerHTML = ''; };
  }, [M, cihaz, ust]);
  useEffect(() => { hr.current?.sigdir(); const s = durum.current; hr.current?.guncelle(s.an, durumAn(M, s.an)); }, [w, h]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const H = hr.current; if (!H) return; H.sec(secili, kisi); H.guncelle(an, D);
    const tut = svg.current?.querySelector('.igne-tut');
    if (tut) { tut.setAttribute('aria-valuenow', String(Math.round(an))); tut.setAttribute('aria-valuetext', `${Math.abs(an - simdi) < SA ? 'Bugün, ' : an > simdi ? 'Tahmin, ' : 'Geçmiş, '}${anYaz(an)}`); }
  }, [an, secili, kisi, M, D, simdi]);
  useEffect(() => { hr.current?.vurgu(vurgu); }, [vurgu, M]);
  // seçilen iş alttaki kutunun arkasında kalmasın
  // dokunma: sayfa kaymasın. iOS, çizim öğesindeki touch-action'ı saymaz; kilit sarmalayıcı kutuda (stil) ve burada.
  useEffect(() => {
    const k = svg.current?.parentElement; if (!k) return;
    const dur = (ev: TouchEvent) => { if (ev.cancelable) ev.preventDefault(); };
    k.addEventListener('touchmove', dur, { passive: false });
    return () => k.removeEventListener('touchmove', dur);
  }, []);
  // araca dokununca açılan kişi kutusu: yalnız o kişi seçiliyken durur
  const [kisiKutu, setKisiKutu] = useState<{ ad: string; ust: boolean } | null>(null);
  useEffect(() => { setKisiKutu((q) => (q && q.ad === kisi ? q : null)); }, [kisi]);
  useEffect(() => { if (secili != null) setKisiKutu(null); }, [secili]);

  // ekran → svg yerel koordinatı (sahne ölçeklenmiş olabilir)
  const yerel = (cx: number, cy: number): [number, number] => {
    const e = svg.current!, r = e.getBoundingClientRect();
    return [(cx - r.left) * ((e.clientWidth || r.width) / (r.width || 1)), (cy - r.top) * ((e.clientHeight || r.height) / (r.height || 1))];
  };
  const oran = () => { const e = svg.current!, r = e.getBoundingClientRect(); return (e.clientWidth || r.width) / (r.width || 1); };
  const anim = useRef(0);
  const zoomGit = (k2: number) => {
    const H = hr.current, e = svg.current; if (!H || !e) return;
    const k0 = H.zoom, px = e.clientWidth / 2, py = e.clientHeight / 2; cancelAnimationFrame(anim.current);
    if (hareketAz()) { H.zoomAt(k2, px, py); return; }
    const t0 = performance.now();
    const kare = (t: number) => { const u = Math.min(1, (t - t0) / 260); H.zoomAt(k0 * Math.pow(k2 / k0, u), px, py); if (u < 1) anim.current = requestAnimationFrame(kare); };
    anim.current = requestAnimationFrame(kare);
  };
  useImperativeHandle(ref, () => ({
    yakinlas: (kat) => { const H = hr.current; if (H) zoomGit(H.zoom * kat); },
    // sığdır: yakınlaşma varsa önce açılış ölçeği; telefonda sonra bütün tarihler (uzak görünüm) ile açılış arasında gider
    sigdir: () => {
      const H = hr.current; if (!H) return; cancelAnimationFrame(anim.current);
      const S = H.H; S.k = 1; S.tx = 0; S.ty = 0; H.zoomAt(1, 0, 0);
    },
    adimY: (no) => {
      const e = svg.current, g = e?.querySelector(`.gz[data-no="${no}"]`); if (!e || !g) return null;
      const r = g.getBoundingClientRect(), R = e.getBoundingClientRect();
      return (r.top + r.height / 2 - R.top) * ((e.clientHeight || R.height) / (R.height || 1));
    },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // tekerlek: edilgen olmayan dinleyici (sayfa kaymasın)
  useEffect(() => {
    const e = svg.current; if (!e) return;
    const t = (ev: WheelEvent) => { const H = hr.current; if (!H) return; ev.preventDefault(); const [px, py] = yerel(ev.clientX, ev.clientY); H.zoomAt(H.zoom * Math.exp(-ev.deltaY * .0016), px, py); };
    e.addEventListener('wheel', t, { passive: false });
    return () => e.removeEventListener('wheel', t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ptr = useRef(new Map<number, [number, number]>());
  const jest = useRef<{ surukle: [number, number] | null; kistir: { d: number; k: number } | null; tasindi: boolean }>({ surukle: null, kistir: null, tasindi: false });
  const tikla = (cx: number, cy: number) => {
    const g = document.elementFromPoint(cx, cy) as Element | null;
    const gz = g?.closest('.gz, .pay') as SVGElement | null, ar = g?.closest('.arac-g') as SVGElement | null;
    if (gz?.dataset.no) geri.current.adim(+gz.dataset.no);
    else if (ar?.dataset.kisi) {
      const e = svg.current!, r = ar.getBoundingClientRect(), R = e.getBoundingClientRect(), ad = ar.dataset.kisi;
      setKisiKutu(durum.current.kisi === ad ? null : { ad, ust: r.bottom - R.top > R.height - 236 * (R.height / (e.clientHeight || R.height)) });
      geri.current.bos?.(); geri.current.kisiSec(ad);
    }
    else geri.current.bos?.();
  };
  // zaman göstergesi: çekme durumu
  const zs = useRef<{ x: number; an: number; id: number; oynadi: boolean } | null>(null);
  const tus = (e: React.KeyboardEvent) => {
    const t = e.target as SVGElement;
    if (t.closest?.('.igne-tut') && geri.current.anDegis) {
      if (e.key === 'Home' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); geri.current.anDegis(simdi); return; }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); geri.current.anDegis(sinirla(durum.current.an + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? GUN : 3 * SA))); }
      return;
    }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const gz = t.closest?.('.gz') as SVGElement | null, ar = t.closest?.('.arac-g') as SVGElement | null;
    if (gz?.dataset.no) { e.preventDefault(); adim(+gz.dataset.no); } else if (ar?.dataset.kisi) { e.preventDefault(); kisiSec(ar.dataset.kisi); }
  };

  // kişi şeridi: bakan başta; dış bakan yalnız kendini görür
  // yüzen yakınlaştırma sürgüsü: sağa çek yakınlaş, sola çek uzaklaş (logaritmik; çift tık / Home açılış ölçeği)
  const ZMIN = Math.log(.4), ZMAX = Math.log(6);
  const zYer = (Math.log(zk) - ZMIN) / (ZMAX - ZMIN);
  const zCek = (cx: number) => { const r = zr.current?.getBoundingClientRect(), H = hr.current; if (!r || !H) return; cancelAnimationFrame(anim.current); const u = Math.max(0, Math.min(1, (r.bottom - cx) / (r.height || 1))); const z = Math.exp(ZMIN + (ZMAX - ZMIN) * u); H.zoomAt(Math.abs(z - 1) < .06 ? 1 : z, 0, 0); };
  const zTus = (e: React.KeyboardEvent) => {
    const H = hr.current; if (!H) return;
    const kat = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1.15 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? 1 / 1.15 : 0;
    if (kat) { e.preventDefault(); e.stopPropagation(); H.zoomAt(H.zoom * kat, 0, 0); } else if (e.key === 'Home' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); H.zoomAt(1, 0, 0); }
  };
  const kutuKisi = kisiKutu && kisiKutu.ad === kisi ? M.kisi[kisiKutu.ad] : null;
  const kisiler = useMemo(() => { const dis = M.bakanTip === 'dis'; return (M.kisiler as any[]).filter((k) => !(dis && k.ad !== bakan)).sort((a, b) => (a.ad === bakan ? -1 : b.ad === bakan ? 1 : 0)); }, [M, bakan]);
  const kisa = (s: string) => String(s || '').replace(/\s*\(.*\)$/, '');
  const kisiAd = (k: any) => (k.tip === 'agent' ? (k.sahibi ? `${k.sahibi === bakan ? 'Senin' : kisa(k.sahibi) + '’in'} agent’ı` : kisa(k.ad)) : k.ad === bakan ? 'Sen' : kisa(k.ad));

  return (
    <>
    {/* telefonda sahne ekran eninde: sağ kenar da sabitlenir (360 px'te taşmasın) */}
    <div className="ky-kap" style={cihaz === 'tel' ? { left: x, right: x, top: y, height: h } : { left: x, top: y, width: w, height: h }}>
      <svg ref={svg} className="ky-svg kd0" role="group" aria-label={etiket} onKeyDown={tus}
        onPointerDown={(e) => {
          if (geri.current.anDegis && (e.target as Element).closest?.('.igne-tut')) {
            e.currentTarget.setPointerCapture(e.pointerId); cancelAnimationFrame(anim.current);
            zs.current = { x: e.clientX, an: durum.current.an, id: e.pointerId, oynadi: false }; hr.current?.H.ig?.classList.add('cekiliyor'); return;
          }
          e.currentTarget.setPointerCapture(e.pointerId); ptr.current.set(e.pointerId, [e.clientX, e.clientY]); jest.current.tasindi = false; cancelAnimationFrame(anim.current);
          if (ptr.current.size === 2) { const [a, b] = [...ptr.current.values()]; jest.current.kistir = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: hr.current?.zoom ?? 1 }; } else jest.current.surukle = [e.clientX, e.clientY];
        }}
        onPointerMove={(e) => {
          const z = zs.current;
          if (z) { if (e.pointerId !== z.id) return; const dx = (e.clientX - z.x) * oran(); if (Math.abs(dx) > 3) z.oynadi = true; if (z.oynadi) geri.current.anDegis?.(sinirla(z.an + dx * (cihaz === 'tel' ? 15 : 10) * 60e3)); return; }
          const H = hr.current, J = jest.current; if (!H || !ptr.current.has(e.pointerId)) return; ptr.current.set(e.pointerId, [e.clientX, e.clientY]);
          if (ptr.current.size === 2 && J.kistir) { const [a, b] = [...ptr.current.values()], dd = Math.hypot(a[0] - b[0], a[1] - b[1]); const [px, py] = yerel((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); H.zoomAt(J.kistir.k * dd / J.kistir.d, px, py); J.tasindi = true; }
          else if (J.surukle) { const dx = e.clientX - J.surukle[0], dy = e.clientY - J.surukle[1]; if (Math.abs(dx) + Math.abs(dy) > 3) J.tasindi = true; if (J.tasindi) { const o = oran(); H.kaydir(dx * o, dy * o); J.surukle = [e.clientX, e.clientY]; } }
        }}
        onPointerUp={(e) => {
          const z = zs.current;
          if (z) { if (e.pointerId !== z.id) return; zs.current = null; hr.current?.H.ig?.classList.remove('cekiliyor'); geri.current.anDegis?.(z.oynadi ? sinirla(Math.round(durum.current.an / CEYREK) * CEYREK) : simdi); return; }
          const J = jest.current, t = J.tasindi; ptr.current.delete(e.pointerId); if (ptr.current.size < 2) J.kistir = null; if (!ptr.current.size) { J.surukle = null; if (!t) tikla(e.clientX, e.clientY); } }}
        onPointerCancel={(e) => { if (zs.current?.id === e.pointerId) { zs.current = null; hr.current?.H.ig?.classList.remove('cekiliyor'); return; } ptr.current.delete(e.pointerId); jest.current.kistir = null; if (!ptr.current.size) jest.current.surukle = null; }} />
    </div>
    <div className="ky-zoom" style={cihaz === 'tel' ? { right: x + 6, top: y + h / 2 - 66 } : { left: x + w - 50, top: y + h / 2 - 74 }}>
      <svg aria-hidden viewBox="-6 -6 12 12"><path d="M-4,0 H4 M0,-4 V4" /></svg>
      <div ref={zr} className="ky-zoom-ray" role="slider" tabIndex={0} aria-orientation="vertical" aria-label="Yakınlaştırma: yukarı aşağı çek" aria-valuemin={40} aria-valuemax={600} aria-valuenow={Math.round(zk * 100)} aria-valuetext={`yüzde ${Math.round(zk * 100)}`}
        onKeyDown={zTus} onDoubleClick={() => hr.current?.zoomAt(1, 0, 0)}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) zCek(e.clientY); }}>
        <i className="ky-zoom-bir" style={{ bottom: `${((0 - ZMIN) / (ZMAX - ZMIN)) * 100}%` }} />
        <i className="ky-zoom-top" style={{ bottom: `${zYer * 100}%` }} />
      </div>
      <svg aria-hidden viewBox="-6 -6 12 12"><path d="M-4,0 H4" /></svg>
    </div>
    {kutuKisi && (() => {
      const k = kutuKisi, kd = D.K[k.ad] || { durum: 'bekliyor' }, is = kd.no != null ? M.byNo[kd.no] : null, tutan = kd.tutan != null ? M.byNo[kd.tutan] : null;
      const isAc = (no: number) => { setKisiKutu(null); geri.current.adim(no); };
      const yer: React.CSSProperties = cihaz === 'tel'
        ? (kisiKutu!.ust ? { left: x + 8, right: x + 8, top: y + 50 } : { left: x + 8, right: x + 8, top: y + h - 8, transform: 'translateY(-100%)' })
        : { left: x + 12, width: 330, top: y + h - 10, transform: 'translateY(-100%)' };
      return (
        <section className="harita-kutu ky-kisi-kutu" role="dialog" aria-label={`${kisiAd(k)}: durum ve hamleler`} style={yer}>
          <div className="harita-kutu-ust">
            <svg className="ky-svg" viewBox="-22 -15 44 30" width="52" height="36" aria-hidden dangerouslySetInnerHTML={{ __html: arac(k, { ...kd, hamleler: [] }, {}).svg }} />
            <div className="harita-kutu-ad">
              <b>{kisiAd(k)}</b>
              <small><i className="ky-kk-nokta" style={{ background: durumRenk(kd.durum) }} />{KISI_DURUM_AD[kd.durum] || kd.durum}{kd.gecGun ? ` · ${kd.gecGun} gün gecikti` : ''}{(kd.acik || []).length > 1 ? ` · ${(kd.acik || []).length} açık iş` : ''}</small>
            </div>
            <button type="button" className="harita-kutu-kapat" aria-label="Kutuyu kapat" onClick={() => setKisiKutu(null)}><svg aria-hidden viewBox="-8 -8 16 16"><path d="M-4,-4 L4,4 M4,-4 L-4,4" /></svg></button>
          </div>
          {is && <button type="button" className="ky-kk-satir" onClick={() => isAc(is.no)}><small>{kd.durum === 'bitti' ? 'Son işi' : ['bekliyor', 'gelecek'].includes(kd.durum) ? 'Sıradaki işi' : 'Şimdiki işi'}</small><span>{is.no}. {adimAdi(is)}</span></button>}
          {tutan && <button type="button" className="ky-kk-satir" onClick={() => isAc(tutan.no)}><small>Beklediği iş</small><span>{tutan.no}. {adimAdi(tutan)} · {tutan.sahip === bakan ? 'sende' : kisiAd(M.kisi[tutan.sahip] || { ad: tutan.sahip })}</span></button>}
          {(kd.hamleler || []).length > 0 && <div className="ky-kk-hamle" role="group" aria-label="Bekleyen hamleler">
            {(kd.hamleler as any[]).slice(0, 4).map((hm) => <button key={hm.tur + hm.no} type="button" className="ky-kk-h" onClick={() => isAc(hm.no)}><b>{hm.etiket}</b><span>{hm.no}. {adimAdi(M.byNo[hm.no])}</span></button>)}
          </div>}
          {(kd.rutinsiz || []).length > 0 && <small className="ky-kk-not">{(kd.rutinsiz || []).length} işte AI yapsın kurulmamış</small>}
        </section>
      );
    })()}
    {serit && <div className="ky-serit" style={cihaz === 'tel' ? { left: serit.x, right: serit.x, top: serit.y } : { left: serit.x, top: serit.y, width: serit.w }}>
      <button type="button" className="ky-oynat" aria-label={serit.oynuyor ? 'Durdur' : 'Oynat'} onClick={serit.oynat}>
        <svg aria-hidden viewBox="-10 -10 20 20" width="18" height="18">{serit.oynuyor ? <path d="M-5,-6 V6 M5,-6 V6" /> : <path className="dolu" d="M-4,-7 L7,0 L-4,7 Z" />}</svg>
      </button>
      <div className="ky-kisiler" role="group" aria-label="Kişiler: dokun, yalnız onu gör">
        <button type="button" className={`kc hepsi${kisi ? '' : ' secili'}`} aria-pressed={!kisi} onClick={() => serit.sec(null)}><span className="kc-r">Herkes</span><small>{kisiler.length} kişi</small></button>
        {kisiler.map((k) => {
          const kd = D.K[k.ad] || { durum: 'bekliyor' }, n = (kd.hamleler || []).length, ad = kisiAd(k);
          return (
            <button key={k.ad} type="button" className={`kc${kisi === k.ad ? ' secili' : ''}${k.tip === 'agent' ? ' ag' : ''}`} aria-pressed={kisi === k.ad} style={{ ['--kr' as string]: k.renk }}
              aria-label={`${ad}: ${KISI_DURUM_AD[kd.durum] || kd.durum}${n ? `, ${n} hamle` : ''}`} onClick={() => serit.sec(kisi === k.ad ? null : k.ad)}>
              <svg className="ky-svg" viewBox="-22 -15 44 30" width="44" height="30" aria-hidden dangerouslySetInnerHTML={{ __html: arac(k, { ...kd, hamleler: [] }, {}).svg }} />
              {n > 0 && <b className="kc-n" style={{ background: durumRenk(kd.durum) }}>{n}</b>}
              <small>{ad}</small>
            </button>
          );
        })}
      </div>
    </div>}
    </>
  );
});
