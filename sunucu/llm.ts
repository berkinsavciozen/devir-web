// Claude API ile yapısal çağrı: model yanıtını yalnızca verilen aracı çağırarak verir.
export type LlmTool = { name: string; description: string; input_schema: Record<string, unknown> };
/** Bir çağrının token kullanımı (0.28.0, P8): girdi (önbellek yazımı dahil), önbellekten okunan girdi, çıktı */
export type Kullanim = { girdi: number; onbellek: number; cikti: number };
export type LlmFn = (req: { system: string; user: string; tool: LlmTool; model?: string; max_tokens?: number }) => Promise<{ input: any; model: string; ms: number; kullanim?: Kullanim }>;
const anthropicKullanim = (u: any): Kullanim => ({ girdi: Number(u?.input_tokens || 0) + Number(u?.cache_creation_input_tokens || 0), onbellek: Number(u?.cache_read_input_tokens || 0), cikti: Number(u?.output_tokens || 0) });
const openaiKullanim = (u: any): Kullanim => { const o = Number(u?.prompt_tokens_details?.cached_tokens || 0); return { girdi: Number(u?.prompt_tokens || 0) - o, onbellek: o, cikti: Number(u?.completion_tokens || 0) }; };

// Edge fonksiyonun duvar saati sınırı 150 sn; her motor bunun içinde kalmalı ki yedek devreye girebilsin.
const SINIR_MS = 110_000;
/** 0.32.0 (P1, M2): iki motorda aynı yanıt sınırı. Çağıran daha küçük verirse (denetçi, ders) o kullanılır. */
export const YANIT_SINIRI = 16_000;
/** Kalıcı motor hatası (kredi, anahtar, yetki): beklemekle düzelmez; devre kesici bunu bekler. */
export class MotorHata extends Error { constructor(m: string, public kalici = false) { super(m); } }
export const kalici = (durum: number, metin: string) => durum === 401 || durum === 403 || /credit balance|billing|insufficient_quota|exceeded your current quota|invalid.*api.?key/i.test(metin);
async function zamanli(url: string, init: RequestInit, kalan: number) {
  if (kalan < 5_000) throw new Error("süre doldu");
  try { return await fetch(url, { ...init, signal: AbortSignal.timeout(kalan) }); }
  catch (e) { throw new Error((e as Error).name === "TimeoutError" ? "süre doldu" : (e as Error).message); }
}

export function anthropicLlm(apiKey: string, defaultModel: string, sinirMs = SINIR_MS): LlmFn {
  return async ({ system, user, tool, model, max_tokens }) => {
    const t0 = Date.now();
    const m = model || defaultModel;
    let lastErr = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try { res = await zamanli("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          // 0.32.1: Sonnet 5.5 / Opus 5.5 zorunlu tool_choice'u (tool/any) 400 ile reddediyor. auto + tek çağrı + istem talimatı;
          // araç çağrılmazsa döngü bir kez daha dener. Yanıt sınırı iki motorda aynı (16.000).
          model: m, max_tokens: max_tokens || YANIT_SINIRI,
          system: [{ type: "text", text: system + `\n\nYanıtını yalnızca ${tool.name} aracını tek kez çağırarak ver; düz metin yazma.`, cache_control: { type: "ephemeral" } }],
          tools: [tool], tool_choice: { type: "auto", disable_parallel_tool_use: true },
          messages: [{ role: "user", content: user }],
        }),
      }, sinirMs - (Date.now() - t0)); } catch (e) { lastErr = (e as Error).message; break; }
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) { lastErr = `${res.status} ${data?.error?.message || ""}`; if (res.status >= 500 || res.status === 429) continue; throw new MotorHata(`Taslak motoruna ulaşılamadı (${lastErr}).`, kalici(res.status, lastErr)); }
      const block = (data.content || []).find((c: any) => c.type === "tool_use" && c.name === tool.name);
      if (block) return { input: fixJson(block.input), model: data.model || m, ms: Date.now() - t0, kullanim: anthropicKullanim(data.usage) };
      lastErr = data.stop_reason === "max_tokens" ? "yanıt sınırı aşıldı" : "model aracı çağırmadı";
    }
    throw new Error(`Taslak motoruna ulaşılamadı (${lastErr}).`);
  };
}

