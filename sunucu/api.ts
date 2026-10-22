// Devir JSON uçları (Faz 2 arayüzü için). Tasarımdan bağımsız: veri, türetilmiş ölçüler ve otomatik özet cümleleri.
// Okuma doğrudan çekirdekteki timeline/plan/metrics ile; yazma MCP araçlarıyla aynı mantıktan (callTool) geçer.
import {
  callTool, type DB, type Ctx, DONE, LBL, HOUR, fmtD, fmtMs, norm, adEslesir, DevirHata, kimlikBagla, kisiCoz, kisiAl, kisiAlani, olayYaz, isDis, stepInScope, flowInScope, akisKapsami, metrics, getAkis, loadFlow,
  kararlar, ciktilar, acikIsler, fixStep, kararAdimi, altGruplar, altAdimi, chatLinks, todayIst, eod,
} from "./core.ts";
import { yuklemeIste, dosyaCiktilari, indir, sil as dosyaSil, akisDosyalari, dosyaIdOf, type Depo } from "./dosya.ts";
import type { LlmFn } from "./llm.ts";
import type { GomFn } from "./bellek.ts";
import { ANAHTAR_OMRU } from "./hesap.ts";
import { belirtecAc, belirtecAlanlari, belirtecBul, yeniBelirtec } from "./baglanti.ts";
import { akisKarari, gecmisYukle } from "./plan.ts";

type Ek = { llm?: LlmFn; gom?: GomFn; modeller?: { taslak?: string; hizli?: string } };
type Parca = { tur: "metin" | "kisi" | "adim" | "akis" | "sure" | "tarih" | "uyari"; metin: string; ref?: Record<string, unknown> };

export class ApiHata extends Error { constructor(public durum: number, m: string) { super(m); } }
const saat = (ms: number | null | undefined) => (ms == null ? null : Math.round((ms / HOUR) * 10) / 10);
const iso = (ms: number | null | undefined) => (ms == null || !isFinite(ms) ? null : new Date(ms).toISOString());
const gunOf = (ms: number | null | undefined) => (ms == null || !isFinite(ms) ? null : todayIst(ms));
const durKisa = (ms: number) => { const h = ms / HOUR; if (h < 1) return `${Math.max(1, Math.round(ms / 6e4))} dk`; if (h < 24) return `${Math.round(h)} sa`; const d = Math.round(h / 24); return `${d} gün`; };
const yaz = (p: Parca[]) => p.map((x) => x.metin).join("");

// ---------- görünümler ----------
function adimV(akis: any, s: any, m: any, steps: any[], opts: { dis?: boolean } = {}) {
  const r = m.tl.get(s.no) || { bekleme: 0, aktif: 0, engel: 0, simdi: 0 };
  const ef = m.pl.EF.get(s.no);
  const grup = altAdimi(akis, s.no);
  const v: any = {
    no: s.no, ad: s.ad, kisa_ad: akis.baglam?.kisa_adlar?.[String(s.no)] || null, sahip: s.sahip, sahip_kisi_id: s.sahip_kisi_id || null, sahip_tip: s.sahip_tip, arac: s.arac || null, durum: s.durum, durum_etiket: LBL[s.durum],
    aciklama: s.aciklama || null, kriter: s.kriter, beklenen_cikti: s.beklenen_cikti || null, karar_kriteri: s.karar_kriteri || null,
    karar_adimi: (akis.kurallar || {}).karar_insanda !== false && kararAdimi(s),
    son_tarih: s.son_tarih || null, sure_tahmin_gun: s.sure_tahmin_gun != null ? Number(s.sure_tahmin_gun) : null,
    en_erken_bitis: DONE(s) ? null : iso(ef), gec_risk: !DONE(s) && !!s.son_tarih && ef != null && ef > eod(s.son_tarih),
    kritik: !DONE(s) && m.pl.chain.includes(s.no),
    bagimli: s.bagimli, bekleyenler: steps.filter((x: any) => x.bagimli.includes(s.no)).map((x: any) => x.no),
    bekleme_saat: saat(r.simdi), toplam_bekleme_saat: saat(r.bekleme + r.engel), aktif_saat: saat(r.aktif),
    karar: akis.baglam?.kararlar?.[String(s.no)] || null,
    engel: s.engel || null, engel_kisa: (s.engel && akis.baglam?.engel_kisa?.[String(s.no)]) || null, ilerleme: s.ilerleme || null, durum_at: s.durum_at,
    kosul: s.kosul || null, cevap_soru: s.cevap_soru || null, capa_soru: s.capa_soru || null, tarih_sabit: !!s.tarih_sabit, capa_tarih: s.capa_tarih || null,
    kaynak: s.kaynak, tur_kod: s.tur_kod || null, cikti_sayisi: (s.ciktilar || []).length,
    tekrar: grup ? { grup: grup.id, kalem_turu: grup.kalem_turu, kalemler: grup.kalemler.map((k) => ({ ad: k.ad, akis: k.kod })) } : null,
  };
  if (!DONE(s) && !opts.dis) v.linkler = chatLinks(akis, s);
  return v;
}

function akisOzeti(akis: any, steps: any[], m: any, now: number): Parca[] {
  const p: Parca[] = [];
  const A = (metin: string, tur: Parca["tur"] = "metin", ref?: any) => p.push({ tur, metin, ...(ref ? { ref } : {}) });
  if (akis.durum !== "aktif") { A(`${fmtMs(Date.parse(akis.kapandi_at || akis.created_at))} tarihinde kapandı; `, "tarih"); A(`${durKisa(m.sure)} sürdü.`, "sure"); return p; }
  const tamam = steps.filter(DONE).length;
  A(`${steps.length} adımdan ${tamam} tamam. `);
  const engelli = steps.filter((s: any) => s.durum === "engelli").sort((a: any, b: any) => m.tl.get(b.no).simdi - m.tl.get(a.no).simdi)[0];
  const bekleyen = steps.filter((s: any) => s.durum === "hazir").sort((a: any, b: any) => (m.pl.chain.includes(b.no) ? 1 : 0) - (m.pl.chain.includes(a.no) ? 1 : 0) || m.tl.get(b.no).simdi - m.tl.get(a.no).simdi)[0];
  const suren = steps.find((s: any) => s.durum === "suruyor");
  if (engelli) { A(`${engelli.no}. ${engelli.ad}`, "adim", { no: engelli.no }); A(` engelli`); if (engelli.engel) A(`: ${engelli.engel}`); A(". "); }
  if (bekleyen) { A("Sırası gelen: "); A(`${bekleyen.no}. ${bekleyen.ad}`, "adim", { no: bekleyen.no }); A(" ("); A(bekleyen.sahip, "kisi", { tip: bekleyen.sahip_tip }); A(")"); const w = m.tl.get(bekleyen.no).simdi; if (w > HOUR) { A(", "); A(durKisa(w), "sure"); A(" bekliyor"); } A(". "); }
  else if (suren && !engelli) { A("Şu an "); A(`${suren.no}. ${suren.ad}`, "adim", { no: suren.no }); A(" sürüyor ("); A(suren.sahip, "kisi", { tip: suren.sahip_tip }); A("). "); }
  if (akis.hedef_tarih && m.pay != null) {
    A("Hedef "); A(fmtD(akis.hedef_tarih), "tarih", { tarih: akis.hedef_tarih });
    if (m.pay >= 0) { A(", "); A(durKisa(m.pay), "sure"); A(" pay var."); }
    else { A("; bu gidişle "); A(`${durKisa(-m.pay)} gecikme riski`, "uyari"); A("."); }
  }
  if (p.length && p[p.length - 1].metin.endsWith(" ")) p[p.length - 1].metin = p[p.length - 1].metin.trimEnd();
  return p;
}

/** Bu adımı geçişli olarak bekleyen açık adım sayısı (§9-5). */
function tuttugu(steps: any[], no: number): number {
  const g = new Set<number>(), q = [no];
  while (q.length) { const x = q.pop()!; for (const b of steps) if (b.bagimli.includes(x) && !g.has(b.no) && !DONE(b)) { g.add(b.no); q.push(b.no); } }
  return g.size;
}

