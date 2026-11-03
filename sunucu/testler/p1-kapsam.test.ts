// P1 (NM8R, 3 Kas): TALP7 taslağı bağlamdaki kurulum hattını ve modülleri adım yapmadı. Kapsam denetimi bunları not eder.
import { kapsamDenetimi, SISTEM } from "../tasarim.ts";
const ok = (c: boolean, m: string, x?: unknown) => { console.log((c ? "✓ " : "✗ ") + m + (c || x === undefined ? "" : " → " + JSON.stringify(x))); if (!c) process.exitCode = 1; };
const BAGLAM = {
  sahip: "Berkin (tek insan; maaşlı çalışıyor, yan iş)",
  iliski: "kendi",
  moduller: "Keşif, Tedarik, İthalat ve lojistik, Depo ve stok, Listeleme ve fiyat, Satış-kargo-müşteri, Pazarlama, Finans-fizibilite-senaryo, Veri doğrulama, Orkestratör",
  teknoloji: "Kendi kod deposu (GitHub) + Supabase (veritabanı, depolama, Edge Functions, MCP sunucusu); agent'lar Claude zamanlanmış görevleri; Lovable yok",
  kurulum_hatti: "Şirket kuruluşu (mali müşavirle şirket türü), Dataroid iş sözleşmesindeki yan iş/rekabet yasağı kontrolü, vergi levhası, e-fatura, ithalatçı kaydı, Trendyol/Hepsiburada/n11 satıcı hesapları; şirket kurulum agent'ı destekler, adımları Berkin atar; sistem hazır tanımına dahil değil, paralel",
};
// TALP7'nin 12 adımı (canlı, gpt-4.1 yedeği)
const TALP7 = ["Standart modül ve senaryo fonksiyonlarını listele, açıklamalarını yaz", "Her modül için iç/dış veri ihtiyacını, formatı ve kaynağını belirle", "Sistem rollerini, agent ve insan yetki sınırlarını tanımla", "Temel yazılım altyapısını (Supabase, GitHub, veri tabanı, dosya, agent framework) kur ve test et", "Fizibilite motorunu geliştir (sermaye t=0, nakit akışı dip, portföy etkisi, adet öneri)", "Senaryo motoru ve ana tetikleyicileri kur (senaryo varyantı, finansal şok vb)", "Finansal dashboard ve onay merkezini geliştir", "Agent önerileri ve senaryo çıktıları için manuel onay ve kayıt akışını uygula", "MCP sunucusunu kur, agent zamanlaması ve dış tetikleyiciye bağla", "Seçilen pilot ürün vakası için gerçek/simüle veri setleri ve test senaryoları derle", "Uçtan uca test işlemini gerçekleştir, hata ve aksaklıkları kaydet", "Faz 1 fonksiyonlarını canlıya al ve sistem hazır olarak resmen duyur"].map((ad, i) => ({ id: "a" + i, ad }));
{
  const n = kapsamDenetimi({ adimlar: TALP7 }, BAGLAM);
  console.log("  " + n.join("\n  "));
  ok(n.length === 1, "TALP7 için tek not", n);
  for (const x of ["Dataroid", "vergi levhası", "satıcı hesapları", "Depo ve stok", "Pazarlama"]) ok(n[0]?.includes(x), `eksik: ${x}`);
  ok(!n[0]?.includes("GitHub") && !n[0]?.includes("Berkin (tek"), "teknoloji ve sahip alanları denetlenmez");
}
{
  const tam = [...TALP7, ...["Şirket kuruluşunu mali müşavirle tamamla", "Dataroid sözleşmesinde yan iş yasağını kontrol et", "Vergi levhasını al", "E-fatura hesabını aç", "İthalatçı kaydını yap", "Trendyol, Hepsiburada, n11 satıcı hesaplarını aç", "Keşif modülünü kur", "Tedarik modülünü kur", "İthalat ve lojistik modülünü kur", "Depo ve stok modülünü kur", "Listeleme ve fiyat modülünü kur", "Satış kargo müşteri modülünü kur", "Pazarlama modülünü kur", "Finans fizibilite senaryo modülünü kur", "Veri doğrulama modülünü kur", "Orkestratör agent'ını kur", "Şirket kurulum agent'ını kur"].map((ad, i) => ({ id: "b" + i, ad }))];
  const n = kapsamDenetimi({ adimlar: tam }, BAGLAM);
  ok(!n.length, "tüm ögeler adımda varsa not yok", n);
}
ok(kapsamDenetimi({ adimlar: TALP7 }, { not: "kısa bir cümle" }).length === 0, "liste olmayan bağlam denetlenmez");
ok(/Bağlam kapsamı/.test(SISTEM) && /40 adıma kadar/.test(SISTEM), "sistem istemi bağlam kapsamı kuralını taşır");
