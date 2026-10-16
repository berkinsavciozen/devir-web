// Claude API ile yapısal çağrı: model yanıtını yalnızca verilen aracı çağırarak verir.
export type LlmTool = { name: string; description: string; input_schema: Record<string, unknown> };
export type LlmFn = (req: { system: string; user: string; tool: LlmTool; model?: string; max_tokens?: number }) => Promise<{ input: any; model: string; ms: number }>;

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
      if (block) return { input: fixJson(block.input), model: data.model || m, ms: Date.now() - t0 };
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
        if (call) { try { return { input: fixJson(JSON.parse(call.function.arguments)), model: "openai:" + (data.model || m), ms: Date.now() - t0 }; } catch { lastErr = `${m}: araç çıktısı JSON değil`; continue; } }
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
