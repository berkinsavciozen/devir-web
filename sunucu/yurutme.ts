/**
 * 0.33.0 (5 Kas, plan metodolojisi P3 + P4): yürütme tasarımı ve inceleme döngüsü.
 * Plan artık yalnız "hangi işler, hangi sırayla" değil; her adımda kimin yaptığı, AI'ın payı, insanın hangi anda ve
 * hangi biçimde devreye girdiği de planda. Model alanları doldurur; boş ya da tutarsız olanı sunucu kuralla düzeltir.
 * Saf işlevler: core.ts ve tasarim.ts'ten çağrılır, kendisi hiçbirini içe aktarmaz.
 */

export const YURUTME = ["ai_yapar", "ai_hazirlar_insan_bitirir", "insan", "dis"] as const;
export const INCELEME = ["yok", "hizli_onay", "yorumlu_inceleme"] as const;
export const KARAR_TUR = ["secim", "coklu_secim", "onay_red", "tutar_tarih", "serbest"] as const;
export type Yurutme = (typeof YURUTME)[number];
export type Inceleme = (typeof INCELEME)[number];
export type KararTur = (typeof KARAR_TUR)[number];

/** core.ts DIS_FIIL ile aynı: dışarıya gönderme, yayın, başvuru, ödeme, imza. */
const DIS = /gönder(?!i)|ilet(?:\s|$|il)|yayınla|yayımla|paylaş|postala|başvur|sipariş\s*ver|satın\s*al|transfer|imzala|öde(?:\s|$|meyi|mesini)/i;
const PARA_IMZA = /öde(?:\s|$|meyi|mesini)|ödemeyi|imzala|sözleşme|teklifi\s*(kabul|onayla)|bütçe|tutar|fiyat/i;
const ONAY_AD = /onayla|onay\s*ver|kabul\s*et|reddet|izin\s*ver|imzala/i;
const SECIM_AD = /seç(?:\s|$|im|ilecek)|belirle|karar\s*ver|kararlaştır/i;
const TUTAR_TARIH_AD = /tutar|bütçe|fiyat|tarih|gün(ü|ünü)\s*belirle|ücret/i;
const KONTROL_AD = /kontrol\s*et|gözden\s*geçir|incele|onayla|onay\s*ver|son\s*halini\s*ver/i;

const gecerli = <T extends string>(liste: readonly T[], v: unknown): T | null => (liste as readonly string[]).includes(String(v)) ? (v as T) : null;

/** Seçenek listesi: dizi ya da "A / B" metni; en çok 6, tekil, boşsuz. */
export function secenekler(v: unknown): string[] {
  const ham = Array.isArray(v) ? v.map((x: any) => (typeof x === "string" ? x : x?.ad ?? x?.etiket ?? "")) : typeof v === "string" ? v.split(/\s*(?:\/|;|\|)\s*/) : [];
  const out: string[] = [];
  for (const x of ham) { const t = String(x || "").trim().slice(0, 80); if (t && !out.some((y) => y.toLowerCase() === t.toLowerCase())) out.push(t); }
  return out.slice(0, 6);
}

export interface YurutmeAlanlari { yurutme: Yurutme; inceleme: Inceleme; karar_tur: KararTur | null; karar_secenekleri: string[] }

/**
 * Bir adımın yürütme alanları. s: { ad, sahip_tip, yurutme?, inceleme?, karar_tur?, karar_secenekleri?, cikti_bekleniyor? }; karar: adım karar adımı mı.
 * Kurallar: sahip türü yürütmeyi sınırlar (agent → AI, dış → dis, insan → insan ya da AI hazırlar); inceleme yalnız AI işinde anlamlıdır;
 * karar türü yalnız karar adımında olur. Dışarıya giden, para ve imza işinde AI hazırlar, insan bitirir; incelemesi yorumludur.
 */
