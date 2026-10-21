/**
 * Devir JSON API istemcisi (sunucu 0.9.0, knowledge/claude/devir-api.md).
 * - Authorization: Bearer <oturum> ya da dv_ anahtarı; birden çok alanda x-devir-alan.
 * - Yanıt { ok: false, hata } ise ApiHatasi fırlatılır; `hata` cümlesi olduğu gibi gösterilir (§3.21).
 * - 401 → oturum bir kez yenilenir, yine 401 ise `devir:giris-gerekli` olayı yayımlanır.
 */
import { kimlik } from './kimlik';
import { API_TABAN, SAHTE, hal } from './ortam';
import { arama } from '../yonlendirme';

export class ApiHatasi extends Error {
  constructor(public durum: number, public hata: string) { super(hata); }
}

type Tasima = (req: Request) => Promise<Response>;
let tasima: Promise<Tasima> | null = null;

/** Sahte kipte senaryo adresten okunur (?senaryo=bos) ve sekme boyunca korunur. */
export function senaryo(): string {
  const q = arama().get('senaryo');
  try { if (q) sessionStorage.setItem('devir:senaryo', q); return q || sessionStorage.getItem('devir:senaryo') || 'berkin'; } catch { return q || 'berkin'; }
}

function tasimaAl(): Promise<Tasima> {
  if (tasima) return tasima;
  if (SAHTE) {
    tasima = import('./sahte/sahte').then(async (m) => {
      const s = await m.sahteSunucu(senaryo() as any, { acikKayit: arama().get('kayit') !== 'kapali', hal: hal() });
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

async function gonder(method: 'GET' | 'POST', yol: string, govde?: unknown, o: { kimliksiz?: boolean; baglanti?: string } = {}): Promise<Response> {
  const h: Record<string, string> = { accept: 'application/json' };
  if (o.baglanti) h['x-devir-baglanti'] = o.baglanti;
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

/**
 * Sunucu hata cümlesi → kullanıcı dili (denetim planı, CELISKILER 66). MCP araç adları ve teknik yollar ekrana
 * çıkmaz; bilinmeyen cümle olduğu gibi kalır (§3.21), sunucu çökmesi ve boş yanıt sade bir cümleye döner.
 */
export function kullaniciDili(durum: number, hata?: string | null): string {
  const h = String(hata || '').trim();
  if (/akışı senin kapsamında değil/.test(h)) return 'Bu akış sana açık değil; alanın sahibinden erişim iste.';
  if (/kodlu akış bulunamadı|akış bulunamadı/i.test(h)) return 'Bu akış bulunamadı; kapanmış ya da başka bir alanda olabilir.';
  if (/sana atanmamış/.test(h)) return 'Bu adım sana atanmamış; yalnız kendi adımlarını görebilirsin.';
  if (/taslağı yok/.test(h)) return 'Bu taslak bulunamadı; kurulmuş ya da silinmiş olabilir.';
  if (/^Böyle bir uç yok/.test(h)) return 'Bu işlem şu an yapılamıyor.';
  if (h) return h.replace(/\s*devir_\w+ (ile|aracıyla)[^.]*\./g, '').trim() || 'Bu işlem şu an yapılamıyor.';
  if (durum >= 500) return 'Bir şeyler ters gitti; birazdan yeniden dene.';
  return 'Şu an bağlanılamadı. Yeniden dene.';
}

async function cozumle<T>(r: Response): Promise<T> {
  let j: any = null;
  try { j = await r.json(); } catch { /* boş */ }
  if (!r.ok || !j || j.ok === false) throw new ApiHatasi(r.status, kullaniciDili(r.status, j?.hata));
  return j as T;
}

export async function istek<T = any>(method: 'GET' | 'POST', yol: string, govde?: unknown, o: { kimliksiz?: boolean; baglanti?: string } = {}): Promise<T> {
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
  /** Dış katılımcı bağlantısı (anahtarsız). Belirteç başlıkta gider, adres yolunda değil (N-3). */
  baglanti: {
    get: <T = any>(token: string) => istek<T>('GET', '/l', undefined, { kimliksiz: true, baglanti: token }),
    post: <T = any>(token: string, govde: unknown) => istek<T>('POST', '/l', govde, { kimliksiz: true, baglanti: token }),
    /** yükleme adresi (F2b): yalnız kişinin kendi adımı */
    dosya: <T = any>(token: string, govde: unknown) => istek<T>('POST', '/l/dosya', govde, { kimliksiz: true, baglanti: token }),
  },
};
