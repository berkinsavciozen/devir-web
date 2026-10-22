// MK-5 (S-C2): açıklanabilir bitiş aralığı. Alt uç bugünkü hesap (herkes işlerini paralel yürütür, süreler olduğu gibi);
// üst uç aynı kişinin işlerini sırayla yapar, tahmin süreler uzayabilir, eksik süre birkaç gün sürebilir. Kimseye kapasite
// kuralı dayatılmaz; çakışan iş yalnız aralığı genişletir ve uyarı olarak görünür. Süreler eksikse kesin tarih üretilmez.
// MK-8: karar_ozeti, galaksi, Pano, Akışlar, Görevler, dış bağlantı ve MCP'nin aynı cümleyi göstermesi için tek kaynak.
import { DAY, DONE, eod, fmtD, kararAdimi, norm, timeline, todayIst } from "./core.ts";

export type Kaynak = "kullanici" | "tahmin" | "gecmis" | "eksik";
export type Guven = "kesin" | "tahmin" | "eksik";
export interface Yuk { kisi: string; adimlar: number[]; gecikme_gun: number }
export interface Bitis {
  en_erken: string | null; aralik: [string, string] | null; guven: Guven; eksik_sure: number;
  varsayimlar: string[]; yuk_uyarilari: Yuk[];
  adimlar: { no: number; kaynak: Kaynak; sure_gun: [number, number]; bitis: [string, string] }[];
  zincir: number[]; // üst ucu belirleyen zincir ("bu tarih neden")
}

export const EKSIK_UST_GUN = 3;
export const TAHMIN_CARPAN = 1.5;
const ts = (s: string) => Date.parse(s);
const gun1 = (x: number) => Math.round(x * 10) / 10;

/** Adımın süresi (gün): alt uç bugünkü hesapla aynı, üst uç kaynağa göre. gecmis: tür → gerçek/tahmin oranı. */
export function sureOf(s: any, gecmis?: Map<string, number>): { alt: number; ust: number; kaynak: Kaynak } {
  const g = Number(s.sure_tahmin_gun);
  if (s.sure_tahmin_gun == null || !isFinite(g) || g <= 0) return { alt: 1, ust: EKSIK_UST_GUN, kaynak: "eksik" };
  if (s.sure_kaynak === "kullanici") return { alt: g, ust: g, kaynak: "kullanici" };
  const oran = gecmis?.get(s.tur_kod || norm(s.ad));
  if (oran != null) return { alt: g, ust: g * Math.max(oran, 1), kaynak: "gecmis" };
  return { alt: g, ust: g * TAHMIN_CARPAN, kaynak: "tahmin" };
}

/** Kişi kimliği (agent'lar kapasite sayılmaz). */
const kisiOf = (s: any) => (s.sahip_tip === "agent" ? null : s.sahip_kisi_id || "ad:" + norm(s.sahip));

/**
 * Seri çizelge: uygun adımlardan (bağımlılıkları yerleşmiş) önce bitenler, sonra sürenler, sonra önceliği yüksek (bolluğu az)
 * olan yerleşir. kisitli(k) doğruysa o kişinin açık işleri sırayla yapılır. Kısıt yokken sonuç core.plan ile aynıdır.
 */