function akisKart(akis: any, steps: any[], events: any[], now: number, ctx: Ctx, gecmis?: Map<string, number>) {
  const m = metrics(akis, steps, events, now);
  const vis = steps.filter((s: any) => stepInScope(ctx, s));
  // P1-A (MK-5, MK-8): bitiş aralığı ve karar özeti; dış kişide başka adımların adı yok
  const { bitis: b, karar_ozeti } = akisKarari(akis, steps, events, now, gecmis, { dis: isDis(ctx), vis });
  const sira = vis.filter((s: any) => s.durum === "hazir" || s.durum === "engelli").map((s: any) => ({ no: s.no, ad: s.ad, kisa_ad: akis.baglam?.kisa_adlar?.[String(s.no)] || null, sahip: s.sahip, sahip_tip: s.sahip_tip, durum: s.durum, bekleme_saat: saat(m.tl.get(s.no)!.simdi), kritik: m.pl.chain.includes(s.no), tuttugu: tuttugu(steps, s.no), engel: s.engel || null, engel_kisa: (s.engel && akis.baglam?.engel_kisa?.[String(s.no)]) || null })).sort((a: any, b: any) => (b.bekleme_saat || 0) - (a.bekleme_saat || 0));
  const parca = akisOzeti(akis, isDis(ctx) ? vis : steps, m, now);
  const son = events.length ? events[events.length - 1].created_at : akis.created_at;
  return {
    kod: akis.kisa_kod, baslik: akis.baslik, kisa_ad: akis.baglam?.kisa_ad || null, durum: akis.durum, varlik: akis.baglam?.musteri || null, hedef_tarih: akis.hedef_tarih || null,
    en_erken_bitis: gunOf(m.pl.end), pay_saat: saat(m.pay), risk: m.pay != null && m.pay < 0,
    bitis: { en_erken: b.en_erken, aralik: b.aralik, guven: b.guven, eksik_sure: b.eksik_sure }, karar_ozeti,
    ilerleme: { tamam: steps.filter(DONE).length, toplam: steps.length, suruyor: steps.filter((s: any) => s.durum === "suruyor").length, engelli: steps.filter((s: any) => s.durum === "engelli").length },
    sira, suruyor: vis.filter((s: any) => s.durum === "suruyor").map((s: any) => ({ no: s.no, ad: s.ad, kisa_ad: akis.baglam?.kisa_adlar?.[String(s.no)] || null, sahip: s.sahip, sahip_tip: s.sahip_tip })),
    kritik_bekleme_saat: saat(m.kritikBekleme), toplam_bekleme_saat: saat(m.bekleme),
    ust: akis.baglam?.ust_akis ? { akis: akis.baglam.ust_kod, kalem: akis.baglam.kalem } : null,
    tekrar: altGruplar(akis).map((g) => ({ grup: g.id, kalem_turu: g.kalem_turu, kalem_sayisi: g.kalemler.length, adimlar: g.adimlar, ilerleme: steps.find((s: any) => g.adimlar.includes(s.no) && !DONE(s))?.ilerleme || null })),
    olusturuldu: akis.created_at, son_hareket: son, kapandi_at: akis.kapandi_at || null,
    ozet: yaz(parca), ozet_parcalar: parca,
  };
}

async function akislarV(ctx: Ctx, durum: string, altlar = false) {
  const where: Record<string, unknown> = { sahip_id: ctx.ws.id };
  if (durum !== "hepsi") where.durum = durum;
  let flows = await ctx.db.many("akis", where, "created_at");
  if (!altlar) flows = flows.filter((f: any) => !f.baglam?.ust_akis);
  const ids = flows.map((f: any) => f.id);
  const allSteps = ids.length ? (await ctx.db.many("adim", { akis_id: ids }, "no")).map(fixStep) : [];
  const allEv = ids.length ? await ctx.db.many("olay", { akis_id: ids }, "id") : [];
  const gecmis = ids.length ? await gecmisYukle(ctx) : undefined;
  const out: any[] = [];
  for (const f of flows) {
    const steps = allSteps.filter((s: any) => s.akis_id === f.id);
    if (!flowInScope(ctx, f, steps)) continue;
    out.push(akisKart(f, steps, allEv.filter((e: any) => e.akis_id === f.id && e.tip !== "okuma"), ctx.now, ctx, gecmis));
  }
  // önce riskli ve aktif, sonra en az pay, sonra son hareket
  out.sort((a, b) => (a.durum === "aktif" ? 0 : 1) - (b.durum === "aktif" ? 0 : 1) || (b.risk ? 1 : 0) - (a.risk ? 1 : 0) || (a.pay_saat ?? Infinity) - (b.pay_saat ?? Infinity) || Date.parse(b.son_hareket) - Date.parse(a.son_hareket));
  return out;
}

const TASLAK_OMRU = 7 * 24 * HOUR;
async function taslaklarV(ctx: Ctx) {
  if (isDis(ctx)) return [];
  // 7 günden eski açık taslak listeden düşer (P1-B); kodla açılabilir, kurulabilir ya da iptal edilebilir
  const t = (await ctx.db.many("taslak", { ws_id: ctx.ws.id, durum: "acik" }, "created_at")).filter((x: any) => ctx.now - Date.parse(x.created_at) < TASLAK_OMRU);
  return t.reverse().slice(0, 30).map((x: any) => ({
    kod: x.kisa_kod, cumle: x.cumle, baslik: x.taslak?.baslik || null, varlik: x.baglam?.musteri || x.taslak?.anahtar_varlik?.ad || null, is_turu: x.is_turu_ad || x.is_turu || null,
    soru_sayisi: (x.sorular?.secilen || []).length, adim_sayisi: (x.taslak?.adimlar || []).length, olusturuldu: x.created_at,
  }));
}

async function anaV(ctx: Ctx) {
  const akislar = await akislarV(ctx, "aktif");
  const ben = norm(ctx.key.kisi);
  // akış kapsamlı ekip üyesi (0.11.0): yalnız kartı görünen akışlar (alt akışlar üstüyle)
  const gorunen = new Set(akislar.map((k: any) => k.kod));
  const flows = (await ctx.db.many("akis", { sahip_id: ctx.ws.id, durum: "aktif" }, "created_at")).filter((f: any) => !akisKapsami(ctx) || gorunen.has(f.kisa_kod) || gorunen.has(f.baglam?.ust_kod));
  const ids = flows.map((f: any) => f.id);
  const steps = ids.length ? (await ctx.db.many("adim", { akis_id: ids, durum: ["hazir", "engelli", "suruyor"] }, "no")).map(fixStep) : [];
  const fBy = new Map(flows.map((f: any) => [f.id, f]));
  const kartBy = new Map(akislar.map((k: any) => [k.kod, k]));
  const benim = steps.filter((s: any) => (s.sahip_tip === "insan" || s.sahip_tip === "dis") && norm(s.sahip).includes(ben) && !altAdimi(fBy.get(s.akis_id), s.no)).map((s: any) => {
    const f: any = fBy.get(s.akis_id);
    const k: any = kartBy.get(f.kisa_kod) || (f.baglam?.ust_kod ? kartBy.get(f.baglam.ust_kod) : null);
    const bek = k?.sira?.find((x: any) => x.no === s.no)?.bekleme_saat ?? null;
    return { akis: f.kisa_kod, akis_baslik: f.baslik, no: s.no, ad: s.ad, durum: s.durum, engel: s.engel || null, son_tarih: s.son_tarih || null, bekleme_saat: bek, karar_adimi: kararAdimi(s), linkler: chatLinks(f, s) };
  }).sort((a: any, b: any) => (a.son_tarih || "9999") .localeCompare(b.son_tarih || "9999") || (b.bekleme_saat || 0) - (a.bekleme_saat || 0));
  const risk = akislar.filter((k: any) => k.risk);
  const p: Parca[] = [];
  const A = (metin: string, tur: Parca["tur"] = "metin", ref?: any) => p.push({ tur, metin, ...(ref ? { ref } : {}) });
  const hazir = benim.filter((x: any) => x.durum !== "suruyor");
  if (hazir.length) {
    A(`Senden beklenen ${hazir.length} iş var. Önce: `); const x = hazir[0]; A(x.ad, "adim", { akis: x.akis, no: x.no }); A(" ("); A(x.akis_baslik, "akis", { akis: x.akis });
    if (x.son_tarih) { A(", son "); A(fmtD(x.son_tarih), "tarih", { tarih: x.son_tarih }); } A("). ");
  } else if (benim.length) { A(`Senden beklenen yeni iş yok; ${benim.length} işin sürüyor. `); }
  else A("Şu an senden beklenen iş yok. ");
  if (risk.length) { A(`${risk.length} akışta `); A("hedef riski", "uyari"); A(" var: "); risk.slice(0, 2).forEach((k: any, i: number) => { if (i) A(", "); A(k.baslik, "akis", { akis: k.kod }); }); A("."); }
  else if (akislar.length) A(`${akislar.length} aktif akışın hepsi hedefinde.`);
  if (p.length) p[p.length - 1].metin = p[p.length - 1].metin.trimEnd();
  return { kim: ctx.key.kisi, rol: ctx.key.rol, bugun: todayIst(ctx.now), ozet: yaz(p), ozet_parcalar: p, benim, akislar, taslaklar: await taslaklarV(ctx) };
}

