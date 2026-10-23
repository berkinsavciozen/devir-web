import type { CSSProperties, ElementType, ReactNode } from 'react';
import { Gok } from './Gok';
import { usePanelIcinde } from './Kabuk';

/**
 * Sahne: 390 × 844 tasarım karesine göre yerleşen ekran.
 * - Süsler (illüstrasyon) tek SVG katmanında, kare ortalanarak çizilir.
 * - Metin, alan ve düğmeler HTML'dir; `y` değerleri tasarımdaki konumlardır (metinde taban çizgisi).
 * - Yatayda sol/sağ 20 px kenar boşluğu korunur; 430 px'ten geniş ekranda sütun ortalanır.
 */
export interface GokAyar { tohum?: number; yildiz?: number; parilti?: number; bulutsu?: Array<[number, number, number, string]>; sakin?: [number, number, number] }

export function Sahne({ gok, cizim, ortala, children, etiket, yukseklik, sinif = '' }: { gok: GokAyar; cizim?: string; ortala?: boolean; children?: ReactNode; etiket?: string; yukseklik?: number; sinif?: string }) {
  // masaüstü kabuğunun panelinde gök kabuğun; sahne panelin içinde kayan bir bölüm olur
  const panelde = usePanelIcinde();
  const Ana = panelde ? 'section' : 'main';
  return (
    <>
      {!panelde && <Gok tohum={gok.tohum} yildiz={gok.yildiz} parilti={gok.parilti} bulutsu={gok.bulutsu} sakin={gok.sakin} />}
      <Ana className={`sahne ${ortala && !panelde ? 'sahne-ortala' : ''} ${panelde ? 'sahne-panelde' : ''} ${sinif}`} aria-label={etiket} style={yukseklik && yukseklik > 844 ? { minHeight: yukseklik } : undefined}>
        {cizim && <svg className="sahne-cizim" aria-hidden width="390" height="844" viewBox="0 0 390 844" dangerouslySetInnerHTML={{ __html: cizim }} />}
        {children}
      </Ana>
    </>
  );
}

// Yazı yüzlerinin dikey ölçüleri (hhea): taban çizgisinin satır kutusu içindeki yeri için.
const KAYMA = { sans: (0.96875 - 0.2412) / 2, serif: (0.9 - 0.25) / 2 };

/** Taban çizgisi y olan, satır yüksekliği L olan metnin kutu üstü. */
export const metinUst = (y: number, fs: number, L: number, serif = false) => y - L / 2 - (serif ? KAYMA.serif : KAYMA.sans) * fs;

export interface MetinOz {
  /** ilk satırın taban çizgisi (tasarım karesinde) */
  y: number;
  x?: number;
  fs: number;
  lh?: number;
  serif?: boolean;
  agirlik?: number;
  renk?: 'ink' | 'ink2' | 'ink3' | 'altin' | 'mercan' | 'lila-acik';
  hiza?: 'sol' | 'orta' | 'sag';
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  id?: string;
}
const RENK: Record<NonNullable<MetinOz['renk']>, string> = {
  ink: 'var(--renk-metin-ink)', ink2: 'var(--renk-metin-ink2)', ink3: 'var(--renk-metin-ink3)',
  altin: 'var(--renk-metin-altin)', mercan: 'var(--renk-metin-mercan)', 'lila-acik': 'var(--renk-dosya-turu-diger)',
};

/** Sahnede konumlu metin. hiza 'orta' ise x yok sayılır ve sütunun ortasına yazılır. */
export function Metin({ y, x = 20, fs, lh, serif, agirlik, renk = 'ink', hiza = 'sol', as: Etiket = 'p', className = '', style, children, id }: MetinOz) {
  const L = lh ?? Math.round(fs * 1.3);
  const st: CSSProperties = {
    top: metinUst(y, fs, L, serif), fontSize: fs, lineHeight: `${L}px`, fontWeight: agirlik ?? (serif ? 400 : 500),
    fontFamily: serif ? 'var(--font-serif)' : 'var(--font-sans)', color: RENK[renk], ...style,
  };
  if (hiza === 'orta') Object.assign(st, { left: 0, right: 0, textAlign: 'center' });
  else if (hiza === 'sag') Object.assign(st, { right: 390 - x, textAlign: 'right' });
  else Object.assign(st, { left: x, right: 20 });
  return <Etiket id={id} className={`sahne-metin ${className}`} style={st}>{children}</Etiket>;
}

/** Sahnede konumlu kutu: x, y, genişlik (yoksa sağda 20 px kalır), yükseklik. */
export function Kutu({ x = 20, y, w, h, children, className = '', style, as: Etiket = 'div', ...p }: { x?: number; y: number; w?: number; h?: number; children?: ReactNode; className?: string; style?: CSSProperties; as?: ElementType } & Record<string, unknown>) {
  const st: CSSProperties = { top: y, left: x, height: h, ...(w ? { width: w } : { right: 20 }), ...style };
  return <Etiket className={`sahne-kutu ${className}`} style={st} {...p}>{children}</Etiket>;
}

/** Geniş sahne (tablet yatay ≥ 1024, masaüstü ≥ 1280): pencere boyunda tek çizim katmanı; koordinatlar pencereye göre. */
export function GenisSahne({ gok, cizim, w, h, children, etiket, sinif = '' }: { gok: GokAyar; cizim: string; w: number; h: number; children?: ReactNode; etiket?: string; sinif?: string }) {
  return (
    <>
      <Gok tohum={gok.tohum} yildiz={gok.yildiz} parilti={gok.parilti} bulutsu={gok.bulutsu} sakin={gok.sakin} genis />
      <main className={`sahne-genis ${sinif}`} aria-label={etiket} style={{ width: w, height: h }}>
        <svg className="sahne-genis-cizim" aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} dangerouslySetInnerHTML={{ __html: cizim }} />
        {children}
      </main>
    </>
  );
}
