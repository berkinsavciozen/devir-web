// Faz 1.5 · deneyim belleği: kapanan akışlardan deneyim kaydı ve ders, alan bilgi kartları, benzerlikle getirme.
// Öğrenim iş türü koduna değil, benzerliğe bağlıdır: yeni iş en benzer geçmiş işleri, dersleri ve kartları görür.
import type { LlmFn, LlmTool } from "./llm.ts";

export type GomFn = (metinler: string[]) => Promise<number[][]>;
type DB = {
  one(t: string, w: Record<string, unknown>): Promise<any | null>;
  many(t: string, w: Record<string, unknown>, order?: string, limit?: number): Promise<any[]>;
  insert(t: string, rows: any[]): Promise<any[]>;
  update(t: string, w: Record<string, unknown>, p: Record<string, unknown>): Promise<void>;
};
export type BCtx = { db: DB; ws: any; now: number; llm?: LlmFn; gom?: GomFn; modeller?: { taslak?: string; hizli?: string } };

// ---------- metin benzerliği ----------
const trk = (s: unknown) => String(s ?? "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");
export const vnorm = (s: unknown) => trk(s).replace(/[^a-z0-9]+/g, " ").trim();
const DURAK = new Set("ve ile icin bir bu su da de mi ya veya olan olarak gibi gore sonra once lazim gerek gerekiyor yapmam yapmak yapilacak etmem etmek bitir bitirmem istiyorum bizim benim icin kadar daha cok her hangi the and for with from that this".split(" "));
// Türkçe ekler için kaba kök: ilk 5 harf ("entegrasyonu" → "enteg", "bankanın" → "banka")
export function kokler(s: unknown): string[] {
  return [...new Set(trk(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !DURAK.has(w)).map((w) => w.slice(0, 5)))];
}
export function kosinus(a: number[], b: number[]) {
  let s = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? s / Math.sqrt(x * y) : 0;
}
export function kelimeBenzer(A: string[], B: string[]) {
  if (!A.length || !B.length) return 0;
  const b = new Set(B); let o = 0;
  for (const w of A) if (b.has(w)) o++;
  return o / Math.sqrt(A.length * B.length);
}
type Iz = { gomme?: number[] | null; kok: string[] };
// gömme varsa kosinüs, yoksa kök örtüşmesi; ikisi kabaca aynı ölçeğe getirilir
export function benzer(q: Iz, x: Iz) {
  if (q.gomme && x.gomme && q.gomme.length === x.gomme.length) return kosinus(q.gomme, x.gomme);
  return kelimeBenzer(q.kok, x.kok) * 0.85;
}
// eşikler: 256 boyutlu text-embedding-3-small için ilgisiz işler ~0.1–0.25, benzer işler 0.4 üstü
export const ESIK = { deneyim: 0.32, ders: 0.3, kart: 0.33, standart: 0.45, zorunlu: 0.5 };

export function openaiGomme(apiKey: string, model = "text-embedding-3-small"): GomFn {
  return async (metinler) => {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, input: metinler.map((m) => String(m || "-").slice(0, 4000)), dimensions: 256 }),
      signal: AbortSignal.timeout(15_000),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`gömme alınamadı (${res.status} ${data?.error?.message || ""})`);
    return (data.data || []).sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding.map((x: number) => Math.round(x * 1e5) / 1e5));
  };
}

// ---------- satırların metinleri ----------
export const deneyimMetni = (d: any) => [d.baslik, d.cumle, d.varlik].filter(Boolean).join(" · ");
export const dersMetni = (x: any) => [x.metin, (x.tetik || []).join(" ")].filter(Boolean).join(" · ");
export const kartMetni = (k: any) => [k.baslik, k.alan, (k.tetik || []).join(" "), k.kural].filter(Boolean).join(" · ");
export const standartMetni = (s: any) => [s.ad, s.aciklama, (s.tetik || []).join(" ")].filter(Boolean).join(" · ");