// OpenAI (Chat Completions, function calling). Claude model adları gelirse kendi modelleriyle eşlenir.
// gpt-5 ve o-serisi akıl yürütme modelleri: taslakta düşük, hızlı işlerde en az çaba (süre sınırı için)
const AKIL = /^(gpt-5|o\d)/i;
export function openaiLlm(apiKey: string, modeller: { taslak: string; hizli: string; yedek?: string[] }, sinirMs = SINIR_MS): LlmFn {
  return async ({ system, user, tool, model, max_tokens }) => {
    const t0 = Date.now();
    const hizli = !!model && /haiku|mini|hizli/i.test(model);
    const adaylar = [...new Set([model && !/^claude/i.test(model) ? model : hizli ? modeller.hizli : modeller.taslak, ...(modeller.yedek || [])].filter(Boolean) as string[])];
    let lastErr = "";
    for (const m of adaylar) {
      for (let attempt = 0; attempt < 2; attempt++) {
        let res: Response;
        try { res = await zamanli("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: m, max_completion_tokens: AKIL.test(m) ? Math.max(max_tokens || YANIT_SINIRI, YANIT_SINIRI) : max_tokens || YANIT_SINIRI, // akıl yürüten model düşünmeye de token harcar
            ...(AKIL.test(m) ? { reasoning_effort: hizli ? "minimal" : "low" } : {}),
            messages: [{ role: "system", content: system + `\n\nYanıtını yalnızca ${tool.name} fonksiyonunu tek kez çağırarak ver; düz metin yazma.` }, { role: "user", content: user }],
            tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }],
            tool_choice: { type: "function", function: { name: tool.name } },
          }),
        }, sinirMs - (Date.now() - t0)); } catch (e) { throw new Error(`OpenAI yanıt vermedi (${m}: ${(e as Error).message}).`); }
        const data: any = await res.json().catch(() => ({}));
        if (!res.ok) {
          lastErr = `${m}: ${res.status} ${data?.error?.message || ""}`;
          if (res.status === 404 || data?.error?.code === "model_not_found") break; // sıradaki modele geç
          if (res.status >= 500 || res.status === 429) continue;
          throw new MotorHata(`OpenAI yanıt vermedi (${lastErr}).`, kalici(res.status, lastErr));
        }
        const call = data.choices?.[0]?.message?.tool_calls?.find((c: any) => c.function?.name === tool.name);
        if (call) { try { return { input: fixJson(JSON.parse(call.function.arguments)), model: "openai:" + (data.model || m), ms: Date.now() - t0, kullanim: openaiKullanim(data.usage) }; } catch { lastErr = `${m}: araç çıktısı JSON değil`; continue; } }
        lastErr = `${m}: ${data.choices?.[0]?.finish_reason === "length" ? "yanıt sınırı aşıldı" : "fonksiyon çağrılmadı"}`;
      }
    }
    throw new Error(`OpenAI yanıt vermedi (${lastErr}).`);
  };
}