export function yurutmeDoldur(s: any, karar: boolean): YurutmeAlanlari {
  const ad = String(s?.ad || "");
  const tip = s?.sahip_tip === "agent" ? "agent" : s?.sahip_tip === "dis" ? "dis" : "insan";
  let y = gecerli(YURUTME, s?.yurutme);
  if (tip === "agent") y = y === "ai_yapar" || y === "ai_hazirlar_insan_bitirir" ? y : DIS.test(ad) || karar ? "ai_hazirlar_insan_bitirir" : "ai_yapar";
  else if (tip === "dis") y = "dis";
  else y = y === "ai_hazirlar_insan_bitirir" ? y : "insan";
  if (tip === "agent" && y === "ai_yapar" && DIS.test(ad)) y = "ai_hazirlar_insan_bitirir";
  // inceleme: AI'ın yaptığı işte insanın ne yapacağı
  let inc = gecerli(INCELEME, s?.inceleme);
  if (tip !== "agent") inc = "yok";
  else if (y === "ai_hazirlar_insan_bitirir" || PARA_IMZA.test(ad) || DIS.test(ad)) inc = "yorumlu_inceleme";
  else if (!inc) inc = s?.cikti_bekleniyor === false ? "yok" : "hizli_onay";
  // karar türü ve seçenekler
  const sec = secenekler(s?.karar_secenekleri);
  let kt = karar ? gecerli(KARAR_TUR, s?.karar_tur) : null;
  if (karar && !kt) kt = sec.length >= 2 ? "secim" : ONAY_AD.test(ad) || DIS.test(ad) ? "onay_red" : TUTAR_TARIH_AD.test(ad) ? "tutar_tarih" : SECIM_AD.test(ad) ? "secim" : "serbest";
  if (kt && kt !== "secim" && kt !== "coklu_secim") return { yurutme: y, inceleme: inc, karar_tur: kt, karar_secenekleri: [] };
  return { yurutme: y, inceleme: inc, karar_tur: kt, karar_secenekleri: kt ? sec : [] };
}

export const YURUTME_AD: Record<Yurutme, string> = { ai_yapar: "AI yapar", ai_hazirlar_insan_bitirir: "AI hazırlar, insan bitirir", insan: "", dis: "dış" };
export const INCELEME_AD: Record<Inceleme, string> = { yok: "", hizli_onay: "hızlı onay", yorumlu_inceleme: "yorumlu inceleme" };
export const KARAR_TUR_AD: Record<KararTur, string> = { secim: "seçim", coklu_secim: "çoklu seçim", onay_red: "onay/red", tutar_tarih: "tutar/tarih", serbest: "serbest karar" };
/** Kullanıcının zamanı (tahmin, dakika): karar anı ve AI çıktısına bakış başına. */
export const DK: Record<string, number> = { secim: 5, coklu_secim: 5, onay_red: 3, tutar_tarih: 5, serbest: 10, hizli_onay: 3, yorumlu_inceleme: 10 };
export const KARAR_ANI_SINIRI = 5;

/**
 * Taslağın insan payı (K2 plan özeti): kişinin karar anları ve AI çıktısına bakışları, tahmini dakika; AI'ın ve kişinin işleri.
 * adimlar: taslak adımları (sahip_rol ile) ya da kurulmuş adımlar; rolOf: adımın sahip türü ve kişisi.
 */
export function insanPayi(adimlar: any[], rolOf: (x: any) => { tip: string; kisi: string | null }, kisi: string) {
  const ben = (k: string | null) => !k || k.toLocaleLowerCase("tr") === kisi.toLocaleLowerCase("tr");
  let karar = 0, bakis = 0, dk = 0, ai = 0, senin = 0, dis = 0;
  // koşullu dallar birbirini dışlar: aynı sorunun dallarından en kalabalığı sayılır
  const dal = new Map<string, Map<string, any[]>>();
  const kosulsuz: any[] = [];
  for (const x of adimlar) {
    const k = x.kosul?.soru || x._kosul?.soru;
    if (!k) { kosulsuz.push(x); continue; }
    const d = String(x.kosul?.deger ?? x._kosul?.deger ?? "");
    if (!dal.has(k)) dal.set(k, new Map());
    const m = dal.get(k)!; m.set(d, [...(m.get(d) || []), x]);
  }
  const say = [...kosulsuz, ...[...dal.values()].flatMap((m) => [...m.values()].sort((a, b) => b.length - a.length)[0] || [])];
  for (const x of say) {
    const r = rolOf(x);
    if (r.tip === "agent") { ai++; if (ben(r.kisi) && x.inceleme && x.inceleme !== "yok") { bakis++; dk += DK[x.inceleme] || 0; } continue; }
    if (r.tip === "dis") { dis++; continue; }
    if (!ben(r.kisi)) continue;
    if (x.karar_tur) { karar++; dk += DK[x.karar_tur] || 5; } else senin++;
  }
  return { karar, bakis, dk, ai, senin, dis };
}