async function akisV(ctx: Ctx, kod: string) {
  const akis = await getAkis(ctx, kod);
  const { steps, events } = await loadFlow(ctx, akis);
  const ev = events.filter((e: any) => e.tip !== "okuma");
  const m = metrics(akis, steps, ev, ctx.now);
  const gecmis = await gecmisYukle(ctx);
  const kart = akisKart(akis, steps, ev, ctx.now, ctx, gecmis);
  const dis = isDis(ctx);
  const vis = steps.filter((s: any) => stepInScope(ctx, s));
  const sahipler = new Map<string, any>();
  for (const s of vis) {
    const k = s.sahip_kisi_id || `${s.sahip_tip}|${norm(s.sahip)}`;
    const o = sahipler.get(k) || { ad: s.sahip, kisi_id: s.sahip_kisi_id || null, tip: s.sahip_tip, adimlar: [], acik: 0, bekleyen_saat: 0, siradaki: null };
    o.adimlar.push(s.no);
    if (!DONE(s)) o.acik++;
    if (s.durum === "hazir" || s.durum === "engelli") { o.bekleyen_saat = Math.round((o.bekleyen_saat + (m.tl.get(s.no)!.simdi / HOUR)) * 10) / 10; if (o.siradaki == null) o.siradaki = s.no; }
    sahipler.set(k, o);
  }
  const out: any = {
    akis: { ...kart, amac: akis.amac || null, iliski: akis.baglam?.iliski || null, kurallar: akis.kurallar || {} },
    olcu: { sure_saat: saat(m.sure), aktif_saat: saat(m.aktif), bekleme_saat: saat(m.bekleme), kritik_bekleme_saat: saat(m.kritikBekleme), belirsiz_saat: saat(m.belirsiz), verim: m.verim != null ? Math.round(m.verim * 100) / 100 : null, paralel: Math.round(m.paralel * 10) / 10, en_erken_bitis: gunOf(m.pl.end), pay_saat: saat(m.pay) },
    kritik_yol: dis ? [] : m.pl.chain,
    adimlar: vis.map((s: any) => adimV(akis, s, m, steps, { dis })),
    sahipler: [...sahipler.values()],
    acik_sorular: dis ? [] : Object.entries<any>(akis.baglam?.bekleyen || {}).map(([k, b]) => ({ kod: k, soru: b.soru, kisa: b.kisa || null, tip: b.tip, secenekler: b.secenekler || null, adim_no: b.adim_no || null })),
    gizli_adim_sayisi: steps.length - vis.length,
  };
  if (!dis) {
    // "bu tarih neden" paneli: varsayımlar, kişi yükü, adım başına süre kaynağı ve üst ucu belirleyen zincir
    out.bitis = akisKarari(akis, steps, ev, ctx.now, gecmis).bitis;
    out.kararlar = akis.baglam?.musteri ? (await kararlar(ctx, akis.baglam.musteri)).map(kararV) : [];
    out.acik_isler = akis.baglam?.musteri ? (await acikIsler(ctx, akis.baglam.musteri)).filter((x: any) => x.akis_id !== akis.id).map((x: any) => ({ akis: x.akis_kod, no: x.no, ad: x.ad })) : [];
    out.katilimcilar = (await ctx.db.many("katilimci", { akis_id: akis.id }, "created_at")).map((k: any) => katilimciV(k, null));
    out.tekrar = await tekrarV(ctx, akis, steps);
    // kapanış (0.10.0, §9-10): değerlendirme olay verisinden; devredilen = ertelenen açık işler
    const kap = [...ev].reverse().find((e: any) => e.tip === "akis_kapandi");
    out.kapanis = kap ? { degerlendirme: kap.veri?.degerlendirme || null, kim: kap.kim, kim_tip: kap.kim_tip, arac: kap.arac || null, zaman: kap.created_at, devredilen: steps.filter((s: any) => s.durum === "ertelendi").length } : null;
    out.olaylar = ev.slice(-60).reverse().map(olayV);
    // 0.10.0: adım başına ilk okuma (galakside üyenin yola çıkış anı, §4 t0)
    const ilk = new Map<number, any>(); for (const e of events) if (e.tip === "okuma" && e.adim_no != null && !ilk.has(e.adim_no)) ilk.set(e.adim_no, e);
    out.ilk_okumalar = [...ilk.values()].map((e: any) => ({ adim_no: e.adim_no, zaman: e.created_at, kim: e.kim, kim_tip: e.kim_tip, arac: e.arac || null }));
    const ht = akis.taslak_id ? await ctx.db.one("taslak", { id: akis.taslak_id }) : null;
    out.hatirlananlar = ht?.taslak?._hatira?.satirlar?.slice(0, 8) || [];
  } else out.olaylar = ev.filter((e: any) => e.adim_no != null && vis.some((s: any) => s.no === e.adim_no)).slice(-30).reverse().map(olayV);
  return out;
}

async function tekrarV(ctx: Ctx, akis: any, steps: any[]) {
  const out: any[] = [];
  for (const g of altGruplar(akis)) {
    if (!g.kalemler.length) { out.push({ grup: g.id, kalem_turu: g.kalem_turu, adimlar: g.adimlar, kalemler: [] }); continue; }
    const ids = g.kalemler.map((k) => k.akis_id);
    const flows = await ctx.db.many("akis", { id: ids }, "created_at");
    const cs = (await ctx.db.many("adim", { akis_id: ids }, "no")).map(fixStep);
    out.push({
      grup: g.id, kalem_turu: g.kalem_turu, adimlar: g.adimlar,
      kalemler: g.kalemler.map((k) => {
        const f: any = flows.find((x: any) => x.id === k.akis_id);
        const ks = cs.filter((c: any) => c.akis_id === k.akis_id);
        const acik = ks.find((c: any) => !DONE(c));
        const ustNo = acik ? Number(f?.baglam?.ust_harita?.[String(acik.no)]) || null : null;
        return { ad: k.ad, akis: k.kod, durum: f?.durum || null, bitti: !acik, asama: acik ? { ust_no: ustNo, no: acik.no, ad: acik.ad, durum: acik.durum, engel: acik.engel || null } : null, adimlar: ks.map((c: any) => ({ no: c.no, ust_no: Number(f?.baglam?.ust_harita?.[String(c.no)]) || null, durum: c.durum })) };
      }),
    });
  }
  return out;
}

const kararV = (k: any) => ({ id: k.id, varlik: k.varlik, karar: k.karar, kisa: k.kisa || null, kapsam: k.kapsam || null, istisna: k.istisna || null, kim: k.kim || null, konu: k.konu || null, tarih: k.created_at, durum: k.durum });
// kanal (0.13.0): kaydın geldiği yol (mcp, oturum, anahtar, baglanti). Boşsa kimliği doğrulanmamış eski kayıttır.
const olayV = (e: any) => ({ id: e.id, zaman: e.created_at, kim: e.kim, kim_tip: e.kim_tip, arac: e.arac || null, kanal: e.kanal || e.veri?.kanal_kayit || null, tip: e.veri?.tur || e.tip, adim_no: e.adim_no, ozet: e.ozet, ...(e.veri?.to ? { durum: e.veri.to } : {}) });
const kisiV = (k: any) => ({ id: k.id, ad: k.ad, tip: k.tip });
export const POLITIKA_VARSAYILAN = { sahip: "insan", ekip: "insan", dis: "beyan" };
const politikaV = (ws: any) => ({ agent_karari: { ...POLITIKA_VARSAYILAN, ...(ws?.politika?.agent_karari || {}) } });
const katilimciV = (k: any, base: string | null, belirtec?: string | null, baslik?: string) => ({ id: k.id, kisi_id: k.kisi_id || null, ad: k.ad, rol: k.rol || null, iletisim: k.iletisim || null, olusturuldu: k.created_at, ...(base ? linkV(base, k, belirtec, baslik) : {}) });
function linkV(base: string, k: any, belirtec: string | null | undefined, baslik?: string) {
  if (!belirtec) return { link: null, whatsapp: null, mesaj: null }; // iptal ya da çözülemeyen şifreli belirteç: sahip yeniler
  // belirteç # parçasında (N-3): tarayıcı onu sunucuya göndermez, Workers loglarına düşmez
  const link = `${base}/l#${belirtec}`;
  const mesaj = `Merhaba ${k.ad.replace(/\s*\(.*\)$/, "")}, ${baslik ? `${baslik} için ` : ""}senden beklenen adımlar burada: ${link}`;
  return { link, mesaj, whatsapp: `https://wa.me/?text=${encodeURIComponent(mesaj)}` };
}

/**
 * Dış bağlantının süresi (P1-C, plan v2: PIN yok, akış kapanınca 30 gün). Açık akışta süresiz; kapanan akışta
 * kapanıştan 30 gün sonra, arşivlenen (vazgeçilen) akışta hemen kapanır. null: süre işlemiyor.
 */
export const BAGLANTI_GUN = 30;
export function baglantiSonu(akis: any): number | null {
  if (akis.durum === "aktif") return null;
  if (akis.durum !== "kapandi") return 0;
  const t = Date.parse(akis.kapandi_at || "");
  return Number.isFinite(t) ? t + BAGLANTI_GUN * 864e5 : 0;
}
const iptalMi = (k: any) => !k.link_hash && !k.link_token;
/** Sahibin listesi: bağlantı, durum (acik | iptal | suresi_doldu), geçerlilik, son açılış ve adım sayısı. */
async function katilimcilarV(ctx: Ctx, ak: any, base: string) {
  const ks = await ctx.db.many("katilimci", { akis_id: ak.id }, "created_at");
  if (!ks.length) return [];
  const acilis = (await ctx.db.many("olay", { akis_id: ak.id, tip: "okuma" }, "created_at")).filter((e: any) => e.kanal === "baglanti" && e.adim_no == null);
  const steps = await ctx.db.many("adim", { akis_id: ak.id }, "no");
  const son = baglantiSonu(ak);
  return Promise.all(ks.map(async (k: any) => {
    const benim = (e: any) => (k.kisi_id && e.kisi_id ? e.kisi_id === k.kisi_id : norm(e.kim) === norm(k.ad));
    const ac = acilis.filter(benim);
    const adim = steps.filter((s: any) => (k.kisi_id && s.sahip_kisi_id ? s.sahip_kisi_id === k.kisi_id : adEslesir(s.sahip, k.ad)));
    const durum = iptalMi(k) ? "iptal" : son != null && ctx.now >= son ? "suresi_doldu" : "acik";
    return {
      ...katilimciV(k, durum === "acik" ? base : null, durum === "acik" ? await belirtecAc(k, ctx.sifre) : null, ak.baslik),
      ...(durum === "acik" ? {} : { link: null, whatsapp: null, mesaj: null }),
      durum, gecerlilik: son ? iso(son) : null, son_acilis: ac.length ? ac[ac.length - 1].created_at : null, acilis_sayisi: ac.length,
      adim_sayisi: adim.length, acik_adim: adim.filter((s: any) => !DONE(s)).length,
      akis: { kod: ak.kisa_kod, baslik: ak.baslik, durum: ak.durum },
    };
  }));
}
/** Kişi bu alanın üyesi ya da anahtar sahibi mi (alanın sahibi dahil)? */
async function ekipKisisi(ctx: Ctx, kisi: any) {
  if (norm(kisi.ad) === norm(ctx.key.kisi) && !isDis(ctx)) return true;
  if (await ctx.db.one("uye", { kullanici_id: ctx.ws.id, kisi_id: kisi.id })) return true;
  return (await ctx.db.many("anahtar", { kullanici_id: ctx.ws.id, kisi_id: kisi.id }, "created_at")).some((a: any) => a.rol !== "dis");
}
async function katilimciSahipli(ctx: Ctx, id: string) {
  const k = /^[0-9a-f-]{36}$/i.test(id) ? await ctx.db.one("katilimci", { id }) : null;
  const ak = k ? await ctx.db.one("akis", { id: k.akis_id, sahip_id: ctx.ws.id }) : null;
  if (!k || !ak) throw new ApiHata(404, "Katılımcı yok.");
  await getAkis(ctx, ak.kisa_kod); // ekip üyesinin kapsamı
  return { k, ak };
}