async function gommeTamamla(ctx: BCtx, tablo: string, rows: any[], metin: (r: any) => string) {
  if (!ctx.gom) return;
  const eksik = rows.filter((r) => !Array.isArray(r.gomme) || !r.gomme.length).slice(0, 96);
  if (!eksik.length) return;
  const g = await ctx.gom(eksik.map(metin));
  for (let i = 0; i < eksik.length; i++) {
    if (!g[i]) continue;
    eksik[i].gomme = g[i];
    await ctx.db.update(tablo, { id: eksik[i].id }, { gomme: g[i] });
  }
}

export type Hatira = { deneyim: any[]; ders: any[]; kart: any[]; standart: any | null; gommeli: boolean };

// yeni cümle için en benzer deneyimler, dersler, kartlar ve varsa sabitlenmiş standart süreç
export async function hatirla(ctx: BCtx, o: { cumle: string; varlik?: string | null; iliski?: string | null }): Promise<Hatira> {
  const ws = ctx.ws.id;
  const vn = o.varlik ? vnorm(o.varlik) : "";
  const [dR, xR, kR, sR] = await Promise.all([
    ctx.db.many("deneyim", { ws_id: ws }, "created_at", 400).catch(() => []),
    ctx.db.many("ders", { ws_id: ws, durum: ["aday", "kesin"] }, "updated_at", 400).catch(() => []),
    ctx.db.many("bilgi_karti", { durum: "yayinda" }, "kod", 400).catch(() => []),
    ctx.db.many("standart_surec", { ws_id: ws, durum: "aktif" }, "created_at", 100).catch(() => []),
  ]);
  const kartlar = kR.filter((k: any) => k.kaynak_url);
  let qG: number[] | null = null;
  if (ctx.gom) {
    try {
      qG = (await ctx.gom([[o.cumle, o.varlik].filter(Boolean).join(" · ")]))[0] || null;
      await gommeTamamla(ctx, "deneyim", dR, deneyimMetni);
      await gommeTamamla(ctx, "ders", xR, dersMetni);
      await gommeTamamla(ctx, "bilgi_karti", kartlar, kartMetni);
      await gommeTamamla(ctx, "standart_surec", sR, standartMetni);
    } catch (e) { console.warn("gömme kullanılamadı, kelime benzerliğine düşüldü:", (e as Error).message); qG = null; }
  }
  const q: Iz = { gomme: qG, kok: kokler(`${o.cumle} ${o.varlik || ""}`) };
  const iz = (r: any, m: (r: any) => string): Iz => ({ gomme: qG ? r.gomme : null, kok: kokler(m(r)) });

  const deneyim = dR.map((d: any) => ({ d, puan: benzer(q, iz(d, deneyimMetni)) + (vn && d.varlik_norm === vn ? 0.15 : 0) + (o.iliski && d.iliski === o.iliski ? 0.03 : 0) }))
    .filter((x: any) => x.puan >= ESIK.deneyim).sort((a: any, b: any) => b.puan - a.puan).slice(0, 5)
    .map((x: any) => ({ ...x.d, _puan: Math.round(x.puan * 100) / 100 }));
  const benzerKod = new Set(deneyim.map((d: any) => d.akis_kod).filter(Boolean));

  const ders = xR.map((x: any) => {
    if (x.kapsam === "varlik" && x.varlik_norm && x.varlik_norm !== vn) return null; // başka varlığın dersi
    const kanitKod: string[] = (x.kanit || []).map((k: any) => k.akis).filter(Boolean);
    const kaynaktan = kanitKod.some((k) => benzerKod.has(k));
    const ayniVarlik = !!vn && x.varlik_norm === vn;
    if (x.durum === "aday" && !kaynaktan && !ayniVarlik) return null; // aday ders yalnızca kaynağına yakın işte
    let p = benzer(q, iz(x, dersMetni)) + (kaynaktan ? 0.2 : 0) + (ayniVarlik ? 0.2 : 0);
    p *= 0.6 + 0.4 * Math.max(0, Math.min(1, Number(x.guven) || 0));
    return { x, p, yakin: kaynaktan || ayniVarlik };
  }).filter((y: any) => y && y.p >= ESIK.ders).sort((a: any, b: any) => b.p - a.p).slice(0, 10).map((y: any) => ({ ...y.x, _puan: Math.round(y.p * 100) / 100, _yakin: y.yakin }));

  const kart = kartlar.map((k: any) => ({ k, p: benzer(q, iz(k, kartMetni)) }))
    .filter((y: any) => y.p >= ESIK.kart).sort((a: any, b: any) => b.p - a.p).slice(0, 4).map((y: any) => ({ ...y.k, _puan: Math.round(y.p * 100) / 100 }));

  const st = sR.map((s: any) => ({ s, p: benzer(q, iz(s, standartMetni)) })).sort((a: any, b: any) => b.p - a.p)[0];
  return { deneyim, ders, kart, standart: st && st.p >= ESIK.standart ? { ...st.s, _puan: Math.round(st.p * 100) / 100 } : null, gommeli: !!qG };
}