// Birincil motor hata verirse (kredi, kesinti, aşırı yük) yedeğe düşer; hangi motorun kullanıldığı model alanında görünür.
// 0.32.0 (P1):
// - M4: yedeğe geçiş eşiği 40 sn yerine 60 sn; kalıcı hata (kredi, anahtar) hemen geçer.
// - M5: bir istek içinde motor bir kez seçilir. Birincil düştüyse aynı istekteki sonraki çağrılar (denetçi, ders) doğrudan yedeğe gider;
//   böylece taslak ve denetim aynı sağlayıcıdan gelir. yedekli() her istek için yeniden kurulur.
// - M7: kalıcı hatada devre kesici 1 saat açılır; o süre birincil hiç denenmez (her taslakta boşuna kredi hatası yok). Durum motorDurumu()'nda.
export const DEVRE_MS = 60 * 6e4;
const devre: { acik_bitis: number; son_hata: string | null; son_hata_at: number | null; yedek_sayisi: number } = { acik_bitis: 0, son_hata: null, son_hata_at: null, yedek_sayisi: 0 };
export const motorDurumu = (now = Date.now()) => ({ devre_acik: devre.acik_bitis > now, devre_bitis: devre.acik_bitis > now ? new Date(devre.acik_bitis).toISOString() : null, son_hata: devre.son_hata, son_hata_at: devre.son_hata_at ? new Date(devre.son_hata_at).toISOString() : null, yedek_sayisi: devre.yedek_sayisi });
export const devreSifirla = () => { devre.acik_bitis = 0; devre.son_hata = null; devre.son_hata_at = null; devre.yedek_sayisi = 0; };
export function yedekli(birincil: LlmFn | undefined, yedek: LlmFn | undefined, uyar: (e: string) => void = () => {}, saat: () => number = Date.now): LlmFn | undefined {
  if (!birincil) return yedek;
  if (!yedek) return birincil;
  let dustu: string | null = null; // bu istekte birincil düştü mü
  return async (req) => {
    const t0 = saat();
    if (dustu || devre.acik_bitis > t0) {
      const neden = dustu || `devre açık: ${devre.son_hata || "kalıcı hata"}`;
      const r = await yedek(req);
      devre.yedek_sayisi++;
      return { ...r, model: `${r.model} (yedek; birincil: ${neden.slice(0, 120)})` };
    }
    try { return await birincil(req); }
    catch (e) {
      const m = String((e as Error).message);
      uyar(m);
      devre.son_hata = m.slice(0, 300); devre.son_hata_at = t0;
      if ((e as MotorHata).kalici) devre.acik_bitis = t0 + DEVRE_MS;
      if (!(e as MotorHata).kalici && saat() - t0 > 60_000) throw e; // birincil çok zaman yedi; yedeğe süre kalmadı
      dustu = m;
      const r = await yedek(req);
      devre.yedek_sayisi++;
      return { ...r, model: `${r.model} (yedek; birincil: ${m.slice(0, 120)})` };
    }
  };
}

// model bazen iç içe alanları JSON metni olarak verir; çöz
function fixJson(v: any): any {
  if (typeof v === "string") { const t = v.trim(); if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) { try { return fixJson(JSON.parse(t)); } catch { return v; } } return v; }
  if (Array.isArray(v)) return v.map(fixJson);
  if (v && typeof v === "object") { const o: any = {}; for (const k of Object.keys(v)) o[k] = fixJson(v[k]); return o; }
  return v;
}

// ---------- Devir AI sohbeti (0.28.0, P8) ----------
// Araçlı çok turlu sohbet. Döngü her motorun kendi mesaj biçimiyle sunucu içinde döner; geçmiş yalnız düz metin taşır.
export type SohbetIstek = {
  system: string;
  gecmis: { rol: "user" | "assistant"; metin: string }[];
  araclar: LlmTool[];
  calistir: (ad: string, girdi: any) => Promise<{ metin: string; hata?: boolean }>;
  model?: string;
  maxTur?: number;
};
export type SohbetFn = (req: SohbetIstek) => Promise<{ metin: string; model: string; kullanim: Kullanim; tur: number }>;
const topla = (a: Kullanim, b: Kullanim): Kullanim => ({ girdi: a.girdi + b.girdi, onbellek: a.onbellek + b.onbellek, cikti: a.cikti + b.cikti });
const SIFIR: Kullanim = { girdi: 0, onbellek: 0, cikti: 0 };

