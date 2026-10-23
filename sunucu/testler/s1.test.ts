// 0.25.0 (S1, 23 Eki test bulguları): önce doğrula sonra yaz (B1), atlanan adım geçittir (C1), hedef sessizce kaymaz (C3),
// son tarih sessizce sabitlenmez (M1), karar kriteri sonradan (M3), imza hazırlığı karar değil (M4), ilerleme sayımı (m6),
// tek kritik yol (m7), iptal edilen akışın kararları (m8).
import { handle } from "../server.ts";
import { karma } from "../baglanti.ts";
import { DAY, todayIst, takvim, kararAdimi, metrics, ilerlemeSay } from "../core.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-23T09:00:00+03:00");
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
  const [ws] = await db.insert("kullanici", [{ ad: "S1 alanı" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await karma("dv_sahip") }]);
  const kur = async (adimlar: any[], hedef?: string) => {
    const o = await arac("devir_akis_olustur", { baslik: "S1 " + idc, ...(hedef ? { hedef_tarih: hedef } : {}), adimlar });
    const kod = /oluşturuldu: (\w+)/.exec(o)![1];
    const akis = T.akis.find((a) => a.kisa_kod === kod);
    return { kod, akis, adim: (no: number) => T.adim.find((s) => s.akis_id === akis.id && s.no === no) };
  };

  // B1 · hata yarım kayıt bırakmaz
  {
    const f = await kur([
      { ad: "Bütçe kararı", sahip: "Berkin", kriter: "karar verildi", sure_tahmin_gun: 1 },
      { ad: "Logo tasarımı", sahip: "Ayşe", kriter: "logo", sure_tahmin_gun: 1 },
    ]);
    let r = await arac("devir_adim_guncelle", { akis: f.kod, no: 1, durum: "suruyor", karar_secimi: ["A"] });
    ok(/devir_karar_ver/.test(r) && f.adim(1).durum === "hazir" && !f.akis.baglam?.kararlar?.["1"], "agent karar seçimi reddedilince durum yazılmaz", [r, f.adim(1).durum]);
    r = await arac("devir_adim_guncelle", { akis: f.kod, no: 2, durum: "suruyor", karar_secimi: ["x"] });
    ok(/karar adımı değil/.test(r) && f.adim(2).durum === "hazir", "karar olmayan adıma seçim reddedilir, durum yazılmaz", [r, f.adim(2).durum]);
    r = await arac("devir_adim_guncelle", { akis: f.kod, no: 2, durum: "tamam", cevap: "evet", not: "bitti" });
    ok(/açık soru yok/.test(r) && f.adim(2).durum === "hazir", "geçersiz cevap durum yazılmadan reddedilir", [r, f.adim(2).durum]);
  }

  // C1 · atlanan adım geçittir: öncülü bitmeden sonrası başlamaz
  {
    const f = await kur([
      { ad: "Teklif", sahip: "Berkin", kriter: "gönderildi", sure_tahmin_gun: 2 },
      { ad: "Ön görüşme", sahip: "Berkin", kriter: "yapıldı", sure_tahmin_gun: 1, bagimli: [1] },
      { ad: "Sözleşme", sahip: "Berkin", kriter: "hazır", sure_tahmin_gun: 1, bagimli: [2] },
    ]);
    await arac("devir_adim_guncelle", { akis: f.kod, no: 2, durum: "atlandi", atlama_nedeni: "gerek_kalmadi", not: "gerek yok" });
    ok(f.adim(3).durum === "sirada", "atlanan adımın sonrası öncül bitmeden hazır olmaz", f.adim(3).durum);
    const r = await arac("devir_adim_guncelle", { akis: f.kod, no: 3, durum: "suruyor" });
    ok(/1\. Teklif/.test(r) && f.adim(3).durum === "sirada", "başlatma isteği asıl bekleyen öncülü söyler", r);
    const steps = T.adim.filter((s) => s.akis_id === f.akis.id);
    const m = metrics(f.akis, steps, T.olay.filter((e) => e.akis_id === f.akis.id), NOW);
    ok(m.pl.EF.get(2) === m.pl.EF.get(1) && m.pl.EF.get(3)! > m.pl.EF.get(1)!, "planda atlanan adım öncülüyle biter, sonrası öncülü bekler", [...m.pl.EF]);
    await arac("devir_adim_guncelle", { akis: f.kod, no: 1, durum: "tamam", not: "gönderildi" });
    ok(f.adim(3).durum === "hazir", "öncül bitince atlanan adımın sonrası hazır", f.adim(3).durum);
    // m6 · sayım
    const il = ilerlemeSay(T.adim.filter((s) => s.akis_id === f.akis.id));
    ok(il.tamam === 1 && il.toplam === 2 && il.atlandi === 1, "ilerleme: atlanan tamam sayılmaz, toplamdan düşer", il);
    const g = await arac("devir_akislar", {});
    ok(new RegExp(`${f.kod}[^\\n]*1/2 \\(1 atlandı\\)`).test(g), "akış listesinde atlanan ayrıca söylenir", g);
    // m7 · başlıktaki kritik yol biten adımı taşımaz
    const a = await arac("devir_akis", { akis: f.kod });
    const kz = /^Kritik yol: ([^\n]*)/m.exec(a.split("\n").filter((l) => /^Kritik yol: \d/.test(l)).join("\n"))?.[1] || "";
    ok(!/\b1\b/.test(kz.split(" → ").join(" ")) && /3/.test(kz), "kritik yol yalnız açık adımlar", kz);
  }

  // C3 · kullanıcının hedefi kaymaz
  {
    const notes: string[] = [];
    const bugun = Math.floor(Date.parse(gun(0) + "T00:00:00Z") / DAY);
    const st: any[] = [
      { no: 1, ad: "Fuar", bagimli: [], sure_tahmin_gun: 1, _capa: gun(10) },
      { no: 2, ad: "Fuar raporu", bagimli: [1], sure_tahmin_gun: 5 },
    ];
    const r = takvim(st, gun(12), bugun, notes);
    ok(r.hedef === gun(12), "hedef korunur", r.hedef);
    ok(notes.some((n) => /^⚠ Hedef .*Hedef korundu/.test(n)), "hedef yetmiyorsa uyarı yazılır", notes);
    ok(st[1].son_tarih === gun(15), "çapadan sonraki iş gerçekçi tarihe planlanır", st[1].son_tarih);
  }

  // M1, M3, m6 · son tarih ve karar kriteri
  {
    const hedef = gun(20);
    const f = await kur([
      { ad: "Taslak", sahip: "Berkin", kriter: "hazır", sure_tahmin_gun: 2 },
      { ad: "Gönderim", sahip: "Berkin", kriter: "gönderildi", sure_tahmin_gun: 2, bagimli: [1] },
    ], hedef);
    let r = await arac("devir_adim_guncelle", { akis: f.kod, no: 1, son_tarih: gun(5) });
    ok(f.adim(1).son_tarih === gun(5) && !f.adim(1).tarih_sabit, "son tarih sessizce sabitlenmez", f.adim(1));
    r = await arac("devir_adim_guncelle", { akis: f.kod, no: 1, son_tarih: gun(6), tarih_sabit: true });
    ok(f.adim(1).tarih_sabit === true && T.olay.some((e) => e.akis_id === f.akis.id && /\(sabit\)/.test(e.ozet || "")), "tarih_sabit açıkça istenirse sabit", r);
    r = await arac("devir_adim_guncelle", { akis: f.kod, no: 2, son_tarih: gun(25) });
    const uy = T.olay.filter((e) => e.akis_id === f.akis.id && e.veri?.tur === "tarih_uyarisi");
    ok(/⚠ .*hedefinden/.test(r) && f.akis.hedef_tarih === hedef && uy.length === 1, "hedefi aşan tarih uyarılır ve kaydedilir; hedef değişmez", [r, uy.length]);
    r = await arac("devir_adim_ekle", { akis: f.kod, ad: "Fiyat", sahip: "Berkin", kriter: "fiyat seçildi", karar_kriteri: "en düşük toplam maliyet", sure_tahmin_gun: 1, bekleyenler: [1], neden: "müşteri sordu" });
    ok(f.adim(3).karar_kriteri === "en düşük toplam maliyet" && kararAdimi(f.adim(3)), "eklenen adım karar kriteriyle karar adımı olur", f.adim(3));
    ok(f.adim(3).son_tarih === gun(4) && !f.adim(3).tarih_sabit && /hedefe göre planlandı/.test(r), "tarihsiz eklenen adım bekleyenine göre planlanır", [f.adim(3).son_tarih, r]);
    r = await arac("devir_adim_guncelle", { akis: f.kod, no: 1, karar_kriteri: "müşteri onayı" });
    ok(f.adim(1).karar_kriteri === "müşteri onayı" && kararAdimi(f.adim(1)), "karar kriteri sonradan yazılır", r);
  }

  // M4 · karar sınıflaması
  ok(kararAdimi({ tur_kod: "karar-butce", ad: "Bütçe" }), "karar- türü karar adımıdır");
  ok(!kararAdimi({ ad: "İmza dosyasını hazırla" }) && !kararAdimi({ ad: "İmzaları topla" }), "imza hazırlığı karar değil");
  ok(kararAdimi({ ad: "Sözleşmeyi imzala" }) && kararAdimi({ ad: "Ödeme onayı" }), "imza ve onay hâlâ karar");

  // m8 · iptal edilen akışın kararları geçerlilikten düşer
  {
    const f = await kur([{ ad: "Fiyat listesi", sahip: "Berkin", kriter: "hazır", sure_tahmin_gun: 1 }]);
    const [k] = await db.insert("karar", [{ ws_id: ws.id, varlik: "Acme", varlik_norm: "acme", karar: "%12 komisyon", akis_id: f.akis.id, durum: "gecerli" }]);
    const r = await arac("devir_akis_kapat", { akis: f.kod, neden: "iptal", degerlendirme: "iş yapılmayacak" });
    const kk = T.karar.find((x) => x.id === k.id);
    ok(kk.durum === "degisti" && /artık geçerli sayılmaz/.test(r), "iptal: akışın kararları geçerlilikten düşer", [kk.durum, r]);
  }
  console.log(process.exitCode ? "✗ S1 testleri" : "✓ S1 testleri tamam");
})();