function cizelge(akis: any, steps: any[], tl: ReturnType<typeof timeline>, now: number, sure: (s: any) => number, kisitli: (k: string) => boolean, oncelik?: Map<number, number>) {
  const by = new Map<number, any>(steps.map((s) => [s.no, s]));
  const EF = new Map<number, number>(), prev = new Map<number, number | null>(), bos = new Map<string, number>();
  const t0 = ts(akis.created_at);
  const kalan = new Set<number>(steps.map((s) => s.no));
  const sira = (no: number) => (DONE(by.get(no)) ? 0 : by.get(no).durum === "suruyor" ? 1 : 2);
  while (kalan.size) {
    const uygun = [...kalan].filter((no) => (by.get(no).bagimli || []).every((d: number) => !by.has(d) || EF.has(d)));
    if (!uygun.length) throw new Error("Bağımlılıklarda döngü var.");
    uygun.sort((a, b) => sira(a) - sira(b) || (oncelik?.get(a) ?? 0) - (oncelik?.get(b) ?? 0) || a - b);
    const s = by.get(uygun[0]);
    let start = t0, p: number | null = null;
    for (const d of s.bagimli || []) { const e = EF.get(d); if (e != null && e >= start) { start = e; p = d; } }
    const r = tl.get(s.no)!;
    let f: number;
    if (DONE(s)) f = r.bitisAt ?? ts(s.durum_at);
    else {
      const k = kisiOf(s), kis = k != null && kisitli(k);
      let bas = Math.max(start, now, s.capa_tarih ? Date.parse(s.capa_tarih + "T00:00:00+03:00") - 6e4 : 0);
      if (kis && (bos.get(k!) ?? -Infinity) > bas) bas = bos.get(k!)!;
      f = bas + Math.max(sure(s) * DAY - r.aktif, 0.25 * DAY);
      if (kis) bos.set(k!, f);
    }
    EF.set(s.no, f); prev.set(s.no, p); kalan.delete(s.no);
  }
  let endNo: number | null = null, end = -Infinity;
  for (const [no, f] of EF) if (f > end) { end = f; endNo = no; }
  const chain: number[] = [];
  for (let x = endNo; x != null; x = prev.get(x) ?? null) chain.unshift(x);
  return { EF, chain, end };
}

/** Geç bitiş (alt süreyle, geriye doğru): bolluk = LF − EF; küçük bolluk önce yerleşir. */
function bolluk(steps: any[], EF: Map<number, number>, end: number, sure: (s: any) => number) {
  const LF = new Map<number, number>();
  const cocuk = new Map<number, number[]>();
  for (const s of steps) for (const d of s.bagimli || []) cocuk.set(d, [...(cocuk.get(d) || []), s.no]);
  const by = new Map<number, any>(steps.map((s) => [s.no, s]));
  const hesap = (no: number): number => {
    if (LF.has(no)) return LF.get(no)!;
    const c = cocuk.get(no) || [];
    const v = c.length ? Math.min(...c.map((x) => hesap(x) - (DONE(by.get(x)) ? 0 : sure(by.get(x)) * DAY))) : end;
    LF.set(no, v);
    return v;
  };
  const out = new Map<number, number>();
  for (const s of steps) out.set(s.no, hesap(s.no) - (EF.get(s.no) ?? end));
  return out;
}

