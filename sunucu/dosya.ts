// Dosya yükleme: gizli kova (devir-dosya) + dosya tablosu. Sunucu yalnızca imzalı adres üretir; dosyanın kendisi
// istemciden doğrudan kovaya gider. Kapsam denetimi burada: ekip kendi çalışma alanındaki her akışı, dış katılımcı
// yalnızca kendi adımını ve ekibin dışa açtığı girdileri görür.
import { type Ctx, getAkis, stepInScope, isDis, fixStep } from "./core.ts";

export interface Depo {
  yuklemeAdresi(yol: string): Promise<{ url: string; token: string }>;
  indirmeAdresi(yol: string, saniye: number, ad: string): Promise<string>;
  bilgi(yol: string): Promise<{ boyut: number; tur: string } | null>;
  sil(yollar: string[]): Promise<void>;
}

export const KOVA = "devir-dosya";
export const AZAMI_BOYUT = 20 * 1024 * 1024;
export const TURLER: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "görsel", "image/jpeg": "görsel", "image/webp": "görsel", "image/heic": "görsel",
  "application/msword": "Word", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "application/vnd.ms-excel": "Excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
  "application/vnd.ms-powerpoint": "PowerPoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
  "text/csv": "CSV", "text/plain": "metin",
};
const INDIRME_SN = 600;
export const DOSYA_ON = "dosya:";

export class DosyaHata extends Error { constructor(public durum: number, m: string) { super(m); } }

function depoGerek(ctx: Ctx): Depo {
  const d = (ctx as any).depo as Depo | undefined;
  if (!d) throw new DosyaHata(503, "Dosya deposu bu sunucuda kapalı.");
  return d;
}

function guvenliAd(ad: string) {
  const t = ad.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").replace(/^[._]+/, "");
  return (t || "dosya").slice(-100);
}

export const dosyaV = (d: any) => ({ id: d.id, ad: d.ad, tur: d.tur, tur_ad: TURLER[d.tur] || d.tur, boyut: Number(d.boyut), adim_no: d.adim_no, durum: d.durum, kim: d.kim || null, tarih: d.created_at });
export const dosyaIdOf = (url: string | null | undefined) => (url && url.startsWith(DOSYA_ON) ? url.slice(DOSYA_ON.length) : null);

// 1. adım: yükleme adresi. Gövde { ad, tur, boyut }. İstemci dosyayı dönen adrese PUT eder.
export async function yuklemeIste(ctx: Ctx, akisKod: string, no: number, b: any) {
  const depo = depoGerek(ctx);
  const akis = await getAkis(ctx, akisKod);
  const s = await ctx.db.one("adim", { akis_id: akis.id, no });
  if (!s) throw new DosyaHata(404, `Bu akışta ${no} numaralı adım yok.`);
  if (isDis(ctx) && !stepInScope(ctx, fixStep(s))) throw new DosyaHata(403, "Bu adım sana atanmamış; dosyayı yalnızca kendi adımına ekleyebilirsin.");
  const ad = String(b?.ad || "").trim().slice(0, 200);
  const tur = String(b?.tur || "").trim().toLowerCase();
  const boyut = Number(b?.boyut);
  if (!ad) throw new DosyaHata(400, "ad gerekli: dosyanın adı.");
  if (!TURLER[tur]) throw new DosyaHata(400, "Bu dosya türü kabul edilmiyor. PDF, görsel, Word, Excel, PowerPoint, CSV ya da metin yükle.");
  if (!(boyut > 0)) throw new DosyaHata(400, "boyut gerekli (bayt).");
  if (boyut > AZAMI_BOYUT) throw new DosyaHata(400, "Dosya 20 MB'den büyük olamaz.");
  const id = crypto.randomUUID();
  const yol = `${ctx.ws.id}/${akis.id}/${no}/${id}/${guvenliAd(ad)}`;
  const y = await depo.yuklemeAdresi(yol);
  const [d] = await ctx.db.insert("dosya", [{ id, ws_id: ctx.ws.id, akis_id: akis.id, adim_no: no, yol, ad, tur, boyut, kim: ctx.key.kisi || null, kim_tip: isDis(ctx) ? "dis" : "insan", durum: "bekliyor" }]);
  return {
    dosya: dosyaV(d),
    yukleme: { url: y.url, token: y.token, yontem: "PUT", basliklar: { "content-type": tur } },
    sonra: "Dosyayı bu adrese yükledikten sonra adımı güncellerken cikti: { dosya: <id>, ozet } ver.",
  };
}

