// 0.32.0 (5 Kas, plan metodolojisi P1 + P2): motor eşitliği ve tek plan sözleşmesi.
import { anthropicLlm, openaiLlm, yedekli, motorDurumu, devreSifirla, MotorHata, YANIT_SINIRI } from "../llm.ts";
import { callTool } from "../core.ts";

let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-11-05T09:00:00+03:00");
const DEF: Record<string, any> = { adim: { durum: "sirada", ciktilar: [], oto: false, oto_deneme: 0 }, akis: { durum: "aktif", kurallar: {}, baglam: {} }, taslak: { durum: "acik" } };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? JSON.parse(JSON.stringify(r)) : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => JSON.parse(JSON.stringify(r))); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, updated_at: now, durum_at: now, ...(DEF[t] || {}), ...r })); T[t].push(...out); return out.map((r) => JSON.parse(JSON.stringify(r))); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, JSON.parse(JSON.stringify(p))); },
};
let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };
const hata = async (f: () => Promise<unknown>) => { try { await f(); return ""; } catch (e) { return (e as Error).message; } };

const taslak = () => ({
  is_turu: { kod: "kahve", ad: "Kahveci açılışı", mevcut: false }, baslik: "Nokta Kahve açılışı", kisa_ad: "Nokta Kahve açılışı", anahtar_varlik: { tur: "sirket", ad: "Nokta Kahve" },
  roller: [{ kod: "ben", ad: "Kurucu", tip: "insan", kisi: "Berkin" }, { kod: "ag", ad: "Berkin'in Claude'u", tip: "agent", kisi: "Berkin'in Claude'u", destek: "Berkin" }],
  sorular: [], varsayimlar: [],
  adimlar: [
    { id: "a1", tur_kod: "rakip", ad: "Rakip kahvecileri analiz et", sahip_rol: "ag", kriter: "tablo hazır", sure_tahmin_gun: 1, bagimli: [], boyut: "girdi", karar_gerekli: false, cikti_bekleniyor: true },
    { id: "a2", tur_kod: "ruhsat", ad: "İşyeri açma ruhsatı başvurusunu yap", sahip_rol: "ben", kriter: "başvuru numarası", sure_tahmin_gun: 2, bagimli: ["a1"], boyut: "kapi", karar_gerekli: false, cikti_bekleniyor: true, dayanak: ["K:isyeri-ruhsati"] },
    { id: "a3", tur_kod: "butce-karar", ad: "Açılış bütçesine karar ver", sahip_rol: "ben", kriter: "bütçe belli", sure_tahmin_gun: 1, bagimli: ["a1"], boyut: "karar", karar_gerekli: true, karar_kriteri: "bütçe", cikti_bekleniyor: false },
  ],
});
const llm = async (req: any) => {
  if (req.tool.name === "taslak_yaz") return { input: taslak(), model: "sahte", ms: 10 };
  if (req.tool.name === "denetim_yaz") return { input: { bagimlilik: [], adim_ekle: [], soru_ekle: [], notlar: [] }, model: "sahte-denetci", ms: 5 };
  throw new Error("bilinmeyen araç " + req.tool.name);
};
const ws = { id: "w-0320" }, key = { id: "k1", kisi: "Berkin", rol: "sahip" };
const ctx = () => ({ db, ws, key, ua: "Claude-User", now: (NOW += 6e4), kanal: "mcp", llm }) as any;
const akisOf = (kod: string) => T.akis.find((a) => a.kisa_kod === kod);
const adimlar = (kod: string) => T.adim.filter((s) => s.akis_id === akisOf(kod).id).sort((a, b) => a.no - b.no);

