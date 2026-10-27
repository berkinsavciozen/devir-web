// Claude API ile yapısal çağrı: model yanıtını yalnızca verilen aracı çağırarak verir.
export type LlmTool = { name: string; description: string; input_schema: Record<string, unknown> };
/** Bir çağrının token kullanımı (0.28.0, P8): girdi (önbellek yazımı dahil), önbellekten okunan girdi, çıktı */
export type Kullanim = { girdi: number; onbellek: number; cikti: number };
export type LlmFn = (req: { system: string; user: string; tool: LlmTool; model?: string; max_tokens?: number }) => Promise<{ input: any; model: string; ms: number; kullanim?: Kullanim }>;
const anthropicKullanim = (u: any): Kullanim => ({ girdi: Number(u?.input_tokens || 0) + Number(u?.cache_creation_input_tokens || 0), onbellek: Number(u?.cache_read_input_tokens || 0), cikti: Number(u?.output_tokens || 0) });
const openaiKullanim = (u: any): Kullanim => { const o = Number(u?.prompt_tokens_details?.cached_tokens || 0); return { girdi: Number(u?.prompt_tokens || 0) - o, onbellek: o, cikti: Number(u?.completion_tokens || 0) }; };

// Edge fonksiyonun duvar saati sınırı 150 sn; her motor bunun içinde kalmalı ki yedek devreye girebilsin.
const SINIR_MS = 110_000;
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
          model: m, max_tokens: max_tokens || 12000,
          system: [{ type: "text", text: system + `\n\nYanıtını yalnızca ${tool.name} aracını tek kez çağırarak ver; düz metin yazma.`, cache_control: { type: "ephemeral" } }],
          tools: [tool],
          messages: [{ role: "user", content: user }],
        }),
      }, sinirMs - (Date.now() - t0)); } catch (e) { lastErr = (e as Error).message; break; }
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) { lastErr = `${res.status} ${data?.error?.message || ""}`; if (res.status >= 500 || res.status === 429) continue; break; }
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
            model: m, max_completion_tokens: Math.max(max_tokens || 12000, 16000),
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
          throw new Error(`OpenAI yanıt vermedi (${lastErr}).`);
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
export function yedekli(birincil: LlmFn | undefined, yedek: LlmFn | undefined, uyar: (e: string) => void = () => {}): LlmFn | undefined {
  if (!birincil) return yedek;
  if (!yedek) return birincil;
  return async (req) => {
    const t0 = Date.now();
    try { return await birincil(req); }
    catch (e) {
      uyar((e as Error).message);
      if (Date.now() - t0 > 40_000) throw e; // birincil çok zaman yedi; yedeğe süre kalmadı
      const r = await yedek(req);
      return { ...r, model: `${r.model} (yedek; birincil: ${String((e as Error).message).slice(0, 120)})` };
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
