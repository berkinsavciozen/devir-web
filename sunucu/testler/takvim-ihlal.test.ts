// P1-E madde 9–11: planlanan tarih, boşluk uyarısı, bağımsız adımın erken tarihi, takvim ihlali bildirimi, yedek motor etiketi.
import { handle } from "../server.ts";
import { karma } from "../baglanti.ts";
import { DAY, todayIst, yedekMotor, motorAdi } from "../core.ts";
import { bitis } from "../plan.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-22T09:00:00+03:00");
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "anahtar", "kullanici", "kisi", "katilimci", "uye"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(t === "adim" ? { durum: "sirada", ciktilar: [] } : t === "akis" ? { durum: "aktif", kurallar: {}, baglam: {} } : {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
};
const ok = (c: boolean, m: string, x?: unknown) => { console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : " → " + JSON.stringify(x))); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
const gun = (n: number) => todayIst(NOW + n * DAY);

(async () => {
  async function arac(name: string, args: any): Promise<string> {
    NOW += 6e4;
    const r = await handle(new Request(B, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer dv_sahip" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), db, NOW, { taban: B });
    return (await r.json()).result.content[0].text;
  }
  const [ws] = await db.insert("kullanici", [{ ad: "Takvim alanı" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await karma("dv_sahip") }]);

  // 9 · bağımsız adım hedefe yapışmaz; zincir geriye planlanır
  const hedef = "2026-12-31";
  const o = await arac("devir_akis_olustur", { baslik: "Mağaza açılışı", hedef_tarih: hedef, adimlar: [
    { ad: "Kira sözleşmesi", sahip: "Berkin", kriter: "imza", sure_tahmin_gun: 2 },
    { ad: "Tadilat", sahip: "Berkin", kriter: "bitti", sure_tahmin_gun: 3, bagimli: [1] },
    { ad: "Logo tasarımı", sahip: "Ayşe", kriter: "logo", sure_tahmin_gun: 2 },
    { ad: "Açılış", sahip: "Berkin", kriter: "açıldı", sure_tahmin_gun: 1, bagimli: [2] },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(o)![1];
  const akis = T.akis.find((a) => a.kisa_kod === kod);
  const adim = (no: number) => T.adim.find((s) => s.akis_id === akis.id && s.no === no);
  ok(adim(3).son_tarih === gun(2), "bağımsız adımın son tarihi bugün + süresi (hedefe yapışmaz)", adim(3).son_tarih);
  ok(adim(4).son_tarih === hedef && adim(1).son_tarih > gun(30), "bağlı zincir hedefe göre geriye planlanır", [adim(1).son_tarih, adim(4).son_tarih]);
  const g = await arac("devir_akis", { akis: kod });
  ok(/Kira sözleşmesi[^\n]*\(plan /.test(g), "son tarihi çok ileride olan adımda planlanan tarih görünür", g);
  const oku = await arac("devir_adim_oku", { akis: kod, no: 1 });
  ok(/planlanan bitiş/.test(oku), "adım okumada planlanan bitiş görünür");

  // 9 · boşluk ufkun yarısından büyükse varsayım (J2LU: 45 günlük iş 7 aylık ufukta)
  const steps = T.adim.filter((s) => s.akis_id === akis.id);
  const b = bitis(akis, steps, [], NOW);
  ok(b.varsayimlar.some((v: string) => /süreler eksik tahmin edilmiş olabilir/.test(v)), "uzak hedefte boşluk varsayımı", b.varsayimlar);
  const b2 = bitis({ ...akis, hedef_tarih: gun(7) }, steps, [], NOW);
  ok(!b2.varsayimlar.some((v: string) => /eksik tahmin/.test(v)), "kısa ufukta boşluk varsayımı yok", b2.varsayimlar);

  // 10 · güncelleme yeni takvim ihlali doğurursa söylenir ve kaydedilir; tarih taşınmaz
  let r = await arac("devir_adim_guncelle", { akis: kod, no: 4, son_tarih: gun(1) });
  ok(/⚠ Takvim ihlali: 4\. Açılış/.test(r) && /kendiliğinden taşınmadı/.test(r), "son tarihi öne çekmek ihlal bildirir", r);
  ok(adim(4).son_tarih === gun(1), "son tarih kullanıcının verdiği gibi kalır");
  const ih = () => T.olay.filter((e) => e.akis_id === akis.id && e.veri?.tur === "takvim_ihlali");
  ok(ih().length === 1 && ih()[0].tip === "guncelleme" && ih()[0].kim_tip === "sistem" && ih()[0].veri.adimlar[0].no === 4, "ihlal olay kaydına sistem olarak yazılır", ih());
  r = await arac("devir_adim_guncelle", { akis: kod, no: 1, ilerleme: "taslak geldi" });
  ok(!/Takvim ihlali/.test(r) && ih().length === 1, "süren ihlal her güncellemede tekrar bildirilmez");

  // 10 · ekleme de ihlal bildirir
  r = await arac("devir_adim_ekle", { akis: kod, ad: "Ruhsat", sahip: "Berkin", kriter: "ruhsat", sure_tahmin_gun: 4, son_tarih: gun(3), bagimli: [1], neden: "belediye istedi" });
  ok(/⚠ Takvim ihlali: 5\. Ruhsat/.test(r) && ih().length === 2, "yeni adım ihlali bildirilir", r);
  r = await arac("devir_adim_ekle", { akis: kod, ad: "Afiş", sahip: "Ayşe", kriter: "afiş", sure_tahmin_gun: 1, neden: "açılış duyurusu" });
  ok(!/Takvim ihlali/.test(r), "ihlal doğurmayan ekleme sessiz");

  // 11 · yedek motor etiketi
  ok(yedekMotor("openai:gpt-4.1 (yedek; birincil: anthropic:claude kredi bitti)") && !yedekMotor("anthropic:claude-sonnet") && !yedekMotor(null), "yedek motor modelden tanınır");
  ok(motorAdi("openai:gpt-4.1 (yedek; birincil: x)") === "OpenAI gpt-4.1", "motor adı okunur", motorAdi("openai:gpt-4.1 (yedek; birincil: x)"));
})();