// 2. adım: adım güncellemesindeki cikti.dosya'yı çöz. Dosya yüklenmiş mi bakar, cikti'yi dosyaya bağlar.
export async function dosyaCiktilari(ctx: Ctx, akisId: string, no: number, cikti: any) {
  if (cikti == null) return cikti;
  const L = Array.isArray(cikti) ? cikti : [cikti];
  const out: any[] = [];
  for (const c of L) {
    if (!c || typeof c !== "object" || !c.dosya) { out.push(c); continue; }
    const depo = depoGerek(ctx);
    const d = await ctx.db.one("dosya", { id: String(c.dosya), ws_id: ctx.ws.id });
    if (!d || d.akis_id !== akisId || d.durum === "silindi") throw new DosyaHata(404, "Dosya bulunamadı; önce yükleme adresi iste.");
    if (d.adim_no !== no) throw new DosyaHata(400, `Bu dosya ${d.adim_no}. adım için yüklendi.`);
    if (d.durum !== "yuklendi") {
      const bil = await depo.bilgi(d.yol);
      if (!bil) throw new DosyaHata(400, "Dosya henüz yüklenmemiş. Yükleme bitince tekrar dene.");
      await ctx.db.update("dosya", { id: d.id }, { durum: "yuklendi", boyut: bil.boyut || d.boyut });
    }
    const { dosya: _x, ...rest } = c;
    out.push({ ...rest, ad: rest.ad || d.ad, url: DOSYA_ON + d.id, kaynak: "Devir dosya" });
  }
  return Array.isArray(cikti) ? out : out[0];
}

// Görülebilir mi: ekip her dosyayı; dış katılımcı kendi adımındakini ya da dışa açılmış çıktıya bağlı olanı.
async function gorebilir(ctx: Ctx, d: any) {
  if (!isDis(ctx)) return true;
  const s = d.adim_no != null ? await ctx.db.one("adim", { akis_id: d.akis_id, no: d.adim_no }) : null;
  if (s && stepInScope(ctx, fixStep(s))) return true;
  const c = await ctx.db.one("cikti", { akis_id: d.akis_id, url: DOSYA_ON + d.id });
  if (!c || c.paylasim !== "dis") return false;
  const steps = (await ctx.db.many("adim", { akis_id: d.akis_id }, "no")).map(fixStep);
  return steps.some((x: any) => stepInScope(ctx, x)); // dışa açık çıktı da yalnızca kişinin kendi akışında
}

export async function indir(ctx: Ctx, id: string, akisId?: string) {
  const depo = depoGerek(ctx);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new DosyaHata(404, "Dosya bulunamadı.");
  const d = await ctx.db.one("dosya", { id, ws_id: ctx.ws.id });
  if (!d || d.durum === "silindi" || (akisId && d.akis_id !== akisId)) throw new DosyaHata(404, "Dosya bulunamadı.");
  if (!(await gorebilir(ctx, d))) throw new DosyaHata(403, "Bu dosya ekibe özel.");
  if (d.durum !== "yuklendi" && !(await depo.bilgi(d.yol))) throw new DosyaHata(404, "Dosya henüz yüklenmemiş.");
  return { dosya: dosyaV(d), url: await depo.indirmeAdresi(d.yol, INDIRME_SN, d.ad), gecerlilik_sn: INDIRME_SN };
}

// KVKK: tek dosyayı ya da bir akışın bütün dosyalarını kalıcı sil. Çıktı kaydı kalır, bağlantısı "silindi" olur.
export async function sil(ctx: Ctx, ids: string[] | null, akisId?: string) {
  const depo = depoGerek(ctx);
  if (isDis(ctx)) throw new DosyaHata(403, "Dosyaları yalnızca ekip silebilir.");
  const L = ids
    ? (await Promise.all(ids.map((id) => ctx.db.one("dosya", { id, ws_id: ctx.ws.id })))).filter(Boolean)
    : await ctx.db.many("dosya", { akis_id: akisId, ws_id: ctx.ws.id }, "created_at", 5000);
  const canli = L.filter((d: any) => d.durum !== "silindi");
  if (ids && !canli.length) throw new DosyaHata(404, "Dosya bulunamadı.");
  if (canli.length) await depo.sil(canli.map((d: any) => d.yol));
  const at = new Date(ctx.now).toISOString();
  for (const d of canli) {
    await ctx.db.update("dosya", { id: d.id }, { durum: "silindi", silindi_at: at });
    await ctx.db.update("cikti", { akis_id: d.akis_id, url: DOSYA_ON + d.id }, { url: null, kaynak: "Devir dosya (silindi)" });
  }
  return { silinen: canli.length };
}

export async function akisDosyalari(ctx: Ctx, akisKod: string) {
  const akis = await getAkis(ctx, akisKod);
  const L = (await ctx.db.many("dosya", { akis_id: akis.id, ws_id: ctx.ws.id }, "created_at", 5000)).filter((d: any) => d.durum === "yuklendi");
  const gorunen = [];
  for (const d of L) if (await gorebilir(ctx, d)) gorunen.push(dosyaV(d));
  return { dosyalar: gorunen, toplam_boyut: gorunen.reduce((t, d) => t + d.boyut, 0) };
}