(async () => {
  // ---------- P1: motor eşitliği ----------
  const istekler: any[] = [];
  const f0 = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: any) => {
    const b = JSON.parse(init.body); istekler.push({ url, b });
    if (String(url).includes("anthropic")) return new Response(JSON.stringify({ model: b.model, content: [{ type: "tool_use", name: b.tools[0].name, input: { x: 1 } }], usage: {} }), { status: 200 });
    return new Response(JSON.stringify({ model: b.model, choices: [{ message: { tool_calls: [{ function: { name: b.tools[0].function.name, arguments: "{\"x\":1}" } }] } }], usage: {} }), { status: 200 });
  }) as any;
  const arac = { name: "taslak_yaz", description: "", input_schema: { type: "object" } };
  await anthropicLlm("k", "claude-sonnet-5-5")({ system: "s", user: "u", tool: arac });
  await openaiLlm("k", { taslak: "gpt-4.1", hizli: "gpt-4.1-mini" })({ system: "s", user: "u", tool: arac });
  ok("M1 (0.32.1): Claude'da tool_choice auto + tek çağrı (zorunlu tool Sonnet 5.5'te 400)", istekler[0].b.tool_choice?.type === "auto" && istekler[0].b.tool_choice?.disable_parallel_tool_use === true && /taslak_yaz aracını tek kez çağırarak/.test(JSON.stringify(istekler[0].b.system)), istekler[0].b.tool_choice);
  ok("M2: iki motorda aynı yanıt sınırı (16.000)", istekler[0].b.max_tokens === YANIT_SINIRI && istekler[1].b.max_completion_tokens === YANIT_SINIRI, [istekler[0].b.max_tokens, istekler[1].b.max_completion_tokens]);
  await openaiLlm("k", { taslak: "gpt-4.1", hizli: "gpt-4.1-mini" })({ system: "s", user: "u", tool: arac, max_tokens: 2500 });
  ok("M2: küçük çağrının sınırı korunur (denetçi 2500)", istekler[2].b.max_completion_tokens === 2500, istekler[2].b.max_completion_tokens);
  // kredi hatası kalıcıdır
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: "Your credit balance is too low to access the Anthropic API." } }), { status: 400 })) as any;
  const e = await anthropicLlm("k", "m")({ system: "s", user: "u", tool: arac }).catch((x) => x);
  ok("M7: kredi hatası kalıcı motor hatası", e instanceof MotorHata && e.kalici === true, String(e));
  globalThis.fetch = f0;

  // yedekli: kalıcı hata → devre açılır, sonraki istek birincili hiç denemez
  devreSifirla();
  let t = 1_000_000, bir = 0, yed = 0;
  const birincil = async () => { bir++; throw new MotorHata("Taslak motoruna ulaşılamadı (400 credit balance).", true); };
  const yedek = async () => { yed++; return { input: {}, model: "openai:gpt-4.1", ms: 1 }; };
  const r1 = await yedekli(birincil as any, yedek as any, () => {}, () => t)!({ system: "", user: "", tool: arac });
  ok("yedeğe geçer ve model alanı birincilin hatasını taşır", /\(yedek; birincil: .*credit/.test(r1.model), r1.model);
  ok("M7: devre açıldı", motorDurumu(t).devre_acik === true, motorDurumu(t));
  await yedekli(birincil as any, yedek as any, () => {}, () => t + 5 * 6e4)!({ system: "", user: "", tool: arac });
  ok("M7: devre açıkken birincil denenmez", bir === 1 && yed === 2, { bir, yed });
  t += 61 * 6e4;
  await yedekli(birincil as any, yedek as any, () => {}, () => t)!({ system: "", user: "", tool: arac });
  ok("M7: 1 saat sonra birincil yeniden denenir", bir === 2, { bir });
  // geçici hata: aynı istekte sonraki çağrılar yedekte kalır (M5); devre açılmaz
  devreSifirla(); bir = 0; yed = 0;
  const gecici = async () => { bir++; throw new MotorHata("Taslak motoruna ulaşılamadı (süre doldu).", false); };
  const istek = yedekli(gecici as any, yedek as any, () => {}, () => t)!;
  await istek({ system: "", user: "", tool: arac }); await istek({ system: "", user: "", tool: arac });
  ok("M5: bir istekte motor bir kez seçilir (taslak ve denetim aynı sağlayıcı)", bir === 1 && yed === 2, { bir, yed });
  ok("M5: geçici hatada devre açılmaz", motorDurumu(t).devre_acik === false);
  devreSifirla();

  // ---------- P2: tek plan sözleşmesi ----------
  const tm = await callTool("devir_tasla", { cumle: "Nokta Kahve'yi açacağım", baglam: { varlik: "Nokta Kahve", iliski: "kendi" } }, ctx());
  const kod = /Taslak (T\w+)/.exec(tm)![1];
  ok("M5: denetimi yapan motor taslakta kayıtlı", T.taslak.find((x) => x.kisa_kod === kod).taslak._denetim_model === "sahte-denetci");
  // ajan taslağı baştan yazıyor: ruhsat adımını unutuyor, kararı agent'a veriyor, yeni bir adım ekliyor
  const m = await callTool("devir_akis_olustur", { taslak: kod, adimlar: [
    { ad: "Rakip kahvecileri analiz et", sahip: "Berkin'in Claude'u", sahip_tip: "agent", kriter: "tablo", cikti_bekleniyor: true },
    { ad: "Açılış bütçesine karar ver", sahip: "Berkin'in Claude'u", sahip_tip: "agent", kriter: "bütçe", karar_gerekli: true, bagimli: [1] },
    { ad: "Menü fotoğraflarını çek", sahip: "Berkin", kriter: "10 fotoğraf", bagimli: [1] },
  ] }, ctx());
  const ak = /oluşturuldu: (\w+)/.exec(m)?.[1];
  ok("taslak + kendi adımlarla kurulur (karar agent'ta olsa da hata yok)", !!ak, m.slice(0, 300));
  const A = adimlar(ak!);
  ok("P2: karta dayanan ruhsat adımı eklendi", A.some((s) => /ruhsat/i.test(s.ad)), A.map((s) => s.ad));
  const ruh = A.find((s) => /ruhsat/i.test(s.ad));
  ok("P2: eklenen adımın bağımlılığı adla eşlendi (rakip analizi)", ruh && ruh.bagimli.includes(A.find((s) => /Rakip/.test(s.ad)).no), ruh?.bagimli);
  ok("P2: karar adımının sahibi kullanıcı yapıldı", A.find((s) => /bütçe/i.test(s.ad))?.sahip_tip === "insan");
  ok("P2: çıktı kullanıcıya eklenen işi söyler", /derslerine ya da bilgi kartlarına dayanan 1 iş yoktu/.test(m), m);
  const fark = akisOf(ak!).baglam.taslak_fark;
  ok("P2: taslak farkı kaydedildi", fark && fark.taslak_adim === 3 && fark.eklenen.includes("Menü fotoğraflarını çek") && fark.devir_ekledi === 1, fark);
  ok("P2: kurulum türü taslak_elle", akisOf(ak!).baglam.kurulum === "taslak_elle");
  // taslaksız elle kurulum uyarır
  const m2 = await callTool("devir_akis_olustur", { baslik: "Depo düzeni", adimlar: [{ ad: "Rafları say", sahip: "Berkin", kriter: "sayıldı" }] }, ctx());
  ok("D yolu: taslaksız kurulumda uyarı", /Taslaksız kuruldu/.test(m2), m2.slice(0, 400));
  ok("D yolu: kurulum türü elle", akisOf(/oluşturuldu: (\w+)/.exec(m2)![1]).baglam.kurulum === "elle");
  // taslak yolu (asıl yol) değişmedi
  const tm2 = await callTool("devir_tasla", { cumle: "Mavi Fırın açılışı", baglam: { varlik: "Mavi Fırın", iliski: "kendi" } }, ctx());
  const m3 = await callTool("devir_akis_olustur", { taslak: /Taslak (T\w+)/.exec(tm2)![1] }, ctx());
  ok("asıl yol uyarısız kurulur", /oluşturuldu/.test(m3) && !/Taslaksız/.test(m3), m3.slice(0, 200));
  void hata;
  console.log(hata0 ? `\n${hata0} test başarısız` : "\n0.32.0 testleri geçti");
  if (hata0) process.exit(1);
})();
