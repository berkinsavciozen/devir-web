import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { git } from '../yonlendirme';
import { Gok, useBoyut } from './Gok';
import { Zil } from './Zil';
import { DevirAiDugme, DevirAiPanel, devirAiKapat, useAiAcik } from '../ekranlar/ai/DevirAi';

/**
 * Masaüstü kabuğu (el notu 23 Eki, N13–N14): ≥ 1024 × 600 her sayfa solda harita, sağda o haritanın paneli;
 * oran Evren'deki gibi (panel 440 px). Mobil alt çubuk yok; Evren · Akışlar · Görevler haritanın altında yüzer.
 * Mobil ekranlar (Sahne) panelin içinde olduğu gibi çizilir: gök, zil ve alt çubuk panelde çizilmez.
 */
export const PANEL_EN = 440;
export const masaustu = (w: number, h: number) => w >= 1024 && h >= 600;
export function useMasaustu() { const b = useBoyut(); return masaustu(b.w, b.h); }

const PanelBaglam = createContext(false);

/** Panelin içinde mi (masaüstü kabuğu)? */
export const usePanelIcinde = () => useContext(PanelBaglam);

export type KabukSekme = 'evren' | 'akislar' | 'gorevler' | null;
const SEKMELER: [Exclude<KabukSekme, null>, string, string][] = [['evren', 'Evren', '/'], ['akislar', 'Akışlar', '/akislar'], ['gorevler', 'Görevler', '/gorevler']];

/** Haritanın altında yüzen gezinme (N14): sol bölmenin altı, ortada. */
export function YuzenGezinme({ aktif, solEn }: { aktif: KabukSekme; solEn: number }) {
  return (
    <nav className="segment yuzen-gezinme" aria-label="Ana gezinme" style={{ left: solEn / 2 }}>
      {SEKMELER.map(([s, ad, yol]) => (
        <button key={s} type="button" className={aktif === s ? 'secili' : ''} aria-current={aktif === s ? 'page' : undefined} onClick={() => { if (aktif !== s) git(yol); }}>{ad}</button>
      ))}
    </nav>
  );
}

const AyarlarIkon = () => (
  <svg aria-hidden width="24" height="24" viewBox="-12 -12 24 24"><path d="M-7,-4 L7,-4 M-7,4 L7,4" stroke="var(--renk-vurgu-lila)" strokeWidth="1.5" strokeLinecap="round" /><circle cx="-2.5" cy="-4" r="2.4" fill="var(--renk-zemin-kart)" stroke="var(--renk-vurgu-lila)" strokeWidth="1.5" /><circle cx="3" cy="4" r="2.4" fill="var(--renk-zemin-kart)" stroke="var(--renk-vurgu-lila)" strokeWidth="1.5" /></svg>
);
const ArtiIkon = () => (
  <svg aria-hidden width="52" height="52" viewBox="-26 -26 52 52" style={{ overflow: 'visible' }}><circle r="26" fill="url(#bloom)" opacity=".7" /><circle r="22" fill="url(#btn)" /><path d="M0,-8 L0,8 M-8,0 L8,0" stroke="var(--renk-metin-koyu-uzerine)" strokeWidth="2.6" strokeLinecap="round" /></svg>
);
const GeriIkon = () => <svg aria-hidden width="36" height="36" viewBox="-18 -18 36 36"><circle r="18" fill="var(--renk-zemin-kart)" stroke="#FFFFFF" strokeOpacity=".14" /><path d="M3,-6 L-4,0 L3,6" stroke="var(--renk-metin-ink)" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>;

/**
 * Panel başlığı tek (12 Kas, Tek Pano P4): sayfanın kendi büyük başlığı (ilk h1; Tek Pano'da başlık satırındaki h2)
 * panelde gizlenir, metni üst çubuğa çıkar; altındaki içerik başlığın yeri kadar yukarı kayar.
 */