// ---------- motora giden bloklar ----------
const AYK = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
const tarihKisa = (s: string) => { const d = new Date(s); return isNaN(+d) ? "" : `${d.getUTCDate()} ${AYK[d.getUTCMonth()]}`; };
export function deneyimSatiri(d: any) {
  const p: string[] = [`[${d.akis_kod || "?"}] ${d.baslik || d.cumle}${d.varlik ? ` (${d.varlik}${d.created_at ? `, ${tarihKisa(d.created_at)}` : ""})` : ""}: ${(d.adimlar || []).length} adım`];
  const ek = (d.eklenen || []).slice(0, 3).map((e: any) => `"${e.ad}"${e.neden ? ` (${String(e.neden).slice(0, 120)})` : ""}`);
  if (ek.length) p.push(`sonradan eklenen: ${ek.join("; ")}`);
  const at = (d.atlanan || []).filter((a: any) => a.neden !== "dal" && a.neden !== "mukerrer").slice(0, 3).map((a: any) => `"${a.ad}"${a.neden ? ` (${a.neden === "varsayim_yanlis" ? "varsayım yanlıştı" : a.neden === "gerek_kalmadi" ? "gerek kalmadı" : a.neden})` : ""}`);
  if (at.length) p.push(`atlanan: ${at.join("; ")}`);
  const yv = (d.yanlis_varsayim || []).slice(0, 3).map((y: any) => y.soru || y.soru_kod);
  if (yv.length) p.push(`yanlış çıkan varsayım: ${yv.join("; ")}`);
  const bk = [...(d.bekleme || [])].sort((a: any, b: any) => b.saat - a.saat)[0];
  if (bk && bk.saat >= 48) p.push(`en uzun bekleyen: "${bk.ad}" ${Math.round(bk.saat / 24)} gün${bk.dis ? " (dış taraf)" : ""}`);
  const sn = Object.entries(d.sonradan || {}).slice(0, 2).map(([k, v]: any) => `${k}=${v?.cevap ?? v}`);
  if (sn.length) p.push(`sonradan belli olan: ${sn.join(", ")}`);
  return p.join(" · ");
}
export function dersSatiri(x: any) {
  const kanit = (x.kanit || []).map((k: any) => k.akis).filter(Boolean);
  const durum = x.durum === "kesin" ? `kesin, ${x.kanit_sayi} akış` : `aday, ${x.kanit_sayi} akış`;
  let etki = "";
  if (x.etki === "adim_ekle" && x.adim) etki = ` · etki: adım ekle "${x.adim.ad}" (tur_kod ${x.adim.tur_kod})`;
  else if (x.etki === "soru_sor" && x.soru) etki = ` · etki: soru sor [${x.soru.kod}] ${x.soru.soru || ""}`;
  else if (x.etki === "sure_uzat" && x.adim) etki = ` · etki: "${x.adim.ad || x.adim.tur_kod}" süresini ${x.adim.ek_gun} gün uzat`;
  else if (x.etki === "sira") etki = " · etki: sıra kuralı";
  return `[D${x.id}] (${durum}${kanit.length ? `: ${kanit.slice(0, 4).join(", ")}` : ""}) ${x.metin}${etki}`;
}
export const kartSatiri = (k: any) => `[K:${k.kod}] ${k.baslik}: ${k.kural}${k.sure ? ` · süre: ${k.sure}` : ""}${k.kim ? ` · kim: ${k.kim}` : ""}${(k.adimlar || []).length ? ` · tipik adımlar: ${k.adimlar.join("; ")}` : ""} (kaynak: ${k.kaynak_ad || k.kaynak_url})`;
export function standartBlok(s: any) {
  return [`[S:${s.kod}] ${s.ad}${s.aciklama ? ` · ${s.aciklama}` : ""}`, ...(s.adimlar || []).map((a: any) => `  ${a.kod}=${a.ad} · sahip: ${a.sahip}${a.bagimli?.length ? ` · bekler: ${a.bagimli.join(",")}` : ""}${a.kosul ? ` · yalnızca ${a.kosul.soru}=${a.kosul.deger} ise` : ""}`), ...((s.sorular || []).length ? [`  sorular: ${s.sorular.map((q: any) => `${q.kod} (${q.soru})`).join("; ")}`] : [])].join("\n");
}