/** Akışın bitiş aralığı ve dayanakları. Kapalı akışta kapanış günü, kesin. */
export function bitis(akis: any, steps: any[], events: any[], now: number, gecmis?: Map<string, number>): Bitis {
  if (akis.kapandi_at) { const g = todayIst(ts(akis.kapandi_at)); return { en_erken: g, aralik: [g, g], guven: "kesin", eksik_sure: 0, varsayimlar: [], yuk_uyarilari: [], adimlar: [], zincir: [] }; }
  if (!steps.length) return { en_erken: null, aralik: null, guven: "eksik", eksik_sure: 0, varsayimlar: ["Akışta adım yok."], yuk_uyarilari: [], adimlar: [], zincir: [] };
  const tl = timeline(steps, events, now);
  const S = new Map(steps.map((s) => [s.no, sureOf(s, gecmis)]));
  const alt = (s: any) => S.get(s.no)!.alt, ust = (s: any) => S.get(s.no)!.ust;
  const a = cizelge(akis, steps, tl, now, alt, () => false);
  const onc = bolluk(steps, a.EF, a.end, alt);
  const serbest = cizelge(akis, steps, tl, now, ust, () => false, onc);
  const u = cizelge(akis, steps, tl, now, ust, () => true, onc);
  const acik = steps.filter((s) => !DONE(s));
  // kişi yükü: aynı kişinin birden çok açık işi varsa, yalnız onun işleri sırayla yapılınca bitiş ne kadar kayıyor
  const kisiler = new Map<string, any[]>();
  for (const s of acik) { const k = kisiOf(s); if (k) kisiler.set(k, [...(kisiler.get(k) || []), s]); }
  const yuk: Yuk[] = [];
  for (const [k, xs] of kisiler) {
    if (xs.length < 2) continue;
    const e = cizelge(akis, steps, tl, now, ust, (x) => x === k, onc).end - serbest.end;
    if (e >= 0.5 * DAY) yuk.push({ kisi: xs[0].sahip, adimlar: xs.map((s) => s.no), gecikme_gun: Math.round(e / DAY) });
  }
  yuk.sort((x, y) => y.gecikme_gun - x.gecikme_gun || y.adimlar.length - x.adimlar.length);
  const say = (k: Kaynak) => acik.filter((s) => S.get(s.no)!.kaynak === k).length;
  const eksik = say("eksik"), tahmin = say("tahmin"), gecmisN = say("gecmis");
  const v: string[] = [];
  if (eksik) v.push(`${eksik} adımın süresi yok; her biri 1–${EKSIK_UST_GUN} gün sayıldı`);
  if (tahmin) v.push(`${tahmin} süre tahmin; en çok %${Math.round((TAHMIN_CARPAN - 1) * 100)} uzayabilir`);
  if (gecmisN) v.push(`${gecmisN} sürede benzer geçmiş işlerin gerçek süresi kullanıldı`);
  for (const y of yuk) v.push(`${y.kisi} aynı dönemde ${y.adimlar.length} iş taşıyor; sırayla yaparsa +${y.gecikme_gun} gün`);
  const guven: Guven = eksik ? "eksik" : tahmin || gecmisN || yuk.length ? "tahmin" : "kesin";
  return {
    en_erken: todayIst(a.end), aralik: [todayIst(a.end), todayIst(Math.max(u.end, a.end))], guven, eksik_sure: eksik, varsayimlar: v, yuk_uyarilari: yuk,
    adimlar: acik.map((s) => ({ no: s.no, kaynak: S.get(s.no)!.kaynak, sure_gun: [gun1(alt(s)), gun1(ust(s))] as [number, number], bitis: [todayIst(a.EF.get(s.no)!), todayIst(u.EF.get(s.no)!)] as [string, string] })),
    zincir: u.chain,
  };
}

/** deneyim.sapma kayıtlarından tür → gerçek/tahmin oranı (en az 2 örnek; ortanca). */
export function gecmisOranlari(deneyimler: any[]): Map<string, number> {
  const L = new Map<string, number[]>();
  for (const d of deneyimler) for (const x of d.sapma || []) {
    const k = x.tur_kod || (x.ad ? norm(x.ad) : null);
    if (!k || !(Number(x.tahmin) > 0) || !(Number(x.gercek) >= 0)) continue;
    L.set(k, [...(L.get(k) || []), Number(x.gercek) / Number(x.tahmin)]);
  }
  const out = new Map<string, number>();
  for (const [k, xs] of L) if (xs.length >= 2) { const s = [...xs].sort((a, b) => a - b); out.set(k, Math.round(s[Math.floor(s.length / 2)] * 100) / 100); }
  return out;
}

// ---------- karar özeti (MK-8) ----------
export interface KararOzeti {
  cumle: string;
  darbogaz: { no: number; ad: string; tur: "engel" | "karar" | "risk"; tuttugu: number; sahip: string } | null;
  kritik: { ilk_acik: { no: number; ad: string; sahip: string } | null; zincir: number[] };
  bitis: { en_erken: string | null; aralik: [string, string] | null; guven: Guven };
  hedef: { tarih: string; pay_gun: number; durum: "pay" | "riskte" | "geciyor" } | null;
  hamle: { no: number; ad: string; sahip: string; neden: string } | null;
}

