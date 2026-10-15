/**
 * Devir JSON API istemcisi (sunucu 0.9.0, knowledge/claude/devir-api.md).
 * - Authorization: Bearer <oturum> ya da dv_ anahtarı; birden çok alanda x-devir-alan.
 * - Yanıt { ok: false, hata } ise ApiHatasi fırlatılır; `hata` cümlesi olduğu gibi gösterilir (§3.21).
 * - 401 → oturum bir kez yenilenir, yine 401 ise `devir:giris-gerekli` olayı yayımlanır.
 */
import { kimlik } from './kimlik';
import { API_TABAN, SAHTE, hal } from './ortam';

export class ApiHatasi extends Error {
  constructor(public durum: number, public hata: string) { super(hata); }
}

type Tasima = (req: Request) => Promise<Response>;
let tasima: Promise<Tasima> | null = null;

/** Sahte kipte senaryo adresten okunur (?senaryo=bos) ve sekme boyunca korunur. */
export function senaryo(): string {
  const q = new URLSearchParams(location.search).get('senaryo');
  try { if (q) sessionStorage.setItem('devir:senaryo', q); return q || sessionStorage.getItem('devir:senaryo') || 'berkin'; } catch { return q || 'berkin'; }
}

function tasimaAl(): Promise<Tasima> {
  if (tasima) return tasima;
  if (SAHTE) {
    tasima = import('./sahte/sahte').then(async (m) => {
      const s = await m.sahteSunucu(senaryo() as any, { acikKayit: new URLSearchParams(location.search).get('kayit') !== 'kapali', hal: hal() });
      (window as any).__devirSahte = s;
      return (req: Request) => s.istek(req);
    });
  } else tasima = Promise.resolve((req: Request) => fetch(req));
  return tasima;
}
const TABAN = () => (SAHTE ? 'https://sahte.devir/functions/v1/devir-mcp' : API_TABAN);

const ALAN = 'devir:alan';
export const alanSecimi = {
  al(): string | null { try { return localStorage.getItem(ALAN); } catch { return null; } },
  koy(id: string | null) { try { if (id) localStorage.setItem(ALAN, id); else localStorage.removeItem(ALAN); } catch { /* yok */ } },
};

async function gonder(method: 'GET' | 'POST', yol: string, govde?: unknown, o: { kimliksiz?: boolean } = {}): Promise<Response> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (govde !== undefined) h['content-type'] = 'application/json';
  if (!o.kimliksiz) {
    const b = await kimlik.belirtec();
    if (b) h.authorization = `Bearer ${b}`;
    const alan = alanSecimi.al();
    if (alan) h['x-devir-alan'] = alan;
  }
  const t = await tasimaAl();
  return t(new Request(TABAN() + yol, { method, headers: h, body: govde !== undefined ? JSON.stringify(govde) : undefined }));
}

async function cozumle<T>(r: Response): Promise<T> {
  let j: any = null;
  try { j = await r.json(); } catch { /* boş */ }
  if (!r.ok || !j || j.ok === false) throw new ApiHatasi(r.status, j?.hata || 'Şu an bağlanılamadı. Yeniden dene.');
  return j as T;
}

export async function istek<T = any>(method: 'GET' | 'POST', yol: string, govde?: unknown, o: { kimliksiz?: boolean } = {}): Promise<T> {
  let r: Response;
  try { r = await gonder(method, yol, govde, o); } catch { throw new ApiHatasi(0, 'Bağlantı yok; son görülen hal.'); }
  if (r.status === 401 && !o.kimliksiz) {
    if (await kimlik.yenile()) r = await gonder(method, yol, govde, o);
    if (r.status === 401) window.dispatchEvent(new Event('devir:giris-gerekli'));
  }
  // seçili alan artık geçerli değilse (çıkarıldı) seçimi bırakıp bir kez daha dene
  if (r.status === 403 && alanSecimi.al() && !o.kimliksiz) {
    const j = await r.clone().json().catch(() => null);
    if (j?.hata === 'Bu çalışma alanına üye değilsin.') { alanSecimi.koy(null); r = await gonder(method, yol, govde, o); }
  }
  return cozumle<T>(r);
}

export const api = {
  get: <T = any>(yol: string) => istek<T>('GET', '/api/v1' + yol),
  post: <T = any>(yol: string, govde: unknown = {}) => istek<T>('POST', '/api/v1' + yol, govde),
  /** Dış katılımcı bağlantısı (anahtarsız) */
  baglanti: {
    get: <T = any>(token: string) => istek<T>('GET', `/l/${encodeURIComponent(token)}`, undefined, { kimliksiz: true }),
    post: <T = any>(token: string, govde: unknown) => istek<T>('POST', `/l/${encodeURIComponent(token)}`, govde, { kimliksiz: true }),
  },
};