// ---------- dayanak ve "Devir'in hatırladıkları" ----------
export function dayanaklar(x: any): string[] {
  const d = x?.dayanak;
  return (Array.isArray(d) ? d : d ? [d] : []).map((v: unknown) => String(v).trim().replace(/^\[|\]$/g, "")).filter(Boolean);
}
// tasla çıktısında ve akış kurulunca gösterilir; düz bir oturumun veremeyeceği bilgiler
export function hatirlatmaSatirlari(t: any, h: Hatira, sorular: any[], soruGerekce: Map<string, string>) {
  const L: string[] = [];
  const dersBy = new Map(h.ders.map((x: any) => [`D${x.id}`, x]));
  const kartBy = new Map(h.kart.map((k: any) => [`K:${k.kod}`, k]));
  const kullanilan = new Map<string, string[]>();
  for (const s of t.adimlar || []) for (const r of dayanaklar(s)) { const a = kullanilan.get(r) || []; a.push(`"${s.ad}"`); kullanilan.set(r, a); }
  const sorulan = new Set(sorular.map((q: any) => q.kod));
  for (const q of (t.sorular || []).filter((q: any) => sorulan.has(q.kod))) for (const r of dayanaklar(q)) { const a = kullanilan.get(r) || []; a.push(`[${q.kod}] sorusu`); kullanilan.set(r, a); }
  for (const [r, yer] of kullanilan) {
    const x: any = dersBy.get(r);
    if (x) { const kanit = (x.kanit || []).map((k: any) => k.akis).filter(Boolean); L.push(`${yer.join(", ")}: ${x.metin} (${x.durum === "kesin" ? "kanıtlı" : "aday ders"}, ${x.kanit_sayi} akış${kanit.length ? `: ${kanit.slice(0, 3).join(", ")}` : ""})`); continue; }
    const g: any = r.startsWith("G:") ? h.deneyim.find((d: any) => d.akis_kod === r.slice(2)) : null;
    if (g) {
      const ek = (g.eklenen || []).find((e: any) => yer.some((y) => kelimeBenzer(kokler(y), kokler(e.ad)) >= 0.5));
      L.push(ek ? `${yer.join(", ")}: ${g.akis_kod}${g.varlik ? ` (${g.varlik})` : ""} işinde sonradan eklenmişti; bu kez baştan planda.` : `${yer.join(", ")}: benzer geçmiş iş ${g.akis_kod}${g.varlik ? ` (${g.varlik})` : ""} esas alındı.`);
      continue;
    }
    const k: any = kartBy.get(r);
    if (k) L.push(`${yer.join(", ")}: ${k.kural}${k.sure ? ` (${k.sure})` : ""} · kaynak: ${k.kaynak_ad || k.kaynak_url}`);
  }
  for (const q of sorular) { const g = soruGerekce.get(q.kod); if (g) L.push(`[${q.kod}] sorusunu soruyorum: ${g}`); }
  if (h.deneyim.length && !L.length) L.push(`Benzer ${h.deneyim.length} geçmiş işe baktım (${h.deneyim.map((d: any) => d.akis_kod).filter(Boolean).join(", ")}); bu işe taşınacak bir sürpriz yok.`);
  else if (h.deneyim.length) L.push(`Dayandığım benzer geçmiş işler: ${h.deneyim.map((d: any) => `${d.akis_kod}${d.varlik ? ` (${d.varlik})` : ""}`).join(", ")}.`);
  return L;
}