async function adimDetayV(ctx: Ctx, kod: string, no: number) {
  const akis = await getAkis(ctx, kod);
  const { steps, events } = await loadFlow(ctx, akis);
  const s = steps.find((x: any) => x.no === no);
  if (!s) throw new ApiHata(404, `Bu akışta ${no} numaralı adım yok.`);
  if (!stepInScope(ctx, s)) throw new ApiHata(403, `Adım ${no} sana atanmamış.`);
  const ev = events.filter((e: any) => e.tip !== "okuma");
  const m = metrics(akis, steps, ev, ctx.now);
  const v: any = adimV(akis, s, m, steps, { dis: isDis(ctx) });
  const dis = isDis(ctx);
  v.ciktilar = (await ciktilar(ctx, akis.id, [s.no])).map(ciktiV);
  v.girdiler = (await ciktilar(ctx, akis.id, s.bagimli)).filter((c: any) => !dis || c.paylasim === "dis").map(ciktiV);
  if (!dis) {
    v.bekledigi = s.bagimli.map((n: number) => { const d: any = steps.find((x: any) => x.no === n); return d ? { no: d.no, ad: d.ad, sahip: d.sahip, durum: d.durum } : null; }).filter(Boolean);
    v.bekleyen_adimlar = steps.filter((x: any) => x.bagimli.includes(s.no)).map((d: any) => ({ no: d.no, ad: d.ad, sahip: d.sahip, durum: d.durum }));
    v.kararlar = akis.baglam?.musteri ? (await kararlar(ctx, akis.baglam.musteri)).map(kararV) : [];
  }
  const bq = s.cevap_soru && akis.baglam?.bekleyen?.[s.cevap_soru];
  v.cevaplanacak_soru = bq && !DONE(s) ? { kod: s.cevap_soru, soru: bq.soru, tip: bq.tip, secenekler: bq.secenekler || null } : null;
  v.olaylar = ev.filter((e: any) => e.adim_no === s.no).reverse().map(olayV);
  return { akis: { kod: akis.kisa_kod, baslik: akis.baslik, durum: akis.durum }, adim: v };
}
const ciktiV = (c: any) => ({ id: c.id, adim_no: c.adim_no, ad: c.ad, ozet: c.ozet || null, icerik: c.icerik || null, url: dosyaIdOf(c.url) ? null : c.url || null, dosya_id: dosyaIdOf(c.url), kaynak: c.kaynak || null, surum: c.surum, durum: c.durum, paylasim: c.paylasim, kim: c.kim || null, arac: c.arac || null, tarih: c.created_at });

async function kararlarV(ctx: Ctx, varlik: string | null) {
  const rows = await ctx.db.many("karar", varlik ? { ws_id: ctx.ws.id, varlik_norm: norm(varlik), durum: "gecerli" } : { ws_id: ctx.ws.id, durum: "gecerli" }, "created_at");
  const by = new Map<string, any[]>();
  for (const k of rows.reverse()) { const a = by.get(k.varlik) || []; a.push(kararV(k)); by.set(k.varlik, a); }
  // karar bekleyen adımlar (aktif akışlarda, sırası gelmiş ya da sürüyor)
  let flows = (await ctx.db.many("akis", { sahip_id: ctx.ws.id, durum: "aktif" }, "created_at")).filter((f: any) => !varlik || norm(f.baglam?.musteri || "") === norm(varlik));
  if (akisKapsami(ctx)) { const ids0 = flows.map((f: any) => f.id), tum = ids0.length ? await ctx.db.many("adim", { akis_id: ids0 }, "no") : []; flows = flows.filter((f: any) => flowInScope(ctx, f, tum.filter((s: any) => s.akis_id === f.id))); }
  const ids = flows.map((f: any) => f.id);
  const steps = ids.length ? (await ctx.db.many("adim", { akis_id: ids, durum: ["hazir", "suruyor", "engelli"] }, "no")).map(fixStep) : [];
  const fBy = new Map(flows.map((f: any) => [f.id, f]));
  const bekleyen = steps.filter((s: any) => { const f: any = fBy.get(s.akis_id); return (f.kurallar || {}).karar_insanda !== false && kararAdimi(s) && !altAdimi(f, s.no); })
    .map((s: any) => { const f: any = fBy.get(s.akis_id); return { akis: f.kisa_kod, akis_baslik: f.baslik, varlik: f.baglam?.musteri || null, no: s.no, ad: s.ad, sahip: s.sahip, durum: s.durum, karar_kriteri: s.karar_kriteri || null, son_tarih: s.son_tarih || null }; });
  return { varliklar: [...by.entries()].map(([v, k]) => ({ varlik: v, kararlar: k })), bekleyen };
}

async function taslakV(ctx: Ctx, kod: string) {
  const t = await ctx.db.one("taslak", { kisa_kod: String(kod).toUpperCase(), ws_id: ctx.ws.id });
  if (!t) throw new ApiHata(404, `'${kod}' taslağı yok.`);
  const tt = t.taslak || {};
  return {
    kod: t.kisa_kod, cumle: t.cumle, durum: t.durum, akis_id: t.akis_id || null, baslik: tt.baslik || null, amac: tt.amac || null, varlik: t.baglam?.musteri || tt.anahtar_varlik?.ad || null,
    hedef_tarih: tt.hedef_tarih || null, is_turu: t.is_turu_ad || t.is_turu || null, olusturuldu: t.created_at,
    sorular: (t.sorular?.secilen || []).map((q: any) => ({ kod: q.kod, soru: q.soru, neden: q.neden || null, gerekce: q.gerekce || null, tip: q.tip, secenekler: q.secenekler || null, varsayilan: q.varsayilan ?? null })),
    sonra_sorulacak: (t.sorular?.sonra || []).map((q: any) => ({ kod: q.kod, soru: q.soru, tip: q.tip })),
    varsayimlar: (t.sorular?.varsayim || []).map((q: any) => ({ kod: q.kod, soru: q.soru, cevap: q.cevap ?? q.varsayilan ?? null, kaynak: q.kaynak || null, boyut: q.boyut || null, tip: q.tip || null, secenekler: q.secenekler || null })),
    // 0.10.0: taslağın metin varsayımları (H1 yörünge rozetleri)
    varsayim_metinleri: (Array.isArray(t.varsayimlar) ? t.varsayimlar : tt.varsayimlar || []).map((v: any) => ({ boyut: v.boyut || null, metin: v.metin })),
    adimlar: (tt.adimlar || []).map((x: any) => ({ id: x.id, ad: x.ad, sahip_rol: x.sahip_rol, kriter: x.kriter, sure_tahmin_gun: x.sure_tahmin_gun ?? null, bagimli: x.bagimli || [], kosul: x.kosul || null })),
    roller: tt.roller || [], hatirlananlar: tt._hatira?.satirlar || [],
  };
}

// ---------- 0.12.0: görevler, bildirimler, toplu detay ----------
const ACIK = (s: any) => s.durum === "hazir" || s.durum === "suruyor" || s.durum === "engelli";
/** Görünen akışlar ve adımları (kapsam süzgeciyle). */
async function gorunenAkislar(ctx: Ctx, durum: string[] = ["aktif"]) {
  const flows = (await ctx.db.many("akis", { sahip_id: ctx.ws.id, durum }, "created_at"));
  const ids = flows.map((f: any) => f.id);
  const all = ids.length ? (await ctx.db.many("adim", { akis_id: ids }, "no")).map(fixStep) : [];
  const ev = ids.length ? await ctx.db.many("olay", { akis_id: ids }, "id") : [];
  const out: { akis: any; steps: any[]; events: any[] }[] = [];
  for (const f of flows) { const steps = all.filter((s: any) => s.akis_id === f.id); if (flowInScope(ctx, f, steps)) out.push({ akis: f, steps, events: ev.filter((e: any) => e.akis_id === f.id) }); }
  return out;
}

/**
 * Görevler (el notu 16): bütün akışlardaki adımlar, kişi / akış / durum süzgeciyle.
 * kisi: ad ya da "hepsi" (varsayılan: oturumdaki kişi); akis: "KOD1,KOD2"; durum: acik (varsayılan) | bitti | hepsi.
 */