function tuttugu(steps: any[], no: number): number {
  const g = new Set<number>(), q = [no];
  while (q.length) { const x = q.pop()!; for (const b of steps) if ((b.bagimli || []).includes(x) && !g.has(b.no) && !DONE(b)) { g.add(b.no); q.push(b.no); } }
  return g.size;
}
const kisaAd = (akis: any, s: any) => akis.baglam?.kisa_adlar?.[String(s.no)] || (s.ad.length <= 40 ? s.ad : s.ad.slice(0, s.ad.lastIndexOf(" ", 39)).replace(/[,;:]$/, "") + "…");
const gunFark = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);

/** "28–31 Eki", aynı günse "28 Eki". */
export function aralikMetni(ar: [string, string] | null): string {
  if (!ar) return "belirsiz";
  if (ar[0] === ar[1]) return fmtD(ar[0]);
  const [a, b] = [fmtD(ar[0]), fmtD(ar[1])];
  const ay = (x: string) => x.split(" ").slice(1).join(" ");
  return ay(a) === ay(b) ? `${a.split(" ")[0]}–${b}` : `${a} – ${b}`;
}

/**
 * Akışın karar özeti. dis=true iken başka adımların adları yazılmaz (sisli görünüm); yalnız bitiş, hedef ve
 * kişinin kendi adımının kritik yolda olup olmadığı. kapsam: dış kişinin görebildiği adım numaraları.
 */
export function kararOzeti(akis: any, steps: any[], b: Bitis, now: number, opts: { dis?: boolean; kapsam?: Set<number> } = {}): KararOzeti {
  const by = new Map<number, any>(steps.map((s) => [s.no, s]));
  const acik = steps.filter((s) => !DONE(s));
  const kararMi = (s: any) => (akis.kurallar || {}).karar_insanda !== false && kararAdimi(s);
  const enCok = (xs: any[]) => [...xs].sort((x, y) => tuttugu(steps, y.no) - tuttugu(steps, x.no) || x.no - y.no)[0];
  const engel = acik.filter((s) => s.durum === "engelli"), karar = acik.filter((s) => kararMi(s) && (s.durum === "hazir" || s.durum === "suruyor"));
  const ef = new Map(b.adimlar.map((x) => [x.no, x.bitis[1]]));
  const risk = acik.filter((s) => s.son_tarih && ef.get(s.no) && Date.parse(ef.get(s.no)!) > Date.parse(s.son_tarih));
  const db = engel.length ? { s: enCok(engel), tur: "engel" as const } : karar.length ? { s: enCok(karar), tur: "karar" as const } : risk.length ? { s: enCok(risk), tur: "risk" as const } : null;
  const ilk = b.zincir.map((no) => by.get(no)).find((s) => s && !DONE(s)) || null;
  const hedef = akis.hedef_tarih && b.aralik ? (() => {
    const pay = gunFark(akis.hedef_tarih, b.aralik![1]);
    return { tarih: akis.hedef_tarih, pay_gun: pay, durum: (pay >= 0 ? "pay" : eod(akis.hedef_tarih) >= Date.parse(b.aralik![0]) ? "riskte" : "geciyor") as "pay" | "riskte" | "geciyor" };
  })() : null;
  // sonraki en değerli hamle: takılanı çöz > kararı ver > kritik yoldaki sıradaki işi başlat > en çok tutan hazır iş
  const hazir = acik.filter((s) => s.durum === "hazir");
  const hamleS = db?.tur === "engel" || db?.tur === "karar" ? db.s : ilk && (ilk.durum === "hazir" || ilk.durum === "suruyor") ? ilk : hazir.length ? enCok(hazir) : null;
  const neden = !hamleS ? "" : db && db.s === hamleS && db.tur === "engel" ? `takıldı; ${tuttugu(steps, hamleS.no)} adımı tutuyor` : db && db.s === hamleS && db.tur === "karar" ? "karar bekliyor" : hamleS === ilk ? "kritik yolda; bitiş tarihini o belirliyor" : `${tuttugu(steps, hamleS.no)} adımı tutuyor`;
  const gor = (s: any) => !opts.dis || !!opts.kapsam?.has(s.no);

  const p: string[] = [];
  if (opts.dis) {
    const benimKritik = b.zincir.some((no) => opts.kapsam?.has(no) && !DONE(by.get(no)));
    if (benimKritik) p.push("Senin adımın kritik yolda");
  } else {
    if (db) p.push(db.tur === "engel" ? `Takılan: ${kisaAd(akis, db.s)}${tuttugu(steps, db.s.no) ? ` (${tuttugu(steps, db.s.no)} adımı tutuyor)` : ""}` : db.tur === "karar" ? `Karar bekleniyor: ${kisaAd(akis, db.s)}` : `Son tarihini kaçırabilir: ${kisaAd(akis, db.s)}`);
    const z = b.zincir.map((no) => by.get(no)).filter((s) => s && !DONE(s));
    if (z.length) p.push(`Kritik yol: ${z.slice(0, 3).map((s) => kisaAd(akis, s)).join(" → ")}${z.length > 3 ? " → …" : ""}`);
  }
  if (b.aralik) p.push(`${b.aralik[0] === b.aralik[1] ? "Bitiş" : "En erken"} ${aralikMetni(b.aralik)}${b.guven === "eksik" ? " (süresi eksik adım var)" : ""}`);
  if (hedef) p.push(hedef.durum === "pay" ? `hedefe ${hedef.pay_gun} gün pay` : hedef.durum === "riskte" ? "hedef aralığın içinde, riskte" : `hedef ${-gunFark(akis.hedef_tarih, b.aralik![0]) || 1} gün geçiyor`);
  return {
    cumle: p.join(" · "),
    darbogaz: db && gor(db.s) ? { no: db.s.no, ad: db.s.ad, tur: db.tur, tuttugu: tuttugu(steps, db.s.no), sahip: db.s.sahip } : null,
    kritik: { ilk_acik: ilk && gor(ilk) ? { no: ilk.no, ad: ilk.ad, sahip: ilk.sahip } : null, zincir: opts.dis ? [] : b.zincir },
    bitis: { en_erken: b.en_erken, aralik: b.aralik, guven: b.guven },
    hedef,
    hamle: hamleS && gor(hamleS) ? { no: hamleS.no, ad: hamleS.ad, sahip: hamleS.sahip, neden } : null,
  };
}