// ---------- kesin derslerin uygulandığını garanti et ----------
export function derslerUygula(t: any, dersler: any[]) {
  const notlar: string[] = [];
  const adimlar: any[] = t.adimlar || (t.adimlar = []);
  const benzerAd = (a: string, b: string) => kelimeBenzer(kokler(a), kokler(b)) >= 0.6;
  const idsOf = (turlar: string[] = []) => adimlar.filter((s) => turlar.includes(s.tur_kod)).map((s) => s.id);
  for (const x of dersler) {
    if (x.durum !== "kesin") continue;
    if (x._puan != null && x._puan < ESIK.zorunlu && !x._yakin) continue; // zayıf eşleşmede (başka varlık, uzak iş) zorlanmaz, motorun takdirine kalır
    const ref = `D${x.id}`;
    if (x.etki === "adim_ekle" && x.adim?.ad) {
      const var0 = adimlar.find((s) => (x.adim.tur_kod && s.tur_kod === x.adim.tur_kod) || benzerAd(s.ad, x.adim.ad));
      if (var0) { if (!dayanaklar(var0).includes(ref)) var0.dayanak = [...dayanaklar(var0), ref]; continue; }
      const id = `ders-${x.id}`;
      const rol = (t.roller || []).find((r: any) => r.tip === (x.adim.sahip_tip === "dis" ? "dis" : x.adim.sahip_tip === "agent" ? "agent" : "insan")) || (t.roller || [])[0];
      adimlar.push({ id, tur_kod: x.adim.tur_kod || `ders-${x.id}`, ad: x.adim.ad, sahip_rol: rol ? rol.kod : "__sahip", kriter: x.adim.kriter || `${x.adim.ad} tamam`, sure_tahmin_gun: Number(x.adim.sure_tahmin_gun) || 1, bagimli: idsOf(x.adim.bagimli_tur), boyut: x.adim.boyut || "genel", dayanak: [ref] });
      for (const b of idsOf(x.adim.bekleyen_tur)) { const s = adimlar.find((y) => y.id === b); if (s && !(s.bagimli || []).includes(id)) s.bagimli = [...(s.bagimli || []), id]; }
      notlar.push(`"${x.adim.ad}" kanıtlı dersten eklendi (${ref}).`);
    } else if (x.etki === "soru_sor" && x.soru?.kod) {
      const sorular: any[] = t.sorular || (t.sorular = []);
      const q = sorular.find((y) => y.kod === x.soru.kod);
      if (q) { q.dayanak = [...dayanaklar(q), ref]; q.guven = Math.min(Number(q.guven) || 0.5, 0.3); q.etki = Math.max(Number(q.etki) || 0, 2); continue; }
      sorular.push({ kod: x.soru.kod, boyut: x.soru.boyut || "belirsizlik", soru: x.soru.soru || x.metin, neden: x.metin, tip: x.soru.tip || "secim", secenekler: x.soru.secenekler || [{ deger: "evet" }, { deger: "hayir" }], varsayilan: x.soru.varsayilan || "hayir", guven: 0.3, cikarilabilir: false, etki: 2, genel: false, kalici: false, ne_zaman: "simdi", dayanak: [ref] });
      notlar.push(`[${x.soru.kod}] sorusu kanıtlı dersten eklendi (${ref}).`);
    } else if (x.etki === "sure_uzat" && x.adim?.tur_kod && Number(x.adim.ek_gun) > 0) {
      const s = adimlar.find((y) => y.tur_kod === x.adim.tur_kod);
      if (s && !dayanaklar(s).includes(ref)) { s.sure_tahmin_gun = (Number(s.sure_tahmin_gun) || 1) + Number(x.adim.ek_gun); s.dayanak = [...dayanaklar(s), ref]; notlar.push(`"${s.ad}" süresi geçmiş beklemeye göre ${x.adim.ek_gun} gün uzatıldı (${ref}).`); }
    }
  }
  return notlar;
}