function usePanelBasligi(etkin: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [metin, setMetin] = useState<string | null>(null);
  // sayfanın başlık yanındaki kendi geri düğmesi: panelde gizlenir, üst çubuğun geri düğmesi onu tıklar
  const [geri, setGeri] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const kok = ref.current;
    if (!kok || !etkin) { setMetin(null); setGeri(null); return; }
    let son: HTMLElement | null = null, sonGeri: HTMLElement | null = null;
    const bak = () => {
      const h = kok.querySelector<HTMLElement>('h1, .tek-pano-ust h2');
      setMetin(h?.textContent?.trim() || null);
      // içerik sonradan dolar (veri gelince): kayma her değişimde, kayma kalkmış hâliyle yeniden ölçülür
      const once = kok.style.getPropertyValue('--baslik-kayma');
      kok.style.removeProperty('--baslik-kayma');
      if (h !== son) {
        if (son) delete son.dataset.panelBasligi;
        if (sonGeri) delete sonGeri.dataset.panelBasligi;
        son = h; sonGeri = null; setGeri(null);
      }
      if (!h) return;
      void kok.offsetHeight;
      h.dataset.panelBasligi = '1';
      const r = h.getBoundingClientRect(), orta = (r.top + r.bottom) / 2;
      if (!sonGeri || !kok.contains(sonGeri)) for (const e of kok.querySelectorAll<HTMLElement>('button')) {
        const q = e.getBoundingClientRect();
        if (q.right <= r.left + 2 && q.top <= orta && q.bottom >= orta) { sonGeri = e; e.dataset.panelBasligi = '1'; setGeri(e); break; }
      }
      // başlığın altındaki ilk öğe panel başlığının hemen altına çıkar; Tek Pano'da Liste/Zaman satırı kalır
      const kokUst = kok.getBoundingClientRect().top - kok.scrollTop;
      let alt = Infinity;
      // başlık satırında sağda düğme varsa (Taslak'ta Plan, Vazgeç) satır kalır, yalnız başlık metni gizlenir
      const sagda = [...kok.querySelectorAll('button')].some((e) => { const q = e.getBoundingClientRect(); return q.height > 0 && q.left >= r.right - 2 && q.top <= orta && q.bottom >= orta; });
      if (sagda) alt = Math.min(r.top, ...[...kok.querySelectorAll('button')].map((e) => e.getBoundingClientRect()).filter((q) => q.height > 0 && q.left >= r.right - 2 && q.top <= orta && q.bottom >= orta).map((q) => q.top));
      else if (h.tagName === 'H1') {
        const satirAlti = Math.max(r.bottom, sonGeri ? sonGeri.getBoundingClientRect().bottom : r.bottom);
        for (const e of kok.querySelectorAll('h2, h3, p, button, [role=tablist], [role=list], textarea, .kart, .sahne-metin')) {
          if (h.contains(e) || e === sonGeri) continue;
          const q = e.getBoundingClientRect();
          if (q.height && q.top >= satirAlti - 2 && q.top < alt) alt = q.top;
        }
      } else alt = (h.closest('.tek-pano-ust') || h).getBoundingClientRect().top;
      const yeni = alt < Infinity ? Math.max(0, Math.round(alt - kokUst - 10)) + 'px' : once;
      if (yeni) kok.style.setProperty('--baslik-kayma', yeni);
    };
    bak();
    const g = new MutationObserver(bak);
    g.observe(kok, { childList: true, subtree: true, characterData: true });
    return () => { g.disconnect(); if (son) delete son.dataset.panelBasligi; if (sonGeri) delete sonGeri.dataset.panelBasligi; };
  }, [etkin]);
  return { ref, metin, geri };
}

/** Panel başlığı (P4): üst çubuğun altında tek satır; alt sayfada önünde küçük yol ("Ayarlar ›"). */
function PanelBaslik({ konum, baslik }: { konum?: string; baslik?: string | null }) {
  const P = (konum || '').split(' › ').filter(Boolean);
  const buyuk = baslik && !P.slice(0, -1).includes(baslik) ? baslik : P[P.length - 1];
  if (!buyuk) return null;
  const yol = P.slice(0, -1);
  return <h1 className="panel-baslik">{yol.length > 0 && <small>{yol.join(' › ')} ›</small>}{buyuk}</h1>;
}

/**
 * Panelin üst çubuğu (N9): solda geri, sağda Devir AI, Pano, Bildirimler, ayarlar ve yeni iş. Sayfa başlığı (P4)
 * çubuğun altında PanelBaslik'ta.
 */