/**
 * İlke 35 (sunucu garantisi): agent adımının hemen ardından gelen ve yalnız "kontrol et / gözden geçir / onayla" diyen insan adımı
 * ayrı adım olmaz; agent adımının incelemesi olur. Para, imza ve dışarıya gönderme kararı, alt görevi, dayanağı ya da
 * sonradan cevaplanan sorusu olan adım katlanmaz. Taslak adımları (id, sahip_rol) üzerinde çalışır; t yerinde değişir.
 */
export function kontrolKatla(t: any): string[] {
  const A: any[] = Array.isArray(t?.adimlar) ? t.adimlar : [];
  const rol = new Map<string, any>((t?.roller || []).map((r: any) => [r.kod, r]));
  const tipOf = (x: any) => rol.get(x?.sahip_rol)?.tip || "insan";
  const cevaplayan = new Set((t?.sorular || []).map((q: any) => String(q?.cevaplayan_adim || "")).filter(Boolean));
  const notlar: string[] = [];
  for (const x of [...A]) {
    if (tipOf(x) === "agent" || tipOf(x) === "dis") continue;
    const ad = String(x.ad || "");
    if (!KONTROL_AD.test(ad) || PARA_IMZA.test(ad) || DIS.test(ad)) continue;
    if (x.karar_tur === "secim" || x.karar_tur === "coklu_secim" || x.karar_tur === "tutar_tarih" || secenekler(x.karar_secenekleri).length >= 2) continue;
    if ((x.dayanak || []).length || cevaplayan.has(String(x.id)) || A.some((y) => String(y.ust || "") === String(x.id)) || x.tarih_capasi) continue;
    const dep = (x.bagimli || []).map(String);
    if (dep.length !== 1) continue;
    const once = A.find((y) => String(y.id) === dep[0]);
    if (!once || tipOf(once) !== "agent" || String(once.ust || "") !== String(x.ust || "")) continue;
    if (JSON.stringify(once.kosul || null) !== JSON.stringify(x.kosul || null)) continue;
    // katla: bekleyenler agent adımını bekler, agent adımı yorumlu incelenir
    for (const y of A) if ((y.bagimli || []).map(String).includes(String(x.id))) y.bagimli = [...new Set([...(y.bagimli || []).map(String).filter((d: string) => d !== String(x.id)), String(once.id)])];
    once.inceleme = "yorumlu_inceleme";
    if (!once.kriter && x.kriter) once.kriter = x.kriter;
    A.splice(A.indexOf(x), 1);
    notlar.push(`"${ad}" ayrı adım olmaktan çıktı; "${once.ad}" adımının incelemesi oldu (AI çıktısını sen yorumlu incelersin).`);
  }
  return notlar;
}

/** Karar ekonomisi: kişinin karar anı sınırı aşılıyorsa tek satır uyarı (karar silinmez; düzeltme kullanıcıda). */
export function kararEkonomisi(pay: { karar: number }): string | null {
  return pay.karar > KARAR_ANI_SINIRI ? `Bu planda senden ${pay.karar} karar bekleniyor (hedef en çok ${KARAR_ANI_SINIRI}). Aynı konudaki kararları birleştirmeyi ya da küçük onayları varsayıma çevirmeyi düşün.` : null;
}

// ---------- P4: inceleme döngüsü ----------
export const INCELEME_TUR_SINIRI = 4;
export const RED_NEDENLERI = ["Bilgi yanlış ya da eksik", "İstediğim bu değildi", "Kalite yetersiz"] as const;
export interface IncelemeKaydi { tur: "red" | "yorum"; metin: string; kim: string; tarih: string; cikti: string | null }

/** AI'a giden talimata eklenen geri bildirim bölümü: önceki deneme(ler) ve sahibin yorumları. */
export function geriBildirimSatirlari(gecmis: IncelemeKaydi[] | null | undefined): string[] {
  const L = (gecmis || []).filter((g) => g && g.metin);
  if (!L.length) return [];
  return [
    `Bu iş daha önce ${L.length} kez geri gönderildi. Önceki çıktını devir_adim_oku ile oku ve aşağıdaki geri bildirime göre YENİ bir sürüm yaz (cikti adına "sürüm ${L.length + 1}" ekle); eskisinin üstüne yazma:`,
    ...L.map((g, i) => `- ${i + 1}. ${g.tur === "red" ? "Reddedildi" : "Yorum"} (${g.kim}${g.cikti ? `, "${g.cikti}" için` : ""}): ${g.metin}`),
  ];
}
