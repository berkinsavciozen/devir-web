export interface YorungeModel { simdi: number; aralik: [number, number]; bakan: string; byNo: Record<number, any>; kisi: Record<string, any>; kisiler: any[]; adimlar: any[]; [k: string]: any }
export interface YorungeDurum { S: Record<number, any>; H: Record<number, any>; K: Record<string, any> }
export interface YorungeOrnegi {
  kur(M: YorungeModel, o: { svg: SVGSVGElement; cihaz: 'tel' | 'mas'; ust?: number; zoomDegis?: (z: number) => void; sonBakis?: number | null; yeni?: Record<number, string>; yeniHamle?: Set<number> }): any;
  guncelle(an: number, D: YorungeDurum): void;
  sigdir(): void; tamGorunum(): void; kamera(): void; hedefTam(): { k: number; tx: number; ty: number };
  zoomAt(k: number, px: number, py: number): void; kaydir(dx: number, dy: number): void; odakla(wx: number, wy: number, k: number): void;
  sec(no: number | null, kisi?: string | null): void; vurgu(anahtar: string | null): void;
  readonly H: any; readonly zoom: number;
}
export function yorungeHaritasi(): YorungeOrnegi;
export function kur(ham: { simdi: string; akis: any }, bakan: string, o?: { renkler?: Record<string, string> }): YorungeModel;
export function durumAn(M: YorungeModel, an: number): YorungeDurum;
export const KISI_DURUM_AD: Record<string, string>;
export const ADIM_DURUM_AD: Record<string, string>;
export function arac(k: any, kd: any, o?: Record<string, any>): { svg: string; [k: string]: any };
export function gezegen(a: any, o?: Record<string, any>): string;
export function durumRenk(durum: string): string;
export function anYaz(t: number): string;