// ---------- 1.5.1 deneyim kaydı · 1.5.2 dersler ----------
export function atlamaNedeni(ozet: string) {
  const o = String(ozet || "");
  if (/bu dal seçilmedi|seçilmeyen dalda/.test(o)) return "dal";
  if (/mükerrer/.test(o)) return "mukerrer";
  if (/varsayım yanlış/.test(o)) return "varsayim_yanlis";
  if (/gerek kalmadı/.test(o)) return "gerek_kalmadi";
  return null;
}
// deneyimden belirlenimci ders adayları: sonradan eklenen adım, yanlış varsayım, büyük süre sapması
export function dersAdaylari(d: any) {
  const out: any[] = [];
  const yer = d.varlik ? `${d.varlik} işinde ` : "";
  for (const e of d.eklenen || []) {
    if (!e.ad) continue;
    out.push({ etki: "adim_ekle", metin: `"${e.ad}" adımı ${yer}baştan planlanmamış, sonradan eklendi${e.neden ? `: ${String(e.neden).slice(0, 200).replace(/[.\s]+$/, "")}` : ""}.`, adim: { ad: e.ad, tur_kod: e.tur_kod || null, sahip_tip: e.sahip_tip || "insan", kriter: e.kriter || null, sure_tahmin_gun: e.sure_tahmin_gun || 1, boyut: e.boyut || null, bagimli_tur: e.bagimli_tur || [], bekleyen_tur: e.bekleyen_tur || [] } });
  }
  for (const y of d.yanlis_varsayim || []) {
    if (!y.soru_kod) continue;
    out.push({ etki: "soru_sor", metin: `"${y.soru || y.soru_kod}" sorusu sorulmadan varsayıldı ve yanlış çıktı; benzer işlerde sorulmalı.`, soru: { kod: y.soru_kod, soru: y.soru || null, boyut: y.boyut || null } });
  }
  for (const s of d.sapma || []) {
    const t = Number(s.tahmin) || 0, g = Number(s.gercek) || 0;
    if (!s.tur_kod || g < 2 * t || g - t < 2) continue;
    out.push({ etki: "sure_uzat", metin: `"${s.ad}" ${t} gün planlandı, ${g} gün sürdü.`, adim: { ad: s.ad, tur_kod: s.tur_kod, ek_gun: Math.round(g - t) } });
  }
  return out.slice(0, 5);
}

export const DERS_SISTEM = `Sen Devir'in ders yazarısın. Kapanan bir işin deneyim özetinden çıkan ders adaylarını, benzer bir sonraki işte işe yarayacak biçimde yeniden yazarsın.
- metin: tek cümle, genelleştirilmiş ve uygulanabilir (ör. "Banka entegrasyonlarında bilgi güvenliği ekibi canlıya çıkıştan önce güncel sızma testi raporu istiyor."). Kişisel ve finansal ayrıntı yazma.
- kapsam: varlik (yalnızca bu şirket, kişi ya da projeye özgü), ekip (bu ekibin benzer işlerinde geçerli) ya da alan (bu tür işlerin genelinde geçerli bir kural).
- tetik: dersin geçerli olduğu işleri tanıtan 3–6 anahtar kelime (Türkçe, yalın).
- gecerli: aday gerçekten ders değilse (tek seferlik kaza, kişisel durum) false.
Türkçe yaz.`;
export const DERS_ARACI: LlmTool = {
  name: "ders_yaz",
  description: "Ders adaylarını yeniden yazar.",
  input_schema: { type: "object", required: ["dersler"], properties: { dersler: { type: "array", items: { type: "object", required: ["i", "metin", "kapsam", "tetik", "gecerli"], properties: { i: { type: "integer" }, metin: { type: "string" }, kapsam: { type: "string", enum: ["varlik", "ekip", "alan"] }, tetik: { type: "array", items: { type: "string" } }, gecerli: { type: "boolean" } } } } } },
};

