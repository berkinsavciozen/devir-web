// 0.32.1 (5 Kas): Claude'da tool_choice auto; OpenAI yedeği gpt-6.1-sol / gpt-6-luna, model yoksa gpt-4.1'e geçer.
import { anthropicLlm, openaiLlm, openaiSohbet, AKIL } from "../llm.ts";

let hata0 = 0;
const ok = (ad: string, kosul: boolean, x?: unknown) => { console.log(`${kosul ? "✓" : "✗"} ${ad}${kosul || x === undefined ? "" : " → " + JSON.stringify(x)}`); if (!kosul) hata0++; };
const arac = { name: "taslak_yaz", description: "", input_schema: { type: "object" } };

(async () => {
  const istekler: any[] = [];
  let yok = new Set<string>();
  globalThis.fetch = (async (url: string, init: any) => {
    const b = JSON.parse(init.body); istekler.push({ url, b });
    if (yok.has(b.model)) return new Response(JSON.stringify({ error: { code: "model_not_found", message: "yok" } }), { status: 404 });
    if (String(url).includes("anthropic")) {
      if (b.tool_choice?.type === "tool" || b.tool_choice?.type === "any") return new Response(JSON.stringify({ error: { message: "tool_choice: type \"tool\" and \"any\" are not supported for this model." } }), { status: 400 });
      return new Response(JSON.stringify({ model: b.model, content: [{ type: "tool_use", name: b.tools[0].name, input: { x: 1 } }], usage: {} }), { status: 200 });
    }
    if (!b.tools?.[0]?.function?.name || b.messages.some((m: any) => m.role === "tool")) return new Response(JSON.stringify({ model: b.model, choices: [{ message: { content: "tamam" } }], usage: {} }), { status: 200 });
    return new Response(JSON.stringify({ model: b.model, choices: [{ message: { tool_calls: [{ function: { name: b.tools[0].function.name, arguments: "{\"x\":1}" } }] } }], usage: {} }), { status: 200 });
  }) as any;

  const r = await anthropicLlm("k", "claude-sonnet-5-5")({ system: "s", user: "u", tool: arac });
  ok("Claude Sonnet 5.5 çağrısı 400 almadan döner", r.input?.x === 1, r);
  ok("0.32.2: taslak medium çaba", istekler[0].b.output_config?.effort === "medium", istekler[0].b.output_config);
  istekler.length = 0;
  await anthropicLlm("k", "claude-sonnet-5-5")({ system: "s", user: "u", tool: arac, model: "claude-haiku-5-5" });
  ok("0.32.2: denetçi (haiku) low çaba", istekler[0].b.output_config?.effort === "low", istekler[0].b.output_config);
  istekler.length = 0;
  await anthropicLlm("k", "claude-sonnet-5-5", undefined, "low")({ system: "s", user: "u", tool: arac });
  ok("0.32.2: DEVIR_TASLAK_CABA ile değişir", istekler[0].b.output_config?.effort === "low", istekler[0].b.output_config);
  istekler.length = 0;
  await anthropicLlm("k", "claude-sonnet-5-5")({ system: "s", user: "u", tool: arac });
  ok("tool_choice auto + tek çağrı", istekler[0].b.tool_choice?.type === "auto" && istekler[0].b.tool_choice?.disable_parallel_tool_use === true, istekler[0].b.tool_choice);

  ok("gpt-6 ailesi akıl yürüten model sayılır", AKIL.test("gpt-6.1-sol") && AKIL.test("gpt-6-luna") && AKIL.test("gpt-5") && !AKIL.test("gpt-4.1"));
  const modeller = { taslak: "gpt-6.1-sol", hizli: "gpt-6-luna", yedek: ["gpt-4.1"] };
  istekler.length = 0;
  const o1 = await openaiLlm("k", modeller)({ system: "s", user: "u", tool: arac });
  ok("taslak gpt-6.1-sol ile", o1.model === "openai:gpt-6.1-sol" && istekler[0].b.reasoning_effort === "low" && istekler[0].b.max_completion_tokens >= 16000, istekler[0].b);
  istekler.length = 0;
  await openaiLlm("k", modeller)({ system: "s", user: "u", tool: arac, model: "claude-haiku-5-5" });
  ok("hızlı iş gpt-6-luna, çaba low", istekler[0].b.model === "gpt-6-luna" && istekler[0].b.reasoning_effort === "low", istekler[0].b);
  yok = new Set(["gpt-6.1-sol"]); istekler.length = 0;
  const o2 = await openaiLlm("k", modeller)({ system: "s", user: "u", tool: arac });
  ok("gpt-6.1-sol hesapta yoksa gpt-4.1'e geçer", o2.model === "openai:gpt-4.1" && !("reasoning_effort" in istekler[1].b), istekler.map((i) => i.b.model));

  yok = new Set(["gpt-6-luna"]); istekler.length = 0;
  const s = await openaiSohbet("k", "gpt-6-luna", undefined, "gpt-4.1-mini")({ system: "s", gecmis: [{ rol: "user", metin: "selam" }], araclar: [], calistir: async () => ({ metin: "" }) } as any);
  ok("sohbet: gpt-6-luna yoksa gpt-4.1-mini'ye geçer", s.model === "openai:gpt-4.1-mini" && s.metin === "tamam", { s, m: istekler.map((i) => i.b.model) });
  yok = new Set(); istekler.length = 0;
  await openaiSohbet("k", "gpt-6-luna")({ system: "s", gecmis: [{ rol: "user", metin: "selam" }], araclar: [], calistir: async () => ({ metin: "" }) } as any);
  ok("sohbet: gpt-6-luna çaba low", istekler[0].b.reasoning_effort === "low", istekler[0].b);

  console.log(hata0 ? `\n${hata0} test başarısız` : "\n0.32.1 testleri geçti");
  if (hata0) (globalThis as any).process?.exit?.(1);
})();