export function PanelUst({ geri, konum, sag = true, kucuk }: { geri?: () => void; konum?: string; sag?: boolean; kucuk?: boolean }) {
  return (
    <div className="panel-ust">
      {geri && <button type="button" className="panel-geri" aria-label={konum ? `Geri: ${konum}` : 'Geri'} onClick={geri}><GeriIkon /></button>}
      {/* akış haritası, görev detayı ve Devir AI'da konum küçük yol olarak kalır; diğer sayfalarda başlık çubuğun altında (P4) */}
      {kucuk && konum ? <span className="panel-konum">{konum}</span> : <span className="panel-bosluk" />}
      {sag && <span className="panel-ust-sag">
        <DevirAiDugme />
        <Zil y={0} kabukta aktif={/^\/(pano|bildirimler)/.test(location.pathname)} stil={{ position: 'relative', right: 'auto', left: 'auto' }} />
        <button type="button" className="genis-geri genis-ayarlar panel-ayarlar" aria-label="Ayarlar" onClick={() => git('/ayarlar')}><AyarlarIkon /></button>
        <button type="button" className="panel-arti" aria-label="Yeni iş" onClick={() => git('/yeni')}><ArtiIkon /></button>
      </span>}
    </div>
  );
}

/**
 * Sağ panel: üst çubuk + kendi içinde kayan içerik. `transform` panelin kendisini sabit konumlu öğelerin
 * (alt sayfa, düğme) kapsayıcısı yapar; böylece mobil alt sayfalar panelin içinde açılır.
 */
export function KabukPanel({ X, H, geri, konum, children }: { X: number; H: number; geri?: () => void; konum?: string; children: ReactNode }) {
  // Devir AI açıksa panelin içeriği sohbettir (plan 28 Eki, Q1); geri sayfaya döner
  const ai = useAiAcik();
  const baslik = usePanelBasligi(!ai && !!konum);
  const bMetin = baslik.metin, bGeri = baslik.geri ? () => baslik.geri!.click() : undefined;
  return (
    <aside className="kabuk-panel" style={{ left: X, width: PANEL_EN, height: H }} aria-label={ai ? 'Devir AI' : konum || 'Panel'}>
      <PanelUst geri={ai ? devirAiKapat : geri || bGeri} konum={ai ? 'Devir AI' : konum} kucuk={ai} />
      {!ai && konum && <PanelBaslik konum={konum} baslik={bMetin} />}
      <div className="kabuk-panel-icerik" ref={baslik.ref}>
        <div className="kabuk-panel-sarma"><PanelBaglam.Provider value>{ai ? <DevirAiPanel /> : children}</PanelBaglam.Provider></div>
      </div>
    </aside>
  );
}

/** Panel zemini (çizim katmanı): Evren paneliyle aynı kâğıt. */
export const panelZeminSvg = (X: number, W: number, H: number) =>
  `<rect x="${X}" y="0" width="${W - X}" height="${H}" fill="url(#sheet)"/><rect x="${X}" y="0" width="${W - X}" height="${H}" filter="url(#paper)" opacity=".5"/><rect x="${X}" y="0" width="1" height="${H}" fill="#FFC9A3" opacity=".35"/>`;

/** Genel kabuk: sol bölmeye verilen harita (HTML/SVG), sağda panel. Evren ve Akış kendi çizimleriyle aynı düzeni kurar. */
export function Kabuk({ sol, aktif, geri, konum, etiket, children }: { sol: ReactNode; aktif: KabukSekme; geri?: () => void; konum?: string; etiket: string; children: ReactNode }) {
  const { w: W, h: H } = useBoyut();
  const X = W - PANEL_EN;
  return (
    <>
      <Gok tohum={121} yildiz={330} parilti={14} genis />
      <main className="sahne-genis kabuk" aria-label={etiket} style={{ width: W, height: H }}>
        <svg className="sahne-genis-cizim" aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`} dangerouslySetInnerHTML={{ __html: panelZeminSvg(X, W, H) }} />
        <div className="kabuk-sol" style={{ width: X, height: H }}>{sol}</div>
        <YuzenGezinme aktif={aktif} solEn={X} />
        <KabukPanel X={X} H={H} geri={geri} konum={konum}>{children}</KabukPanel>
      </main>
    </>
  );
}