/** Kapalı ya da adımsız akış için boş özet yerine kısa cümle */
export function kapaliOzet(akis: any): KararOzeti {
  const g = akis.kapandi_at ? todayIst(ts(akis.kapandi_at)) : null;
  return { cumle: g ? `Kapandı · ${fmtD(g)}` : "Akışta adım yok", darbogaz: null, kritik: { ilk_acik: null, zincir: [] }, bitis: { en_erken: g, aralik: g ? [g, g] : null, guven: g ? "kesin" : "eksik" }, hedef: null, hamle: null };
}

/** Alanın geçmiş süre oranları (istek başına bir kez okunur). Deneyim tablosu yoksa ya da okunamazsa boş. */
const gecmisOnbellek = new WeakMap<object, Promise<Map<string, number>>>();
export function gecmisYukle(ctx: { db: any; ws: { id: string } }) {
  let p = gecmisOnbellek.get(ctx);
  if (!p) { p = ctx.db.many("deneyim", { ws_id: ctx.ws.id }, "id").then(gecmisOranlari).catch(() => new Map()); gecmisOnbellek.set(ctx, p!); }
  return p!;
}

/** Akış için bitiş + karar özeti (kapalı/adımsızda kısa özet). vis: isteyenin görebildiği adımlar. */
export function akisKarari(akis: any, steps: any[], events: any[], now: number, gecmis: Map<string, number> | undefined, opts: { dis?: boolean; vis?: any[] } = {}) {
  const b = bitis(akis, steps, events, now, gecmis);
  const k = akis.kapandi_at || !steps.length ? kapaliOzet(akis) : kararOzeti(akis, steps, b, now, { dis: opts.dis, kapsam: opts.dis ? new Set((opts.vis || []).map((s: any) => s.no)) : undefined });
  return { bitis: b, karar_ozeti: k };
}