function ayniDers(x: any, y: any) {
  if (x.etki !== y.etki) return false;
  if (x.etki === "adim_ekle" || x.etki === "sure_uzat") {
    if (x.adim?.tur_kod && y.adim?.tur_kod && x.adim.tur_kod === y.adim.tur_kod) return true;
    return kelimeBenzer(kokler(x.adim?.ad), kokler(y.adim?.ad)) >= 0.6;
  }
  if (x.etki === "soru_sor") return !!x.soru?.kod && x.soru.kod === y.soru?.kod;
  return kelimeBenzer(kokler(x.metin), kokler(y.metin)) >= 0.7;
}

// akış kapanınca: deneyim satırı, uygulanan derslerin güveni, yeni dersler
export async function deneyimKaydet(ctx: BCtx, d: any, uygulanan: { id: number; tur_kod?: string | null }[] = []) {
  const notlar: string[] = [];
  const satir = { ...d, ws_id: ctx.ws.id, varlik_norm: d.varlik ? vnorm(d.varlik) : null, uygulanan_ders: uygulanan, metin: deneyimMetni(d) };
  if (ctx.gom) { try { satir.gomme = (await ctx.gom([satir.metin]))[0] || null; } catch (e) { console.warn("deneyim gömmesi alınamadı:", (e as Error).message); } }
  const [kayit] = await ctx.db.insert("deneyim", [satir]);
  // uygulanan derslerin güveni: ilgili adım yapıldıysa artar, gereksiz diye atlandıysa düşer
  for (const u of uygulanan) {
    const x = await ctx.db.one("ders", { id: u.id, ws_id: ctx.ws.id });
    if (!x) continue;
    const s = (d.adimlar || []).find((a: any) => u.tur_kod && a.tur_kod === u.tur_kod);
    const at = (d.atlanan || []).find((a: any) => u.tur_kod && a.tur_kod === u.tur_kod);
    if (at && at.neden !== "dal" && at.neden !== "mukerrer") {
      const guven = Math.max(0, (Number(x.guven) || 0.5) - 0.2);
      await ctx.db.update("ders", { id: x.id }, { atlandi: (x.atlandi || 0) + 1, guven, durum: guven < 0.25 ? "zayif" : x.durum, updated_at: new Date(ctx.now).toISOString() });
      notlar.push(`D${x.id} dersi bu işte gereksiz çıktı; güveni düştü${guven < 0.25 ? " ve artık önerilmeyecek" : ""}.`);
    } else if (s && s.durum === "tamam") {
      // ders uygulandı ve adım gerçekten yapıldı: ikinci bir akışın doğrulaması sayılır
      const kanitlar = (x.kanit || []).some((k: any) => k.akis === d.akis_kod) ? x.kanit || [] : [...(x.kanit || []), { akis: d.akis_kod || null, tarih: new Date(ctx.now).toISOString().slice(0, 10), tur: "uygulandi" }];
      const durum = x.durum === "aday" && kanitlar.length >= 2 ? "kesin" : x.durum;
      await ctx.db.update("ders", { id: x.id }, { uygulandi: (x.uygulandi || 0) + 1, kanit: kanitlar, kanit_sayi: kanitlar.length, durum, guven: Math.min(1, (Number(x.guven) || 0.5) + 0.1), updated_at: new Date(ctx.now).toISOString() });
      if (durum !== x.durum) notlar.push(`D${x.id} dersi bu işte de doğrulandı; artık kanıtlı (${kanitlar.length} akış): ${x.metin}`);
    }
  }
  // yeni dersler
  let adaylar = dersAdaylari(d);
  if (adaylar.length && ctx.llm) {
    try {
      const r = await ctx.llm({ system: DERS_SISTEM, user: `İş: ${d.baslik || ""}\nCümle: ${d.cumle || "-"}\nVarlık: ${d.varlik || "-"} (ilişki: ${d.iliski || "-"})\nDers adayları:\n${adaylar.map((a, i) => `${i}. [${a.etki}] ${a.metin}`).join("\n")}`, tool: DERS_ARACI, model: ctx.modeller?.hizli, max_tokens: 1200 });
      const yaz = new Map<number, any>((r.input?.dersler || []).map((x: any) => [Number(x.i), x]));
      adaylar = adaylar.map((a, i) => { const y = yaz.get(i); return y ? (y.gecerli === false ? null : { ...a, metin: String(y.metin || a.metin), kapsam: ["varlik", "ekip", "alan"].includes(y.kapsam) ? y.kapsam : "ekip", tetik: (y.tetik || []).map(String).slice(0, 8) }) : a; }).filter(Boolean) as any[];
    } catch (e) { console.warn("ders yazarı çalışmadı, ham dersler kullanıldı:", (e as Error).message); }
  }
  if (!adaylar.length) return { deneyim: kayit, notlar, yeni: 0, guclenen: 0 };
  const mevcut = await ctx.db.many("ders", { ws_id: ctx.ws.id }, "id");
  let yeni = 0, guclenen = 0;
  const kanit = { akis: d.akis_kod || null, tarih: new Date(ctx.now).toISOString().slice(0, 10) };
  const vn = d.varlik ? vnorm(d.varlik) : null;
  for (const a of adaylar) {
    const es = mevcut.find((x: any) => x.durum !== "reddedildi" && ayniDers(x, a) && (x.kapsam !== "varlik" || x.varlik_norm === vn));
    if (es) {
      if ((es.kanit || []).some((k: any) => k.akis && k.akis === kanit.akis)) continue;
      const kanitlar = [...(es.kanit || []), kanit];
      const durum = es.durum === "aday" && kanitlar.length >= 2 ? "kesin" : es.durum === "zayif" ? "aday" : es.durum;
      await ctx.db.update("ders", { id: es.id }, { kanit: kanitlar, kanit_sayi: kanitlar.length, guven: Math.min(1, (Number(es.guven) || 0.5) + 0.15), durum, updated_at: new Date(ctx.now).toISOString() });
      Object.assign(es, { kanit: kanitlar, kanit_sayi: kanitlar.length, durum });
      guclenen++;
      notlar.push(`D${es.id} dersi güçlendi (${kanitlar.length} akış${durum === "kesin" && es.durum !== "kesin" ? "; artık kanıtlı" : ""}): ${es.metin}`);
      continue;
    }
    const row: any = { ws_id: ctx.ws.id, metin: a.metin, etki: a.etki, kapsam: a.kapsam || "ekip", varlik_norm: vn, tetik: a.tetik?.length ? a.tetik : kokler(`${d.baslik || ""} ${d.cumle || ""}`).slice(0, 8), adim: a.adim || null, soru: a.soru || null, kanit: [kanit], kanit_sayi: 1, guven: 0.5, durum: "aday" };
    if (ctx.gom) { try { row.gomme = (await ctx.gom([dersMetni(row)]))[0] || null; } catch { /* gömmesiz kalır; getirmede kelime benzerliği kullanılır */ } }
    const [x] = await ctx.db.insert("ders", [row]);
    mevcut.push(x);
    yeni++;
    notlar.push(`Yeni aday ders D${x.id}: ${x.metin} (ikinci bir akış doğrularsa ya da onaylarsan kanıtlı olur)`);
  }
  return { deneyim: kayit, notlar, yeni, guclenen };
}

// eski sablon.ogrenimler kaydını deneyim biçimine çevirir (tek seferlik taşıma)
export function ogrenimdenDeneyim(o: any, isTuru: string) {
  const atl = (o.atlanan || []).map((a: any) => (typeof a === "string" ? { ad: a, neden: null } : a));
  return {
    akis_id: null, akis_kod: o.akis || null, is_turu: isTuru, cumle: null, baslik: o.not ? String(o.not).slice(0, 140) : `${isTuru}${o.baglam?.musteri ? ` · ${o.baglam.musteri}` : ""}`,
    varlik: o.baglam?.musteri || null, iliski: null, adimlar: [], eklenen: (o.eklenen || []).map((e: any) => ({ ...e, sahip: undefined })), atlanan: atl, yanlis_varsayim: [], soru_etki: [],
    sonradan: {}, bekleme: o.bekleme || [], sapma: o.sapma || [], isabet: o.isabet ?? null, kaynak: o.tohum ? "tohum" : "tasima",
  };
}
