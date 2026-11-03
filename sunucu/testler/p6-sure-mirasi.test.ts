// P6 (NM8R, 3 Kas): süresi yazılmamış alt görev üst görevin süresinden pay alır; yalnız plan girdisinde, kayda yazılmaz.
import { readFileSync } from "node:fs";
import { todayIst, DAY, planGirdisi } from "../core.ts";
import { bitis } from "../plan.ts";
const ok = (c: boolean, m: string, x?: unknown) => { console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : " → " + JSON.stringify(x))); if (!c) process.exitCode = 1; };
const NOW = Date.parse("2026-10-22T09:00:00+03:00");
const gun = (n: number) => todayIst(NOW + n * DAY);
const akis = (x: any = {}) => ({ created_at: new Date(NOW).toISOString(), kurallar: {}, baglam: {}, ...x });
let id = 1;
const adim = (no: number, x: any = {}) => ({ id: id++, no, ad: `Adım ${no}`, sahip: "Berkin", sahip_tip: "insan", durum: "hazir", bagimli: [], ust_adim: null, sure_tahmin_gun: 1, created_at: new Date(NOW).toISOString(), durum_at: new Date(NOW).toISOString(), ...x });

// paralel alt görevler, ayrı kişiler: her biri üst görevin süresi kadar (4 gün), eksik sayılmaz
{
  const s = [adim(1, { sure_tahmin_gun: 4 }), adim(2, { ust_adim: 1, sure_tahmin_gun: null }), adim(3, { ust_adim: 1, sure_tahmin_gun: null, sahip: "Zeynep" })];
  const g = planGirdisi(s as any[]) as any[];
  ok(g[1].sure_tahmin_gun === 4 && g[2].sure_tahmin_gun === 4 && g[1]._sure_miras, "paralel alt görevler 4'er gün devralır", g.map((x) => x.sure_tahmin_gun));
  ok(s[1].sure_tahmin_gun === null, "kayıt nesnesi değişmez");
  const b = bitis(akis(), s, [], NOW);
  ok(b.eksik_sure === 0 && b.guven === "tahmin", "eksik süre kalmaz, güven tahmin", b);
  ok(b.aralik?.[0] === gun(4), "alt uç 4 gün", b.aralik);
  ok(b.varsayimlar.some((v) => v.includes("2 alt görevin süresi yok; üst görevin süresinden pay")), "varsayımda üst görevden pay yazıyor", b.varsayimlar);
}
// aynı kişinin paralel alt görevleri: 6 gün üçe bölünür (2'şer), toplam emek üst görevin süresi
{
  const s = [adim(1, { sure_tahmin_gun: 6 }), adim(2, { ust_adim: 1, sure_tahmin_gun: null }), adim(3, { ust_adim: 1, sure_tahmin_gun: null }), adim(4, { ust_adim: 1, sure_tahmin_gun: null })];
  const g = planGirdisi(s as any[]) as any[];
  ok(g.slice(1).every((x) => x.sure_tahmin_gun === 2), "tek kişide 2'şer gün", g.map((x) => x.sure_tahmin_gun));
}
// sıralı alt görevler: 6 gün üç halkalı zincire bölünür (2'şer)
{
  const s = [adim(1, { sure_tahmin_gun: 6 }), adim(2, { ust_adim: 1, sure_tahmin_gun: null }), adim(3, { ust_adim: 1, sure_tahmin_gun: null, bagimli: [2] }), adim(4, { ust_adim: 1, sure_tahmin_gun: null, bagimli: [3] })];
  const g = planGirdisi(s as any[]) as any[];
  ok(g.slice(1).every((x) => x.sure_tahmin_gun === 2), "sıralı zincir 2'şer gün", g.map((x) => x.sure_tahmin_gun));
  ok(bitis(akis(), s, [], NOW).aralik?.[0] === gun(6), "zincir toplamı üst görevin süresi (6 gün)");
}
// süresi yazılmış alt görev ve süresiz üst görev: dokunulmaz
{
  const s = [adim(1, { sure_tahmin_gun: 5 }), adim(2, { ust_adim: 1, sure_tahmin_gun: 1 }), adim(3, { ust_adim: 1, sure_tahmin_gun: null }), adim(4, { sure_tahmin_gun: null }), adim(5, { ust_adim: 4, sure_tahmin_gun: null })];
  const g = planGirdisi(s as any[]) as any[];
  ok(g[1].sure_tahmin_gun === 1 && g[2].sure_tahmin_gun === 5, "yazılmış süre korunur, eksik olan pay alır", g.map((x) => x.sure_tahmin_gun));
  ok(g[4].sure_tahmin_gun === null && !g[4]._sure_miras, "üst görevin de süresi yoksa eksik kalır");
}
// NM8R (159 adım): eksik süre sayısı düşer, aralık daralır
{
  const v = JSON.parse(readFileSync(new URL("../../tasarim/veri/nm8r.json", import.meta.url), "utf8"));
  const T0 = Date.parse("2026-11-03T09:00:00Z"), now = Date.parse("2026-11-03T12:51:00+03:00");
  const s = v.adimlar.map((r: any[]) => ({ id: r[0], no: r[0], ust_adim: r[1], durum: r[2], sahip: r[3], sahip_tip: r[4], son_tarih: r[5], sure_tahmin_gun: r[6], bagimli: r[7] || [], ad: r[14], tur_kod: r[14], created_at: new Date(T0).toISOString(), durum_at: new Date(T0).toISOString() }));
  const once = s.filter((x: any) => x.sure_tahmin_gun == null && x.durum !== "tamam" && x.durum !== "atlandi").length;
  const b = bitis({ created_at: new Date(T0).toISOString(), kurallar: {}, baglam: {} }, s, [], now);
  console.log(`  NM8R: eksik ${once} → ${b.eksik_sure}, aralık ${b.aralik?.join(" – ")}`);
  ok(b.eksik_sure < once / 3, "NM8R'de eksik süre en az üçte bire iner", { once, sonra: b.eksik_sure });
}