async function gorevlerV(ctx: Ctx, q: URLSearchParams) {
  const kisi = q.get("kisi") || ctx.key.kisi || "hepsi";
  const kodlar = (q.get("akis") || "").split(",").map((x) => x.trim().toUpperCase()).filter(Boolean);
  const durum = q.get("durum") || "acik";
  const A = await gorunenAkislar(ctx, q.get("kapali") === "1" ? ["aktif", "kapandi"] : ["aktif"]);
  const kisiler = new Map<string, { ad: string; tip: string; acik: number }>();
  const gorevler: any[] = [];
  for (const { akis, steps, events } of A) {
    const m = metrics(akis, steps, events.filter((e: any) => e.tip !== "okuma"), ctx.now);
    for (const s of steps) {
      if (!stepInScope(ctx, s) || altAdimi(akis, s.no)) continue;
      const k = kisiler.get(norm(s.sahip)) || { ad: s.sahip, tip: s.sahip_tip, acik: 0 };
      if (ACIK(s)) k.acik++;
      kisiler.set(norm(s.sahip), k);
      if (kisi !== "hepsi" && !norm(s.sahip).includes(norm(kisi))) continue;
      if (kodlar.length && !kodlar.includes(String(akis.kisa_kod).toUpperCase())) continue;
      if (durum === "acik" && !ACIK(s)) continue;
      if (durum === "bitti" && !DONE(s)) continue;
      const t = m.tl.get(s.no), ef = DONE(s) ? null : m.pl.EF.get(s.no);
      gorevler.push({
        akis: akis.kisa_kod, akis_baslik: akis.baslik, akis_kisa_ad: akis.baglam?.kisa_ad || null,
        no: s.no, ad: s.ad, kisa_ad: akis.baglam?.kisa_adlar?.[String(s.no)] || null, sahip: s.sahip, sahip_tip: s.sahip_tip, durum: s.durum,
        engel: s.engel || null, karar_adimi: (akis.kurallar || {}).karar_insanda !== false && kararAdimi(s), kritik: !DONE(s) && m.pl.chain.includes(s.no), tuttugu: tuttugu(steps, s.no),
        // kimi bekliyor, kim bekliyor (doğrudan, açık olanlar): satırdaki bağımlılık işareti
        onceki: steps.filter((x: any) => s.bagimli.includes(x.no) && !DONE(x)).map((x: any) => ({ no: x.no, sahip: x.sahip, sahip_tip: x.sahip_tip, durum: x.durum })),
        sonraki: DONE(s) ? [] : steps.filter((x: any) => x.bagimli.includes(s.no) && !DONE(x)).map((x: any) => ({ no: x.no, sahip: x.sahip, sahip_tip: x.sahip_tip, durum: x.durum })),
        son_tarih: s.son_tarih || null, en_erken_bitis: iso(ef), gec_risk: ef != null && !!s.son_tarih && ef > eod(s.son_tarih), bekleme_saat: t ? saat(t.simdi) : null, durum_at: s.durum_at || null,
      });
    }
  }
  // önce engelli ve karar, sonra en çok tutan, sonra son tarih
  const agirlik = (g: any) => (g.durum === "engelli" ? 0 : g.karar_adimi && g.durum !== "tamam" ? 1 : g.durum === "hazir" ? 2 : g.durum === "suruyor" ? 3 : 4);
  gorevler.sort((a, b) => agirlik(a) - agirlik(b) || b.tuttugu - a.tuttugu || (a.son_tarih || "9999").localeCompare(b.son_tarih || "9999") || a.no - b.no);
  return {
    suzgec: { kisi, akis: kodlar, durum },
    gorevler,
    kisiler: [...kisiler.values()].sort((a, b) => b.acik - a.acik || a.ad.localeCompare(b.ad, "tr")),
    akislar: A.map(({ akis, steps }) => ({ kod: akis.kisa_kod, baslik: akis.baslik, kisa_ad: akis.baglam?.kisa_ad || null, acik: steps.filter(ACIK).length })),
  };
}

/** Okundu işareti cihazlar arasında aynı: e-postayla girişte üye, anahtarla girişte anahtar başına. */
const okuyan = (ctx: Ctx) => (ctx.key.uye_id ? `uye:${ctx.key.uye_id}` : `anahtar:${ctx.key.id}`);
async function okumaIsareti(ctx: Ctx): Promise<number> {
  const r = await ctx.db.one("okuma_isareti", { ws_id: ctx.ws.id, kim: okuyan(ctx) });
  return r ? Number(r.son_olay_id) || 0 : 0;
}

/**
 * Bildirimler (el notu 18): görünen akışlardaki başkalarının hareketleri, yeniden eskiye.
 * sinir (en çok 100), once (bu id'den eskiler). `ilgili`: olay senin adımında ya da doğrudan bekleyenin sensin.
 */
async function olaylarV(ctx: Ctx, q: URLSearchParams) {
  const sinir = Math.min(100, Math.max(1, Number(q.get("sinir")) || 40));
  const once = Number(q.get("once")) || null;
  const A = await gorunenAkislar(ctx, ["aktif", "kapandi"]);
  const ben = norm(ctx.key.kisi || "");
  const by = new Map(A.map((x) => [x.akis.id, x]));
  const ev = A.flatMap((x) => x.events).sort((a: any, b: any) => a.id - b.id);
  const son = await okumaIsareti(ctx);
  const benim = (e: any) => !!ben && norm(e.kim) === ben;
  const uygun = ev.filter((e: any) => e.tip !== "okuma" && !benim(e) && (!once || e.id < once)).filter((e: any) => {
    const { steps } = by.get(e.akis_id)!;
    return e.adim_no == null ? !isDis(ctx) : steps.some((s: any) => s.no === e.adim_no && stepInScope(ctx, s));
  });
  const okunmamis = ev.filter((e: any) => e.tip !== "okuma" && !benim(e) && e.id > son).length;
  const olaylar = uygun.slice(-sinir).reverse().map((e: any) => {
    const { akis, steps } = by.get(e.akis_id)!;
    const s = e.adim_no != null ? steps.find((x: any) => x.no === e.adim_no) : null;
    const sonraki = s ? steps.filter((x: any) => x.bagimli.includes(s.no)) : [];
    return {
      ...olayV(e), akis: akis.kisa_kod, akis_baslik: akis.baslik, akis_kisa_ad: akis.baglam?.kisa_ad || null,
      adim_ad: s?.ad || null, adim_kisa_ad: s ? akis.baglam?.kisa_adlar?.[String(s.no)] || null : null,
      ilgili: !!ben && !!s && (norm(s.sahip) === ben || sonraki.some((x: any) => norm(x.sahip) === ben)),
      okundu: e.id <= son,
    };
  });
  return { olaylar, okunmamis, son_okunan: son, devami: uygun.length > sinir };
}

async function okunduYaz(ctx: Ctx, b: any) {
  const id = Number(b.son_id);
  if (!Number.isFinite(id) || id < 0) throw new ApiHata(400, "son_id gerekli: okunan en yeni olayın id'si.");
  const kim = okuyan(ctx), var0 = await ctx.db.one("okuma_isareti", { ws_id: ctx.ws.id, kim });
  // geri gitmez: başka bir cihaz daha yenisini okumuş olabilir
  if (var0 && Number(var0.son_olay_id) >= id) return { son_okunan: Number(var0.son_olay_id) };
  if (var0) await ctx.db.update("okuma_isareti", { ws_id: ctx.ws.id, kim }, { son_olay_id: id, updated_at: new Date(ctx.now).toISOString() });
  else await ctx.db.insert("okuma_isareti", [{ ws_id: ctx.ws.id, kim, son_olay_id: id }]);
  return { son_okunan: id };
}

// ---------- yönlendirme ----------
const ARAC = "Devir web";
function govdeAl(b: any) { return b && typeof b === "object" ? b : {}; }
async function arac(ctx: Ctx, ad: string, a: any) {
  try { return await callTool(ad, { arac: ARAC, kim_tip: "insan", ...a }, ctx); }
  catch (e) { throw new ApiHata(e instanceof DevirHata ? e.durum : 400, (e as Error).message); }
}

