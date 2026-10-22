// P1-A (MK-5, MK-8): bitiş aralığı ve karar özeti. Fixture'lar küçük; beklenen tarihler elle hesaplandı.
import { metrics, todayIst, DAY } from "../core.ts";
import { bitis, gecmisOranlari, kararOzeti, aralikMetni } from "../plan.ts";
const ok = (c: boolean, m: string, x?: unknown) => { console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : " → " + JSON.stringify(x))); if (!c) process.exitCode = 1; };
const NOW = Date.parse("2026-10-22T09:00:00+03:00");
const gun = (n: number) => todayIst(NOW + n * DAY);
const akis = (x: any = {}) => ({ created_at: new Date(NOW).toISOString(), kurallar: {}, baglam: {}, ...x });
let id = 1;
const adim = (no: number, x: any = {}) => ({ id: id++, no, ad: `Adım ${no}`, sahip: "Berkin", sahip_tip: "insan", durum: "hazir", bagimli: [], sure_tahmin_gun: 1, created_at: new Date(NOW).toISOString(), durum_at: new Date(NOW).toISOString(), ...x });

// eksik_sure_kesin_tarih_uretmez: 2 gün + eksik (1–3 gün); tahmin 2 gün ×1,5 = 3
{
  const a = akis(), s = [adim(1, { sure_tahmin_gun: 2 }), adim(2, { sure_tahmin_gun: null, bagimli: [1], durum: "sirada", sahip: "Zeynep" })];
  const b = bitis(a, s, [], NOW);
  ok(b.guven === "eksik" && b.eksik_sure === 1, "eksik süre kesin tarih üretmez (güven eksik, 1 eksik)", b);
  ok(b.aralik?.[0] === gun(3) && b.aralik?.[1] === gun(6), "aralık 3–6 gün (alt: 2+1, üst: 3+3)", b.aralik);
  ok(b.varsayimlar.some((v) => v.includes("1 adımın süresi yok")), "varsayımlarda eksik süre yazıyor", b.varsayimlar);
}
// ayni_kisi_cakisan_is_araligi_genisletir + yuk_uyarisi_uretilir: Berkin'de iki bağımsız 2 günlük iş (kullanıcı süresi)
{
  const a = akis(), s = [adim(1, { sure_tahmin_gun: 2, sure_kaynak: "kullanici" }), adim(2, { sure_tahmin_gun: 2, sure_kaynak: "kullanici" })];
  const b = bitis(a, s, [], NOW);
  ok(b.aralik?.[0] === gun(2) && b.aralik?.[1] === gun(4), "aynı kişinin çakışan işi üst ucu uzatır (2–4 gün)", b.aralik);
  ok(b.yuk_uyarilari.length === 1 && b.yuk_uyarilari[0].kisi === "Berkin" && b.yuk_uyarilari[0].gecikme_gun === 2, "yük uyarısı: Berkin +2 gün", b.yuk_uyarilari);
  ok(b.guven === "tahmin", "yük varken güven kesin değil", b.guven);
}
// farklı kişiler, kullanıcı süreleri: kesin, tek gün
{
  const a = akis(), s = [adim(1, { sure_tahmin_gun: 2, sure_kaynak: "kullanici" }), adim(2, { sure_tahmin_gun: 3, sure_kaynak: "kullanici", sahip: "Zeynep" })];
  const b = bitis(a, s, [], NOW);
  ok(b.guven === "kesin" && b.aralik?.[0] === gun(3) && b.aralik?.[1] === gun(3) && !b.yuk_uyarilari.length, "kullanıcı süreleri, çakışma yok: kesin 3 gün", b);
}
// agent işleri kapasite sayılmaz
{
  const a = akis(), s = [adim(1, { sahip: "Hukuk agent", sahip_tip: "agent", sure_kaynak: "kullanici" }), adim(2, { sahip: "Hukuk agent", sahip_tip: "agent", sure_kaynak: "kullanici" })];
  ok(!bitis(a, s, [], NOW).yuk_uyarilari.length, "agent'ın paralel işleri yük uyarısı üretmez");
}
// gecmis_sure_kullanilir: "sozlesme" türü geçmişte tahminin 2 katı sürdü
{
  const g = gecmisOranlari([{ sapma: [{ tur_kod: "sozlesme", tahmin: 2, gercek: 4 }, { tur_kod: "sozlesme", tahmin: 1, gercek: 2 }, { tur_kod: "tek", tahmin: 1, gercek: 5 }] }]);
  ok(g.get("sozlesme") === 2 && !g.has("tek"), "geçmiş oranı en az 2 örnekle (ortanca)", [...g]);
  const b = bitis(akis(), [adim(1, { sure_tahmin_gun: 2, tur_kod: "sozlesme" })], [], NOW, g);
  ok(b.adimlar[0].kaynak === "gecmis" && b.adimlar[0].sure_gun[1] === 4 && b.aralik?.[1] === gun(4), "geçmiş varsa kaynak geçmiş, üst uç 4 gün", b.adimlar);
}
// kapasite_kapali_bayragi (regresyon): alt uç bugünkü en_erken_bitis ile birebir
{
  const evs = [{ id: 1, tip: "durum", adim_no: 1, veri: { to: "suruyor" }, created_at: new Date(NOW - 2 * DAY).toISOString() }];
  const fx = [
    [adim(1, { sure_tahmin_gun: 3, durum: "suruyor" }), adim(2, { bagimli: [1], durum: "sirada", sure_tahmin_gun: null }), adim(3, { bagimli: [1], durum: "sirada", sahip: "Ayten", sahip_tip: "dis", sure_tahmin_gun: 4 }), adim(4, { bagimli: [2, 3], durum: "sirada" })],
    [adim(1, { durum: "tamam" }), adim(2, { bagimli: [1], capa_tarih: gun(10) }), adim(3, { sure_tahmin_gun: 0.5 })],
    [adim(1, { sahip_tip: "agent", sure_tahmin_gun: 5 }), adim(2, { sure_tahmin_gun: 2 }), adim(3, { bagimli: [1, 2], sure_tahmin_gun: 1 })],
  ];
  for (const [i, s] of fx.entries()) {
    const a = akis({ created_at: new Date(NOW - 3 * DAY).toISOString() });
    const eski = todayIst(metrics(a, s, evs, NOW).pl.end), yeni = bitis(a, s, evs, NOW).en_erken;
    ok(eski === yeni, `alt uç eski hesapla aynı (fixture ${i + 1}: ${eski})`, yeni);
  }
}
// kapalı akış kesin
{
  const b = bitis(akis({ kapandi_at: new Date(NOW).toISOString() }), [adim(1, { durum: "tamam" })], [], NOW);
  ok(b.guven === "kesin" && b.aralik?.[0] === gun(0), "kapalı akış: kapanış günü, kesin");
}
// karar özeti: engel varken de kritik yol dolu; hamle takılanı çözmek
{
  const a = akis({ hedef_tarih: gun(20) });
  const s = [adim(1, { ad: "Banka onayı", durum: "engelli", engel: "imza bekleniyor", sure_tahmin_gun: 2 }), adim(2, { ad: "Sözleşme taslağı", bagimli: [1], durum: "sirada", sure_tahmin_gun: 3 }), adim(3, { ad: "Komisyona karar ver", sahip: "Zeynep", sure_tahmin_gun: 1 })];
  const b = bitis(a, s, [], NOW), k = kararOzeti(a, s, b, NOW);
  ok(k.darbogaz?.tur === "engel" && k.darbogaz.no === 1 && k.darbogaz.tuttugu === 1, "darboğaz: takılan adım, 1 adımı tutuyor", k.darbogaz);
  ok(k.kritik.ilk_acik?.no === 1 && k.kritik.zincir.join(",") === "1,2", "engel varken kritik yol alanı dolu", k.kritik);
  ok(k.hamle?.no === 1 && k.hamle.neden.includes("takıldı"), "sonraki hamle takılanı çözmek", k.hamle);
  ok(k.cumle.includes("Takılan: Banka onayı") && k.cumle.includes("Kritik yol: Banka onayı → Sözleşme taslağı") && k.cumle.includes("hedefe") && k.cumle.includes("En erken"), "cümle: darboğaz · kritik yol · aralık · pay", k.cumle);
  ok(k.hedef?.durum === "pay" && k.hedef.pay_gun === 13, "hedef payı üst uca göre (üst uç 3 + 4,5 = 7,5 gün; 20 − 7 = 13)", k.hedef);
  // dış görünüm: başka adımların adı yazılmaz
  const d = kararOzeti(a, s, b, NOW, { dis: true, kapsam: new Set([3]) });
  ok(!d.cumle.includes("Banka") && !d.cumle.includes("Sözleşme") && d.darbogaz === null && d.kritik.zincir.length === 0 && d.hamle === null, "dış kişi özeti başka adımların adını taşımaz", d);
  const d2 = kararOzeti(a, s, b, NOW, { dis: true, kapsam: new Set([1]) });
  ok(d2.cumle.startsWith("Senin adımın kritik yolda"), "dış kişinin adımı kritik yoldaysa söylenir", d2.cumle);
}
// hedef aralığın içinde: riskte; aralığın altında: geçiyor
{
  const s = [adim(1, { sure_tahmin_gun: 4 })]; // 4–6 gün
  const r = kararOzeti(akis({ hedef_tarih: gun(5) }), s, bitis(akis({ hedef_tarih: gun(5) }), s, [], NOW), NOW);
  ok(r.hedef?.durum === "riskte" && r.cumle.includes("riskte"), "hedef aralığın içindeyse riskte", r.hedef);
  const g = kararOzeti(akis({ hedef_tarih: gun(2) }), s, bitis(akis({ hedef_tarih: gun(2) }), s, [], NOW), NOW);
  ok(g.hedef?.durum === "geciyor" && g.cumle.includes("hedef 2 gün geçiyor"), "hedef alt ucun da altındaysa geçiyor (2 gün)", g.cumle);
}
ok(aralikMetni(["2026-10-28", "2026-10-31"]) === "28–31 Eki" && aralikMetni(["2026-10-30", "2026-11-02"]) === "30 Eki – 2 Kas" && aralikMetni(["2026-10-28", "2026-10-28"]) === "28 Eki", "aralık metni", [aralikMetni(["2026-10-28", "2026-10-31"]), aralikMetni(["2026-10-30", "2026-11-02"])]);