export function anthropicSohbet(apiKey: string, defaultModel: string, sinirMs = SINIR_MS): SohbetFn {
  return async ({ system, gecmis, araclar, calistir, model, maxTur }) => {
    const t0 = Date.now(), m = model || defaultModel;
    const mesajlar: any[] = gecmis.map((g) => ({ role: g.rol, content: g.metin }));
    let kullanim = SIFIR;
    for (let tur = 1; tur <= (maxTur || 8); tur++) {
      let res: Response;
      try { res = await zamanli("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: m, max_tokens: 4000, output_config: { effort: "low" },
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          tools: araclar, messages: mesajlar,
        }),
      }, sinirMs - (Date.now() - t0)); } catch (e) { throw new Error(`Devir AI'a ulaşılamadı (${(e as Error).message}).`); }
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Devir AI'a ulaşılamadı (${res.status} ${data?.error?.message || ""}).`);
      kullanim = topla(kullanim, anthropicKullanim(data.usage));
      const icerik: any[] = data.content || [];
      const cagrilar = icerik.filter((c) => c.type === "tool_use");
      const metin = icerik.filter((c) => c.type === "text").map((c) => c.text).join("\n").trim();
      if (data.stop_reason !== "tool_use" || !cagrilar.length) return { metin: metin || (data.stop_reason === "refusal" ? "Bu isteğe yardım edemiyorum." : ""), model: data.model || m, kullanim, tur };
      mesajlar.push({ role: "assistant", content: icerik }); // düşünme blokları dahil, olduğu gibi geri verilir
      const sonuclar = [];
      for (const c of cagrilar) { const r = await calistir(c.name, c.input || {}); sonuclar.push({ type: "tool_result", tool_use_id: c.id, content: r.metin, ...(r.hata ? { is_error: true } : {}) }); }
      mesajlar.push({ role: "user", content: sonuclar });
    }
    throw new Error("Devir AI çok fazla adım denedi; isteği daha kısa yaz.");
  };
}

export function openaiSohbet(apiKey: string, defaultModel: string, sinirMs = SINIR_MS): SohbetFn {
  return async ({ system, gecmis, araclar, calistir, model, maxTur }) => {
    const t0 = Date.now(), m = model && !/^claude/i.test(model) ? model : defaultModel;
    const mesajlar: any[] = [{ role: "system", content: system }, ...gecmis.map((g) => ({ role: g.rol, content: g.metin }))];
    const tools = araclar.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    let kullanim = SIFIR;
    for (let tur = 1; tur <= (maxTur || 8); tur++) {
      let res: Response;
      try { res = await zamanli("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: m, max_completion_tokens: 4000, messages: mesajlar, tools }),
      }, sinirMs - (Date.now() - t0)); } catch (e) { throw new Error(`Devir AI'a ulaşılamadı (${(e as Error).message}).`); }
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Devir AI'a ulaşılamadı (${res.status} ${data?.error?.message || ""}).`);
      kullanim = topla(kullanim, openaiKullanim(data.usage));
      const msg = data.choices?.[0]?.message || {};
      const cagrilar: any[] = msg.tool_calls || [];
      if (!cagrilar.length) return { metin: String(msg.content || "").trim(), model: "openai:" + (data.model || m), kullanim, tur };
      mesajlar.push({ role: "assistant", content: msg.content || null, tool_calls: cagrilar });
      for (const c of cagrilar) {
        let girdi: any = {};
        try { girdi = JSON.parse(c.function?.arguments || "{}"); } catch { /* boş girdi */ }
        const r = await calistir(c.function?.name, fixJson(girdi));
        mesajlar.push({ role: "tool", tool_call_id: c.id, content: r.hata ? `Hata: ${r.metin}` : r.metin });
      }
    }
    throw new Error("Devir AI çok fazla adım denedi; isteği daha kısa yaz.");
  };
}

/** Birincil sohbet motoru hata verirse yedeğe düşer (araç çalıştırmadan önce düşen hatalar için güvenli). */
export function yedekliSohbet(birincil: SohbetFn | undefined, yedek: SohbetFn | undefined): SohbetFn | undefined {
  if (!birincil || !yedek) return birincil || yedek;
  return async (req) => {
    let calisti = false;
    const izle = { ...req, calistir: (ad: string, g: any) => { calisti = true; return req.calistir(ad, g); } };
    try { return await birincil(izle); }
    catch (e) { if (calisti) throw e; return yedek(req); }
  };
}
