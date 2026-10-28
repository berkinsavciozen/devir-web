import { createContext, useContext, type ReactNode } from 'react';
import { git } from '../yonlendirme';
import { Gok, useBoyut } from './Gok';
import { Zil } from './Zil';
import { DevirAiDugme } from '../ekranlar/ai/DevirAi';

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

/** Panelin üst çubuğu (N9): solda geri ve konum, sağda zil, ayarlar ve yeni iş. */
export function PanelUst({ geri, konum, sag = true }: { geri?: () => void; konum?: string; sag?: boolean }) {
  return (
    <div className="panel-ust">
      {geri && <button type="button" className="panel-geri" aria-label={konum ? `Geri: ${konum}` : 'Geri'} onClick={geri}><GeriIkon /></button>}
      {konum && <span className="panel-konum">{konum}</span>}
      {sag && <span className="panel-ust-sag">
        <DevirAiDugme />
        <Zil y={0} kabukta stil={{ position: 'relative', right: 'auto', left: 'auto' }} />
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
  return (
    <aside className="kabuk-panel" style={{ left: X, width: PANEL_EN, height: H }} aria-label={konum || 'Panel'}>
      <PanelUst geri={geri} konum={konum} />
      <div className="kabuk-panel-icerik">
        <PanelBaglam.Provider value>{children}</PanelBaglam.Provider>
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
