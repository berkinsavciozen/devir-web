// Dosya çıktısı (§5 B8, F2): 1) yükleme adresi iste 2) dosyayı imzalı adrese PUT et 3) adımı cikti:{dosya} ile güncelle.
import { api, ApiHatasi } from './istemci';
import { SAHTE } from './ortam';

export const AZAMI_BOYUT = 20 * 1024 * 1024;
export const KABUL = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/csv', 'text/plain'];
export const KABUL_UZANTI = '.pdf,.png,.jpg,.jpeg,.webp,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt';

const UZANTI_TUR: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', doc: 'application/msword', docx: KABUL[6], xls: KABUL[7], xlsx: KABUL[8], ppt: KABUL[9], pptx: KABUL[10], csv: 'text/csv', txt: 'text/plain' };
/** Tarayıcı türü boş bırakabilir (HEIC, CSV): uzantıdan. */
export const turOf = (f: File) => (f.type && KABUL.includes(f.type) ? f.type : UZANTI_TUR[f.name.split('.').pop()?.toLowerCase() || ''] || f.type || '');

/** Glif etiketi: PDF, JPG, XLSX… */
export function glifTur(ad: string, tur?: string): string {
  const u = ad.split('.').pop()?.toUpperCase() || '';
  if (['PDF', 'JPG', 'JPEG', 'PNG', 'WEBP', 'HEIC', 'DOC', 'DOCX', 'XLS', 'XLSX', 'PPT', 'PPTX', 'CSV', 'TXT'].includes(u)) return u === 'JPEG' ? 'JPG' : u;
  return tur?.includes('pdf') ? 'PDF' : tur?.startsWith('image/') ? 'JPG' : 'DOSYA';
}
/** "2,4 MB", "820 KB" */
export function boyutYaz(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(b / 1e3))} KB`;
}

/** İstemci denetimi (§3.22): tür ve boyut, yükleme adresi istenmeden. */
export function dosyaDenetle(f: File): string | null {
  if (!KABUL.includes(turOf(f))) return 'Bu dosya türü kabul edilmiyor. PDF, görsel, Word, Excel, PowerPoint, CSV ya da metin yükle.';
  if (f.size > AZAMI_BOYUT) return "Dosya 20 MB'den büyük olamaz.";
  if (!f.size) return 'Dosya boş görünüyor.';
  return null;
}

export interface Yukleme { iptal: () => void; bitti: Promise<{ dosya_id: string }> }

/** İmzalı adrese PUT, ilerlemeyle. Sahte kipte yükleme 1 MB/sn hızla taklit edilir. */
function koy(url: string, f: File, tur: string, ilerle: (p: number) => void): { iptal: () => void; bitti: Promise<void> } {
  if (SAHTE && url.startsWith('sahte-depo:')) {
    let iptal = false, id = 0;
    const bitti = new Promise<void>((ok, red) => {
      const t0 = performance.now(), sure = Math.max(400, f.size / 1e6 * 1000);
      id = window.setInterval(async () => {
        if (iptal) { clearInterval(id); red(new Error('iptal')); return; }
        const p = Math.min(1, (performance.now() - t0) / sure); ilerle(p);
        if (p >= 1) { clearInterval(id); const { sahteDepo } = await import('./sahte/sahte'); sahteDepo.set(url.slice('sahte-depo:'.length), { boyut: f.size, tur }); ok(); }
      }, 100);
    });
    return { iptal: () => { iptal = true; }, bitti };
  }
  const x = new XMLHttpRequest();
  const bitti = new Promise<void>((ok, red) => {
    x.upload.onprogress = (e) => { if (e.lengthComputable) ilerle(e.loaded / e.total); };
    x.onload = () => (x.status < 300 ? ok() : red(new Error('Dosya yüklenemedi; bağlantı kopmuş olabilir.')));
    x.onerror = () => red(new Error('Dosya yüklenemedi; bağlantı kopmuş olabilir.'));
    x.onabort = () => red(new Error('iptal'));
  });
  x.open('PUT', url);
  x.setRequestHeader('content-type', tur);
  x.setRequestHeader('x-upsert', 'false');
  x.send(f);
  return { iptal: () => x.abort(), bitti };
}

/**
 * Ekip yolu: /akis/:kod/adim/:no/dosya → PUT → /akis/:kod/adim/:no {cikti:{dosya, ozet}}.
 * taban: dış katılımcı için '/l/:token' (F2) — o zaman teslim ayrı yapılır (teslimEt=false).
 */
export function dosyaYukle(o: { yol: string; dosya: File; ilerle: (p: number) => void; teslim?: (dosyaId: string) => Promise<unknown> }): Yukleme {
  let ic: { iptal: () => void } | null = null, iptalEdildi = false;
  const bitti = (async () => {
    const tur = turOf(o.dosya);
    const r = await api.post<any>(o.yol, { ad: o.dosya.name, tur, boyut: o.dosya.size });
    if (iptalEdildi) throw new Error('iptal');
    const k = koy(r.yukleme.url, o.dosya, tur, o.ilerle);
    ic = k;
    await k.bitti;
    if (o.teslim) await o.teslim(r.dosya.id);
    return { dosya_id: r.dosya.id as string };
  })();
  return { iptal: () => { iptalEdildi = true; ic?.iptal(); }, bitti };
}

/** İndir: 600 sn geçerli adres; hemen açılır, saklanmaz. */
export async function dosyaIndir(id: string, taban = '') {
  const r = await api.get<any>(`${taban}/dosya/${id}`);
  const a = document.createElement('a');
  a.href = r.url; a.rel = 'noopener'; a.target = '_blank'; a.download = r.dosya?.ad || '';
  document.body.appendChild(a); a.click(); a.remove();
}

export const dosyaSil = (id: string) => api.post<any>(`/dosya/${id}/sil`, {});
export { ApiHatasi };