function sahipMi(ctx: Ctx) { if (ctx.key.rol !== "sahip") throw new ApiHata(403, "Bunu yalnızca çalışma alanının sahibi yapabilir."); }
function ekipMi(ctx: Ctx) { if (isDis(ctx)) throw new ApiHata(403, "Bunu yalnızca ekip üyeleri yapabilir."); }
async function sha256(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join(""); }
function yeniToken(on: string, n = 18) { const b = new Uint8Array(n); crypto.getRandomValues(b); return on + Array.from(b).map((x) => "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 57]).join(""); }
const IPTAL = "iptal:";

export async function apiYonlendir(ctx: Ctx, method: string, yol: string[], q: URLSearchParams, body: any, taban: { fn: string; link: string }): Promise<unknown> {
  const [r0, r1, r2, r3, r4] = yol;
  const b = govdeAl(body);
  if (method === "GET") {
    if (r0 === "ozet" && !r1) return anaV(ctx);
    if (r0 === "akislar" && !r1) return { akislar: await akislarV(ctx, q.get("durum") || "aktif", q.get("alt") === "1"), taslaklar: await taslaklarV(ctx) };
    if (r0 === "akis" && r1 && !r2) return akisV(ctx, r1);
    // 0.12.0: toplu akış detayı (evren ve görevler N çağrı yerine bir çağrı); en çok 30 akış
    if (r0 === "akislar" && r1 === "detay" && !r2) {
      const kodlar = (q.get("kodlar") || "").split(",").map((x) => x.trim()).filter(Boolean).slice(0, 30);
      const out: Record<string, unknown> = {};
      for (const k of kodlar) { try { out[k] = await akisV(ctx, k); } catch (e) { if (!(e instanceof ApiHata) && !(e instanceof DevirHata && (e.durum === 403 || e.durum === 404))) throw e; } }
      return { akislar: out };
    }
    if (r0 === "gorevler" && !r1) return gorevlerV(ctx, q);
    if (r0 === "olaylar" && !r1) return olaylarV(ctx, q);
    if (r0 === "akis" && r1 && r2 === "adim" && r3 && !r4) return adimDetayV(ctx, r1, Number(r3));
    if (r0 === "akis" && r1 && r2 === "katilimcilar" && !r3) { ekipMi(ctx); const ak = await getAkis(ctx, r1); return { katilimcilar: await katilimcilarV(ctx, ak, taban.link) }; }
    // bütün akışların dış katılımcıları (P1-C, Pano): açık ve süresi işleyen bağlantılar, son açılış
    if (r0 === "katilimcilar" && !r1) {
      ekipMi(ctx);
      const out: any[] = [];
      for (const ak of await ctx.db.many("akis", { sahip_id: ctx.ws.id }, "created_at")) {
        const son = baglantiSonu(ak);
        if (son != null && ctx.now >= son) continue;
        if (!(await ctx.db.many("katilimci", { akis_id: ak.id }, "created_at")).length) continue;
        try { await getAkis(ctx, ak.kisa_kod); } catch (e) { if (e instanceof DevirHata && (e.durum === 403 || e.durum === 404)) continue; throw e; }
        out.push(...(await katilimcilarV(ctx, ak, taban.link)));
      }
      return { katilimcilar: out };
    }
    // "ne görecek" önizlemesi (P1-C): bağlantı sayfası katılımcının kapsamıyla, açılış kaydı yazılmadan
    if (r0 === "katilimci" && r1 && r2 === "onizleme" && !r3) {
      ekipMi(ctx);
      const { k, ak } = await katilimciSahipli(ctx, r1);
      const dctx = await disCtx(ctx.db, k, ak, ctx.now, "Devir önizleme");
      return { onizleme: true, ...(await baglantiGorunum(dctx, k, ak, false)) };
    }
    if (r0 === "cikti" && r1) {
      const ak = await getAkis(ctx, q.get("akis"));
      const c = await ctx.db.one("cikti", { id: Number(r1), akis_id: ak.id });
      if (!c) throw new ApiHata(404, "Çıktı yok.");
      if (isDis(ctx)) { const s = await ctx.db.one("adim", { akis_id: ak.id, no: c.adim_no }); if (c.paylasim !== "dis" && !(s && stepInScope(ctx, s))) throw new ApiHata(403, "Bu çıktı ekibe özel."); }
      return { cikti: ciktiV(c) };
    }
    if (r0 === "dosya" && r1 && !r2) return indir(ctx, r1);
    if (r0 === "akis" && r1 && r2 === "dosyalar" && !r3) return akisDosyalari(ctx, r1);
    if (r0 === "kararlar" && !r1) { ekipMi(ctx); return kararlarV(ctx, q.get("varlik")); }
    if (r0 === "taslak" && r1 && !r2) { ekipMi(ctx); return taslakV(ctx, r1); }
    if (r0 === "dersler" && !r1) {
      ekipMi(ctx);
      const L = await ctx.db.many("ders", { ws_id: ctx.ws.id, durum: ["kesin", "aday", "zayif"] }, "updated_at", 200);
      return { dersler: L.reverse().map((x: any) => ({ kod: `D${x.id}`, metin: x.metin, durum: x.durum, etki: x.etki, kapsam: x.kapsam, varlik: x.varlik || null, kanit_sayi: x.kanit_sayi, uygulandi: x.uygulandi || 0, gereksiz: x.atlandi || 0, guven: x.guven })) };
    }
    if (r0 === "anahtarlar" && !r1) {
      sahipMi(ctx);
      const L = await ctx.db.many("anahtar", { kullanici_id: ctx.ws.id }, "created_at");
      return { anahtarlar: L.map((k: any) => ({ id: k.id, kisi: k.kisi, rol: k.rol, kapsam: k.kapsam || null, olusturuldu: k.created_at, son_kullanim: k.son_kullanim || null, onek: k.onek || null, son_gecerlilik: k.son_gecerlilik || null, suresi_doldu: !!k.son_gecerlilik && Date.parse(k.son_gecerlilik) <= ctx.now, iptal: String(k.token_hash || "").startsWith(IPTAL), ben: k.id === ctx.key.id })) };
    }
    if (r0 === "kisiler" && !r1) { ekipMi(ctx); return { kisiler: (await ctx.db.many("kisi", { ws_id: ctx.ws.id }, "ad")).map(kisiV) }; }
    if (r0 === "politika" && !r1) { ekipMi(ctx); return { politika: politikaV(ctx.ws) }; }
    if (r0 === "ben" && !r1) return { kisi: ctx.key.kisi, kisi_id: ctx.key.kisi_id || null, kanal: ctx.kanal || null, rol: ctx.key.rol, kapsam: ctx.key.kapsam || null, calisma_alani: { ad: ctx.ws.ad } };
    throw new ApiHata(404, "Böyle bir uç yok.");
  }
  if (method === "POST") {
    // akış işlemleri: sonuçta güncel görünüm döner
    if (r0 === "akis" && r1 && r2 === "adim" && r3 && !r4) {
      if (b.cikti) { const ak = await getAkis(ctx, r1); b.cikti = await dosyaCiktilari(ctx, ak.id, Number(r3), b.cikti); }
      const mesaj = await arac(ctx, "devir_adim_guncelle", { ...b, akis: r1, no: Number(r3) });
      return { mesaj, ...(await adimDetayV(ctx, r1, Number(r3))) };
    }
    if (r0 === "akis" && r1 && r2 === "adim" && r3 && r4 === "dosya") return yuklemeIste(ctx, r1, Number(r3), b);
    if (r0 === "dosya" && r1 && r2 === "sil") return dosyaSil(ctx, [r1]);
    if (r0 === "akis" && r1 && r2 === "dosyalari-sil" && !r3) { sahipMi(ctx); const ak = await getAkis(ctx, r1); return dosyaSil(ctx, null, ak.id); }
    if (r0 === "akis" && r1 && r2 === "adim" && !r3) { const mesaj = await arac(ctx, "devir_adim_ekle", { ...b, akis: r1 }); return { mesaj, ...(await akisV(ctx, r1)) }; }
    if (r0 === "akis" && r1 && r2 === "cevap" && !r3) { const mesaj = await arac(ctx, "devir_cevapla", { ...b, akis: r1 }); return { mesaj, ...(await akisV(ctx, r1)) }; }
    if (r0 === "akis" && r1 && r2 === "tekrar" && !r3) { const mesaj = await arac(ctx, "devir_alt_akis", { ...b, akis: r1 }); return { mesaj, ...(await akisV(ctx, r1)) }; }
    if (r0 === "akis" && r1 && r2 === "kapat" && !r3) { const mesaj = await arac(ctx, "devir_akis_kapat", { ...b, akis: r1 }); return { mesaj }; }
    if (r0 === "akis" && r1 && r2 === "sabitle" && !r3) { const mesaj = await arac(ctx, "devir_sabitle", { ...b, akis: r1 }); return { mesaj }; }
    if (r0 === "olaylar" && r1 === "okundu" && !r2) return okunduYaz(ctx, b);
    if (r0 === "karar" && !r1) { const mesaj = await arac(ctx, "devir_karar", b); return { mesaj, ...(await kararlarV(ctx, b.varlik || null)) }; }
    if (r0 === "ders" && r1 && (r2 === "onayla" || r2 === "reddet")) { const mesaj = await arac(ctx, "devir_dersler", { islem: r2, ders: r1 }); return { mesaj }; }
    if (r0 === "tasla" && !r1) { const mesaj = await arac(ctx, "devir_tasla", b); const kod = /Taslak (T\w+)/.exec(mesaj)?.[1] || /\b(T[A-Z0-9]{3,})\b/.exec(mesaj)?.[1]; return { mesaj, ...(kod ? { taslak: await taslakV(ctx, kod) } : {}) }; }
    if (r0 === "taslak" && r1 && r2 === "iptal" && !r3) {
      ekipMi(ctx);
      const t = await ctx.db.one("taslak", { kisa_kod: String(r1).toUpperCase(), ws_id: ctx.ws.id });
      if (!t) throw new ApiHata(404, "Taslak yok.");
      if (t.durum === "kuruldu") throw new ApiHata(409, "Bu taslaktan akış kuruldu; akışı kapatmak için akışın kendisini iptal et.");
      if (t.durum !== "iptal") await ctx.db.update("taslak", { id: t.id }, { durum: "iptal" });
      return { taslak: { kod: t.kisa_kod, durum: "iptal" }, taslaklar: await taslaklarV(ctx) };
    }
    if (r0 === "taslak" && r1 && r2 === "kur" && !r3) { const mesaj = await arac(ctx, "devir_akis_olustur", { ...b, taslak: r1 }); const kod = /oluşturuldu: (\w+)/.exec(mesaj)?.[1]; return { mesaj, ...(kod ? await akisV(ctx, kod) : {}) }; }
    // dış katılımcı bağlantısı
    if (r0 === "akis" && r1 && r2 === "katilimci" && !r3) {
      ekipMi(ctx);
      const ak = await getAkis(ctx, r1);
      const ad = String(b.ad || "").trim();
      if (!ad) throw new ApiHata(400, "ad gerekli: bağlantıyı alacak kişinin adı (adımlarda sahip olarak yazılan ad).");
      // kişi seçiciden kisi_id gelir; yoksa ad bu alandaki kişiye çözülür. Bir akışta bir kişiye bir bağlantı.
      const kisi = b.kisi_id ? await kisiAl(ctx, b.kisi_id) : await kisiCoz(ctx, ad, "dis");
      const var0 = (await ctx.db.many("katilimci", { akis_id: ak.id }, "created_at")).find((k: any) => kisi && k.kisi_id ? k.kisi_id === kisi.id : norm(k.ad) === norm(ad));
      const yeni = var0 ? null : yeniBelirtec();
      const k = var0 || (await ctx.db.insert("katilimci", [{ akis_id: ak.id, ad: kisi?.ad || ad, rol: b.rol || null, iletisim: b.iletisim || null, ...(kisi ? { kisi_id: kisi.id } : {}), ...(await belirtecAlanlari(yeni!, ctx.sifre)) }]))[0];
      const steps = (await ctx.db.many("adim", { akis_id: ak.id }, "no")).filter((s: any) => kisi && s.sahip_kisi_id ? s.sahip_kisi_id === kisi.id : adEslesir(s.sahip, ad));
      // N-10: bağlantı alan kişi ekipte değilse dış kişidir; "insan" yazılmış adımları "dış" olur (agent adımı değişmez)
      if (kisi && kisi.tip !== "agent" && !(await ekipKisisi(ctx, kisi))) {
        if (kisi.tip !== "dis") await ctx.db.update("kisi", { id: kisi.id }, { tip: "dis" });
        for (const s of steps) if (s.sahip_tip === "insan") await ctx.db.update("adim", { id: s.id }, { sahip_tip: "dis" });
      }
      return { katilimci: katilimciV(k, taban.link, yeni || await belirtecAc(k, ctx.sifre), ak.baslik), adim_sayisi: steps.length, ...(steps.length ? {} : { uyari: `Bu akışta sahibi "${ad}" olan adım yok; bağlantıda adım görünmez. Adımın sahibini bu adla yaz.` }) };
    }
    if (r0 === "katilimci" && r1 && r2 === "yenile" && !r3) {
      ekipMi(ctx);
      const { k, ak } = await katilimciSahipli(ctx, r1);
      const son = baglantiSonu(ak);
      if (son != null && ctx.now >= son) throw new ApiHata(409, ak.durum === "kapandi" ? `Akış ${BAGLANTI_GUN} günden önce kapandı; bağlantı yenilenmez.` : "Akış arşivde; bağlantı yenilenmez.");
      const t = yeniBelirtec();
      await ctx.db.update("katilimci", { id: k.id }, await belirtecAlanlari(t, ctx.sifre));
      await olayYaz(ctx, ak.id, null, "guncelleme", `${k.ad} için bağlantı ${iptalMi(k) ? "yeniden açıldı" : "yenilendi"}`, { tur: "baglanti_yenile", katilimci_id: k.id });
      return { katilimci: (await katilimcilarV(ctx, ak, taban.link)).find((x: any) => x.id === k.id), not: iptalMi(k) ? "Yeni bağlantı üretildi." : "Eski bağlantı artık açılmıyor." };
    }
    // bağlantıyı kapat (P1-C): belirteç silinir, sayfa açılmaz; "Yenile" yeni bağlantı üretir
    if (r0 === "katilimci" && r1 && r2 === "iptal" && !r3) {
      ekipMi(ctx);
      const { k, ak } = await katilimciSahipli(ctx, r1);
      if (!iptalMi(k)) {
        await ctx.db.update("katilimci", { id: k.id }, { link_hash: null, link_sifreli: null, link_token: null });
        await olayYaz(ctx, ak.id, null, "guncelleme", `${k.ad} için bağlantı kapatıldı`, { tur: "baglanti_iptal", katilimci_id: k.id });
      }
      return { katilimci: (await katilimcilarV(ctx, ak, taban.link)).find((x: any) => x.id === k.id) };
    }
    // kişi adını değiştir (yalnız sahip): kimlik aynı kalır, adımlar ve bağlantılar yeni adı gösterir
    if (r0 === "kisi" && r1 && !r2) {
      sahipMi(ctx);
      const k = await kisiAl(ctx, r1);
      const ad = String(b.ad || "").trim().slice(0, 80);
      if (!ad) throw new ApiHata(400, "ad gerekli.");
      await ctx.db.update("kisi", { id: k.id }, { ad, ad_norm: norm(ad), updated_at: new Date(ctx.now).toISOString() });
      for (const ak of await ctx.db.many("akis", { sahip_id: ctx.ws.id }, "created_at")) {
        for (const s of await ctx.db.many("adim", { akis_id: ak.id, sahip_kisi_id: k.id }, "no")) await ctx.db.update("adim", { id: s.id }, { sahip: ad });
        for (const x of await ctx.db.many("katilimci", { akis_id: ak.id, kisi_id: k.id }, "created_at")) await ctx.db.update("katilimci", { id: x.id }, { ad });
      }
      return { kisi: kisiV({ ...k, ad }) };
    }
    // karar politikası (MK-3): agent üzerinden verilen karar kullanıcı tipine göre insan kararı mı, beyan mı
    if (r0 === "politika" && !r1) {
      sahipMi(ctx);
      const ak: Record<string, string> = { ...politikaV(ctx.ws).agent_karari };
      for (const rol of ["sahip", "ekip", "dis"]) if (b.agent_karari?.[rol] != null) {
        if (!["insan", "beyan"].includes(b.agent_karari[rol])) throw new ApiHata(400, "agent_karari değerleri insan ya da beyan olmalı.");
        ak[rol] = b.agent_karari[rol];
      }
      const politika = { ...(ctx.ws.politika || {}), agent_karari: ak };
      await ctx.db.update("kullanici", { id: ctx.ws.id }, { politika });
      return { politika: politikaV({ ...ctx.ws, politika }) };
    }
    // anahtar yönetimi (yalnızca sahip)
    if (r0 === "anahtar" && !r1) {
      sahipMi(ctx);
      const kisi = String(b.kisi || "").trim();
      const rol = ["ekip", "dis", "sahip"].includes(b.rol) ? b.rol : "ekip";
      if (!kisi) throw new ApiHata(400, "kisi gerekli.");
      if (rol === "dis" && !String(b.kapsam || kisi).trim()) throw new ApiHata(400, "dış katılımcı için kapsam gerekli.");
      const token = yeniToken("dv_");
      // aynı adlı üye varsa anahtar ona bağlanır (N-4): üyelik biterse anahtar da geçmez
      const uye = (await ctx.db.many("uye", { kullanici_id: ctx.ws.id }, "created_at")).find((u: any) => b.uye_id ? u.id === b.uye_id : norm(u.kisi) === norm(kisi));
      const kk = await kisiAlani(ctx, rol === "dis" ? String(b.kapsam || kisi).trim() : kisi, rol === "dis" ? "dis" : "insan");
      const son = new Date(ctx.now + ANAHTAR_OMRU).toISOString();
      const [k] = await ctx.db.insert("anahtar", [{ kullanici_id: ctx.ws.id, kisi, rol: uye ? uye.rol : rol, kapsam: rol === "dis" ? String(b.kapsam || kisi).trim() : (b.kapsam || null), token_hash: await sha256(token), onek: token.slice(0, 7), son_gecerlilik: son, ...(uye ? { uye_id: uye.id } : {}), ...kk }]);
      // anahtar adrese gömülmez (S-B1): yalnız Authorization başlığında
      return { anahtar: { id: k.id, kisi, rol, kapsam: k.kapsam || null, onek: k.onek, son_gecerlilik: son }, token, mcp_adresi: taban.fn, baslik: `Authorization: Bearer ${token}`, not: "Anahtar yalnızca şimdi gösterilir, 90 gün geçerli. Claude ve ChatGPT'de anahtar gerekmez: kişi adresi ekleyip e-postasıyla onaylar." };
    }
    if (r0 === "anahtar" && r1 && r2 === "iptal" && !r3) {
      sahipMi(ctx);
      const k = await ctx.db.one("anahtar", { id: r1, kullanici_id: ctx.ws.id });
      if (!k) throw new ApiHata(404, "Anahtar yok.");
      if (k.id === ctx.key.id) throw new ApiHata(400, "Şu an kullandığın anahtarı iptal edemezsin.");
      if (String(k.token_hash).startsWith(IPTAL)) return { iptal: true, not: "Zaten iptal." };
      await ctx.db.update("anahtar", { id: k.id }, { token_hash: IPTAL + crypto.randomUUID() });
      return { iptal: true };
    }
    throw new ApiHata(404, "Böyle bir uç yok.");
  }
  throw new ApiHata(405, "Yöntem desteklenmiyor.");
}

// ---------- dış katılımcı bağlantısı (anahtarsız; yalnızca kendi adımları ve dört eylem) ----------
async function disCtx(db: DB, k: any, akis: any, now: number, ua: string, depo?: Depo) {
  const ws = await db.one("kullanici", { id: akis.sahip_id });
  return kimlikBagla({ db, ws, key: { id: null, kisi: k.ad, rol: "dis", kapsam: k.ad, kisi_id: k.kisi_id || null }, ua: ua || "Devir bağlantı", now, kanal: "baglanti", depo } as Ctx, "katilimci", k.id);
}

export async function baglantiCtx(db: DB, token: string, now: number, ua: string, depo?: Depo) {
  if (!/^[a-z0-9]{16,64}$/i.test(token)) throw new ApiHata(404, "Bağlantı geçersiz.");
  const k = await belirtecBul(db, token);
  if (!k) throw new ApiHata(404, "Bağlantı geçersiz ya da yenilenmiş. Gönderen kişiden yenisini iste.");
  const akis = await db.one("akis", { id: k.akis_id });
  if (!akis) throw new ApiHata(404, "Akış bulunamadı.");
  const son = baglantiSonu(akis);
  if (son != null && now >= son) throw new ApiHata(410, akis.durum === "kapandi" ? "Bu iş kapandı; bağlantının süresi doldu." : "Bu iş artık sürmüyor; bağlantı kapandı.");
  const ctx: Ctx = await disCtx(db, k, akis, now, ua, depo);
  return { ctx, k, akis };
}

export async function baglantiV(db: DB, token: string, now: number, ua: string) {
  const { ctx, k, akis } = await baglantiCtx(db, token, now, ua);
  return baglantiGorunum(ctx, k, akis, true);
}

/** Bağlantı sayfasının verisi; okuma: açılış kaydı yazılır (önizlemede yazılmaz). */
async function baglantiGorunum(ctx: Ctx, k: any, akis: any, okuma: boolean) {
  const db = ctx.db, now = ctx.now;
  const { steps, events } = await loadFlow(ctx, akis).catch(() => ({ steps: [], events: [] } as any));
  const ev = events.filter((e: any) => e.tip !== "okuma");
  const m = metrics(akis, steps, ev, now);
  const benim = steps.filter((s: any) => stepInScope(ctx, s));
  const adimlar = [];
  for (const s of benim) {
    const v: any = adimV(akis, s, m, steps, { dis: true });
    v.girdiler = (await ciktilar(ctx, akis.id, s.bagimli)).filter((c: any) => c.paylasim === "dis").map(ciktiV);
    v.ciktilar = (await ciktilar(ctx, akis.id, [s.no])).map(ciktiV);
    v.bekledigi = s.bagimli.map((n: number) => { const d: any = steps.find((x: any) => x.no === n); return d && !DONE(d) ? { ad: d.ad, durum: d.durum } : null; }).filter(Boolean);
    v.eylemler = DONE(s) ? [] : s.durum === "suruyor" || s.durum === "engelli" ? ["tamam", "engel", "not"] : v.bekledigi.length ? ["not"] : ["basladim", "tamam", "engel", "not"];
    adimlar.push(v);
  }
  const p: Parca[] = [];
  const A = (metin: string, tur: Parca["tur"] = "metin", ref?: any) => p.push({ tur, metin, ...(ref ? { ref } : {}) });
  const acik = adimlar.filter((v: any) => !DONE(v) && v.eylemler.includes("tamam"));
  const bekle = adimlar.filter((v: any) => !DONE(v) && !v.eylemler.includes("tamam"));
  A(`Merhaba ${k.ad}. `);
  if (acik.length) { A(acik.length === 1 ? "Senden beklenen: " : `Senden ${acik.length} adım bekleniyor. Önce: `); A(acik[0].ad, "adim", { no: acik[0].no }); if (acik[0].son_tarih) { A(", son "); A(fmtD(acik[0].son_tarih), "tarih", { tarih: acik[0].son_tarih }); } A("."); }
  else if (bekle.length) { A("Şu an senden bir şey beklenmiyor. Sıradaki adımın "); A(bekle[0].ad, "adim", { no: bekle[0].no }); A(`, ${bekle[0].bekledigi.map((x: any) => `"${x.ad}"`).join(", ")} bitince açılacak.`); }
  else if (adimlar.length) A("Sana düşen adımların hepsi bitti, teşekkürler.");
  else A("Bu bağlantıda sana atanmış bir adım görünmüyor.");
  if (okuma) await db.insert("olay", [{ akis_id: akis.id, adim_no: null, kim: k.ad, kim_tip: "dis", arac: "Devir bağlantı", kanal: "baglanti", ...(ctx.key.kisi_id ? { kisi_id: ctx.key.kisi_id } : {}), tip: "okuma", ozet: "Bağlantı açıldı", veri: {} }]).catch(() => {});
  const sahipUye = await db.one("uye", { kullanici_id: akis.sahip_id, rol: "sahip" }).catch(() => null);
  return {
    kisi: k.ad, ...(akis.durum === "kapandi" ? { gecerlilik: iso(baglantiSonu(akis)) } : {}), akis: { sahip: sahipUye?.kisi || null, baslik: akis.baslik, varlik: akis.baglam?.musteri || null, hedef_tarih: akis.hedef_tarih || null, durum: akis.durum, ilerleme: { tamam: steps.filter(DONE).length, toplam: steps.length }, karar_ozeti: akisKarari(akis, steps, ev, now, await gecmisYukle(ctx), { dis: true, vis: benim }).karar_ozeti },
    ozet: yaz(p), ozet_parcalar: p, adimlar,
    // sisli harita (0.10.0): öteki adımlar adsız; sahipler yalnız rol harfiyle (yol geometrisi için)
    harita: haritaDis(ctx, akis, steps, m),
  };
}

function haritaDis(ctx: Ctx, akis: any, steps: any[], m: any) {
  const takma = new Map<string, string>();
  const ad = (s: any) => { if (stepInScope(ctx, s)) return s.sahip; if (!takma.has(s.sahip)) takma.set(s.sahip, `yol-${takma.size + 1}`); return takma.get(s.sahip)!; };
  return {
    olusturuldu: akis.created_at, hedef_tarih: akis.hedef_tarih || null, kapandi_at: akis.kapandi_at || null, kritik_yol: m.pl.chain,
    adimlar: steps.map((s: any) => ({ no: s.no, sahip: ad(s), sahip_tip: stepInScope(ctx, s) ? s.sahip_tip : s.sahip_tip === "agent" ? "agent" : "insan", durum: s.durum, bagimli: s.bagimli, durum_at: s.durum_at, en_erken_bitis: DONE(s) ? null : iso(m.pl.EF.get(s.no)), sure_tahmin_gun: s.sure_tahmin_gun != null ? Number(s.sure_tahmin_gun) : null })),
  };
}

export async function baglantiEylem(db: DB, token: string, now: number, ua: string, body: any, depo?: Depo) {
  const { ctx, akis } = await baglantiCtx(db, token, now, ua, depo);
  const b = govdeAl(body);
  const no = Number(b.no);
  if (!no) throw new ApiHata(400, "no gerekli.");
  const metin = b.metin != null ? String(b.metin).slice(0, 4000) : "";
  const a: any = { akis: akis.kisa_kod, no, kim_tip: "insan", arac: "Devir bağlantı" };
  if (b.eylem === "basladim") a.durum = "suruyor";
  else if (b.eylem === "tamam") { a.durum = "tamam"; if (metin) a.not = metin; }
  else if (b.eylem === "engel") { if (!metin) throw new ApiHata(400, "Ne bekliyorsun? Engeli kısaca yaz."); a.durum = "engelli"; a.engel = metin; }
  else if (b.eylem === "not") { if (!metin && !b.cikti) throw new ApiHata(400, "Not yaz ya da dosya ekle."); if (metin) a.not = metin; }
  else throw new ApiHata(400, "eylem: basladim, tamam, engel ya da not olmalı.");
  if (b.cikti && typeof b.cikti === "object" && b.cikti.dosya) a.cikti = await dosyaCiktilari(ctx, akis.id, no, { dosya: String(b.cikti.dosya), ad: b.cikti.ad ? String(b.cikti.ad).slice(0, 120) : undefined, ozet: b.cikti.ozet ? String(b.cikti.ozet).slice(0, 1000) : null });
  else if (b.cikti && typeof b.cikti === "object") a.cikti = { ad: String(b.cikti.ad || "Ek").slice(0, 120), url: b.cikti.url ? String(b.cikti.url).slice(0, 1000) : null, ozet: b.cikti.ozet ? String(b.cikti.ozet).slice(0, 1000) : null, icerik: b.cikti.icerik ? String(b.cikti.icerik).slice(0, 20000) : null };
  let mesaj: string;
  try { mesaj = await callTool("devir_adim_guncelle", a, ctx); } catch (e) { throw new ApiHata(400, (e as Error).message); }
  return { mesaj: mesaj.split("\n")[0], ...(await baglantiV(db, token, now, ua)) };
}

// dış katılımcı dosyası: kendi adımına yükleme adresi ve görebildiği dosyayı indirme
export async function baglantiDosya(db: DB, token: string, now: number, ua: string, method: string, id: string | undefined, body: any, depo?: Depo) {
  const { ctx, akis } = await baglantiCtx(db, token, now, ua, depo);
  if (method === "POST" && !id) { const b = govdeAl(body); return yuklemeIste(ctx, akis.id, Number(b.no), b); }
  if (method === "GET" && id) return indir(ctx, id, akis.id);
  throw new ApiHata(404, "Böyle bir uç yok.");
}
