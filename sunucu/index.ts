import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import type { DB } from "./core.ts";
import { handle } from "./server.ts";
import { anthropicLlm, openaiLlm, yedekli, type LlmFn } from "./llm.ts";
import { openaiGomme, type GomFn } from "./bellek.ts";
import { KOVA, type Depo } from "./dosya.ts";
import type { KimlikFn, Posta } from "./hesap.ts";
// Kıyas düzeneği (Faz 1.5.0) koşulacağı zaman: import { kiyasHandle } from "./kiyas-uc.ts"; ve aşağıdaki satırı aç; kiyas.ts, kiyas-uc.ts, senaryolar.ts da dağıtıma eklenir.

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function apply(q: any, where: Record<string, unknown>) {
  for (const [k, v] of Object.entries(where)) q = v === null ? q.is(k, null) : Array.isArray(v) ? q.in(k, v) : q.eq(k, v);
  return q;
}
const db: DB = {
  async one(t, where) {
    const { data, error } = await apply(sb.from(t).select("*"), where).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },
  async many(t, where, order, limit) {
    let q = apply(sb.from(t).select("*"), where);
    if (order) q = q.order(order, { ascending: true });
    q = q.limit(limit || 2000);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data || [];
  },
  async insert(t, rows) {
    const { data, error } = await sb.from(t).insert(rows).select("*");
    if (error) throw new Error(`${error.code || ""} ${error.message}`);
    return data || [];
  },
  async update(t, where, patch) {
    const { error } = await apply(sb.from(t).update(patch), where);
    if (error) throw new Error(error.message);
  },
  async delete(t, where) {
    if (!Object.keys(where).length) throw new Error("Koşulsuz silme yapılmaz.");
    const { error } = await apply(sb.from(t).delete(), where);
    if (error) throw new Error(error.message);
  },
};

// E-postayla giriş: arayüz Supabase Auth ile oturum açar, oturum belirteci burada doğrulanır.
const kimlik: KimlikFn = async (jwt) => {
  const { data, error } = await sb.auth.getUser(jwt);
  return error || !data?.user ? null : { id: data.user.id, email: data.user.email || "" };
};
// Davet e-postası Supabase Auth'un SMTP ayarından (Resend) gider. Yeni kişiye davet, var olana giriş bağlantısı.
const posta: Posta = {
  async girisBaglantisi(eposta, yonlendir) {
    const { error } = await sb.auth.admin.inviteUserByEmail(eposta, yonlendir ? { redirectTo: yonlendir } : {});
    if (!error) return;
    if (!/already|registered|exists/i.test(error.message)) throw new Error(error.message);
    const r = await sb.auth.signInWithOtp({ email: eposta, options: { shouldCreateUser: false, ...(yonlendir ? { emailRedirectTo: yonlendir } : {}) } });
    if (r.error) throw new Error(r.error.message);
  },
};
// Gizli kova: yalnızca imzalı adreslerle
const kova = () => sb.storage.from(KOVA);
const depo: Depo = {
  async yuklemeAdresi(yol) {
    const { data, error } = await kova().createSignedUploadUrl(yol);
    if (error || !data) throw new Error(error?.message || "Yükleme adresi alınamadı.");
    return { url: data.signedUrl, token: data.token };
  },
  async indirmeAdresi(yol, saniye, ad) {
    const { data, error } = await kova().createSignedUrl(yol, saniye, { download: ad });
    if (error || !data) throw new Error(error?.message || "İndirme adresi alınamadı.");
    return data.signedUrl;
  },
  async bilgi(yol) {
    const i = yol.lastIndexOf("/");
    const { data, error } = await kova().list(yol.slice(0, i), { search: yol.slice(i + 1), limit: 10 });
    if (error) throw new Error(error.message);
    const o: any = (data || []).find((x: any) => x.name === yol.slice(i + 1));
    return o ? { boyut: Number(o.metadata?.size || 0), tur: String(o.metadata?.mimetype || "") } : null;
  },
  async sil(yollar) {
    if (!yollar.length) return;
    const { error } = await kova().remove(yollar);
    if (error) throw new Error(error.message);
  },
};

const modeller = { taslak: Deno.env.get("DEVIR_MODEL") || "claude-sonnet-5-5", hizli: Deno.env.get("DEVIR_MODEL_HIZLI") || "claude-haiku-5-5" };
// OpenAI yedek motor: gpt-4.1 taslağı ~20 sn'de bitiriyor; gpt-5 110 sn sınırını aştı (13 Eki canlı deneme)
const OPENAI_MODELLER = {
  taslak: Deno.env.get("DEVIR_OPENAI_MODEL") || "gpt-4.1",
  hizli: Deno.env.get("DEVIR_OPENAI_MODEL_HIZLI") || "gpt-4.1-mini",
  yedek: (Deno.env.get("DEVIR_OPENAI_YEDEK_MODELLER") || "gpt-4o").split(",").map((s) => s.trim()).filter(Boolean),
};

let motorlar: { claude?: LlmFn; openai?: LlmFn; ikisi?: LlmFn; gom?: GomFn; openaiKey: string } | null = null;
let hazirlandi = 0;
let testBasliklari = false; // x-devir-motor / x-devir-openai-model yalnız ayar.test_basliklari = "acik" iken dinlenir
async function hazirla() {
  if (motorlar && Date.now() - hazirlandi < 10 * 60_000) return motorlar; // anahtar değişirse en geç 10 dk'da alınır
  // önce ayar tablosu (işletmecinin yönettiği yer), yoksa Edge secret
  const oku = async (k: string) => ((await db.one("ayar", { anahtar: k }).catch(() => null))?.deger as string) || "";
  testBasliklari = (await oku("test_basliklari")) === "acik";
  const claudeKey = (await oku("anthropic_api_key")) || Deno.env.get("ANTHROPIC_API_KEY") || "";
  const openaiKey = (await oku("openai_api_key")) || Deno.env.get("OPENAI_API_KEY") || "";
  const claude = claudeKey ? anthropicLlm(claudeKey, modeller.taslak) : undefined;
  const openai = openaiKey ? openaiLlm(openaiKey, OPENAI_MODELLER) : undefined;
  motorlar = { claude, openai, openaiKey, gom: openaiKey ? openaiGomme(openaiKey) : undefined, ikisi: yedekli(claude, openai, (e) => console.warn("Claude hata verdi, OpenAI yedeğine geçildi:", e)) };
  hazirlandi = Date.now();
  return motorlar;
}

Deno.serve(async (req) => {
  // if (req.method === "POST" && new URL(req.url).pathname.endsWith("/kiyas")) return kiyasHandle(req, sb); // Faz 1.5.0 kıyas düzeneği (ayrı anahtarla)
  const m = await hazirla();
  // test kancası: x-devir-motor: openai | claude ile tek motor zorlanır; x-devir-openai-model ile OpenAI taslak modeli denenir
  const zorla = testBasliklari ? (req.headers.get("x-devir-motor") || "").toLowerCase() : "";
  const om = testBasliklari ? req.headers.get("x-devir-openai-model") : null;
  const openai = om && m.openaiKey ? openaiLlm(m.openaiKey, { ...OPENAI_MODELLER, taslak: om, yedek: [] }) : m.openai;
  const llm = zorla === "openai" ? openai : zorla === "claude" ? m.claude : m.ikisi;
  return handle(req, db, Date.now(), { llm, gom: m.gom, modeller, taban: `${Deno.env.get("SUPABASE_URL")}/functions/v1/devir-mcp`, kimlik, posta, depo });
});
