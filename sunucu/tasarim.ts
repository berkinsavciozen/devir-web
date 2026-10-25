// Akış tasarımcısı: tek cümleden taslak, soru adayları, soru seçimi ve cevaplardan akış.
import type { LlmTool } from "./llm.ts";
import { kelimeBenzer, kokler } from "./bellek.ts";

export const BOYUTLAR: Record<string, string> = {
  sonuc: "Sonuç: bitti ne demek, ne teslim edilecek",
  zaman: "Zaman: hedef tarih, kaydırılamayan tarihler",
  karar: "Karar: son kararı kim veriyor",
  kapi: "Kapılar: kimden onay, izin, imza ya da ödeme gerekiyor",
  dis: "Dış katılımcılar: ekip dışından kim dahil",
  girdi: "Girdiler: dışarıdan toplanması gereken belge, veri, malzeme ya da birinden istenecek şey",
  arac: "Araçlar ve agent'lar: hangi işi hangi araç ya da agent yapacak",
  kisit: "Kısıtlar: bütçe, regülasyon, kişisel veri",
  belirsizlik: "Belirsizlik: ilk kez mi, en çok nerede takılır",
  tekrar: "Tekrar: bir daha yapılacak mı, ne sıklıkla",
  bagli: "Bağlantılı işler: başka bir işi bekliyor ya da besliyor mu",
};

export const SISTEM = `Sen Devir'in akış tasarımcısısın. Kullanıcının tek cümlesinden, işi bitirmek için gereken çok adımlı akışın TASLAĞINI çıkarırsın ve yalnızca taslağı gerçekten değiştirecek soruların ADAYLARINI üretirsin. Soruları kullanıcıya sen sormazsın; Devir aralarından seçer.

İlkeler:
1. Önce tam bir taslak çıkar. Bilmediğin yerde makul varsayım yap ve varsayımı yaz. Boş form değil, kullanılabilir plan.
2. Her adım tek bir işin devridir: tek sahip rolü, "bitti mi" testi (kriter), tahmini süre (gün, ondalık olabilir) ve bağımlılıklar. Birbirini beklemeyen işleri paralel kur; gereksiz sıralı zincir kurma.
3. Karar, onay, ödeme ve imza adımlarının sahibi insandır; agent yalnızca hazırlar.
4. Dışarıdan toplanması gereken her girdi (belge, veri, malzeme, birinden istenecek şey) ayrı bir toplama adımıdır. En sık unutulanlar bunlardır; atlama.
5. 4–15 adım. Daha büyük iş, birden çok akıştır.
6. Akışın şeklini değiştiren boyutlar: ${Object.entries(BOYUTLAR).map(([k, v]) => `${k} (${v})`).join("; ")}.
7. Soru adayı yalnızca cevabı akışı değiştiren durumlar için yazılır. Her aday için: seçenekler, varsayılan, varsayılanın sormadan doğru olma güveni (0–1), cümleden ya da bağlamdan çıkarılabilir mi, etki (0: hiçbir şey değişmez, 1: bir tarih ya da sahip değişir, 2: 1–2 adım eklenir ya da çıkar, 3: akışın yapısı değişir). 3–8 aday yeterli; etkisi 0 olanı yazma.
8. Seçim sorusunun cevabı adım ekliyor ya da çıkarıyorsa o adımları taslağa koy ve kosul ile bağla (ör. kosul {soru: "regule", deger: "evet"}). Varsayılan dışındaki dallar da taslakta olmalı. Birden çok seçeneğin birlikte seçilebildiği sorularda (ör. iki sertifika da gerekebilir) "her ikisi" diye ayrı bir seçenek açma; her seçeneğin adımını kendi değeriyle bağla, Devir birden çok cevabı ("organik, gida-kalite") ya da "her ikisi"ni hepsine uygular. Her durumda gereken işi (ticari fatura, temel belge, ödeme) bir cevaba koşullama; cevap yalnız o işin biçimini değiştiriyorsa (ödeme yöntemi, taşıma şekli) adımı koşulsuz kur ve seçenekleri adın içinde say ("Ödemeyi al: peşin ya da akreditif"), Devir cevabı adıma işler.
9. Soru kodları kısa, kalıcı ve iş türleri arasında tutarlı olsun (regule, mobil, butce_onayi, hedef_tarih…). Mevcut iş türünün soru kodlarını aynen kullan.
10. Adım türü kodları (tur_kod) kısa, kalıcı kebab-case olsun (guvenlik-onayi). Benzer geçmiş işlerde ya da standart süreçte aynı işi gören bir adım varsa onun tur_kod'unu aynen kullan. Standart süreç verildiyse onu temel al: adımlarını ve kodlarını koru, yalnızca bu işin cevaplarına ve koşullu dallarına göre uyarla.
11. Tarihler. hedef_tarih, işin TAMAMEN bitmesi gereken gündür. Bir adım belirli bir günde gerçekleşiyorsa (etkinlik günü, yayın, lansman, teslim, toplantı, taşınma günü) o adıma tarih_capasi ver: gün cümleden ya da bağlamdan biliniyorsa {tarih: "YYYY-AA-GG"}, bilinmiyorsa {soru: "<tarih sorusunun kodu>"} ve tip "tarih" olan o soruyu aday olarak yaz (ör. etkinlik_tarihi, yayin_tarihi; etki 2). Çapalı adımdan sonra yapılacak adımlar (rapor, geri bildirim, kapanış) ona bağımlı olsun; Devir onları sonraya planlar. Çapa varsa ayrıca hedef_tarih sorma. hedef_tarih alanını yalnızca cümle ya da bağlam belirli bir günü gösteriyorsa doldur ("Cuma", "ay sonu", "Aralık sonuna kadar", "15 Mayıs"); "Mayıs'ta", "Q1'de", "yakında" gibi belirsiz ifadelerde doldurma, soru adayı yaz. Çapa yoksa, cümlede belirli bir gün yoksa ve iş bir bitiş tarihine bağlıysa kod "hedef_tarih", tip "tarih" olan bir soru adayı mutlaka yaz (etki 1, güven düşük); Devir bunu soru sınırının dışında sorar. Çapalı adımdan ÖNCE yapılması gereken her adım (hazırlık, başvuru, onay, ödeme) çapalı adımın bagimli listesinde olsun; böylece hiçbir hazırlık olaydan sonraya planlanmaz.
12. Kişi adları cümlede geçiyorsa rollere yaz; geçmiyorsa rolü adıyla bırak. Kişi adı sormak için soru üretme; istisna: kararın kimde olduğu akışı değiştiriyorsa.
13. anahtar_varlik: işin bağlı olduğu ana varlık (şirket, proje, kişi, mekan, ürün). Aynı varlıkla geçmiş akışlar buradan eşleşir.
14. Varlık ilişkisi. Kullanıcının ana varlıkla ilişkisi (kendi: kendi şirketi ya da projesi; musteri: hizmet verdiği müşteri; isveren: çalıştığı şirket; kisisel) dış katılımcıları, onayları ve dışarıdan istenecek girdileri belirler. Bağlamda "iliski" varsa ona uy ve sorma. Cümle iyelikle kullanıcının kendisini işaret ediyorsa (blogum, yazım, evim, şirketim) ya da ortada kullanıcıdan başka bir varlık yoksa ilişki "kendi"dir; sorma. Yoksa ve cümleden kesin çıkmıyorsa kod "iliski", boyut "dis", tip "secim" olan bir soru adayı yaz (seçenekler kendi / musteri / isveren / kisisel; etki 3; güven en fazla 0.4). Varlıktan onay ya da girdi isteyen adımları kosul {soru: "iliski", deger: "musteri|isveren"} ile bağla; varlığı kendisi olan kullanıcıdan "onay istemek" ya da "malzeme istemek" adımı kurma. Bu kural YALNIZCA varlığın kendisini kapsar: üçüncü tarafların (yatırımcı, danışman, mali müşavir, kurum, okul, muhtarlık, belediye, banka) onayı ve girdisi "kendi" ve "kisisel" işlerde de geçerlidir; "dışarıdan onay istenmez" gibi genel bir varsayım yazma.
15. Her soru adayı için kalici alanını doldur. kalici=true: cevap bu varlık için uzun süre aynı kalır (kimin şirketi, regüle mi, sözleşme hep yapılır mı). kalici=false: işin o anki durumu (komisyon belirlendi mi, liste hazır mı) ya da bu işe özgü bir şey (bölge, kanal, dönem). Emin değilsen false.
16. Kararlar. "Geçerli kararlar" verildiyse bunlar kısıttır; taslak onlarla çelişmemeli. Bir konuda karar zaten varsa o konuyu soru yapma ve yeniden karar adımı kurma; kararı varsayım olarak yaz, gerekiyorsa kısa bir "teyit et" adımı kur. "Ertelenmiş açık işler" verildiyse ve bu işle ilgiliyse onları taslağa adım olarak al ve köşeli parantezdeki tur_kod'u AYNEN kullan; aynı işi ikinci bir adım olarak kurma.
17. Geçmiş cevaplar yalnızca ipucudur: durum soruları ve bölge, kapsam gibi bu işe özgü konular değişmiş olabilir; bunları yeniden soru adayı yap. Yanlış çıktığı bildirilen varsayımları mutlaka soru adayı yap.
18. Roller. Cümlede ya da bağlamda adı geçmeyen ekip rollerini (finans sorumlusu, operasyon sorumlusu, saha ekibi) uydurma; kullanıcı tek başına çalışıyor olabilir. Kullanıcının bu işte bir ekibi olup olmadığı belli değilse kod "ekip", boyut "karar", tip "secim", seçenekler yalniz (yalnızca ben ve agent'lar) / ekip (ekibim var) olan bir soru adayı yaz; Devir bunu soru sınırının dışında sorar. kisi alanını yalnızca adı geçen kişiler için doldur.
19. Sahiplik. Birinden bir şey toplama, isteme ya da teklif alma adımının sahibi toplayan kişidir; dış taraf yalnızca kendi yaptığı işin (onay vermek, imzalamak, teslim etmek) sahibidir. Grup (kurul, aileler, firmalar, gönüllüler, yatırımcılar) yerine kişi ya da temsilci yaz; grup gerçekten tek tek izlenecekse bunu varsayıma yaz. Her işi gerçekten yapan role ver: hedef ülkedeki işler (ithalat gümrüğü, o ülkedeki kayıt ve dağıtım) alıcının ya da onun temsilcisinindir, ihracatçının gümrük müşaviri yalnız çıkış işlemlerini yapar; etiket, ürün kalitesi, analiz ve ambalaj uygunluğu üreticinin ya da ihracatçının işidir, muhasebeci yalnız fatura ve kayıtların sahibidir.
20. Bağımlılık. Bir adımın girdisi başka bir adımın sonucuysa ona bağımlıdır (ör. değerlendirme tetkik sonucunu bekler, bildirim yayından sonra gelir). İzin, onay ve yasal kapılar (arabuluculuk, izin, sözleşme) ilgili işten önce gelir.
21. Soru seçimi. Her soru adayı için genel alanını doldur: genel=true her işte sorulabilecek soru (mobil mi, regüle mi, bütçe onayı var mı, mevcut araç var mı); genel=false bu işe özgü, akışın yapısını değiştiren soru (kaç kişi onaylıyor, onay eşiği ya da tutar, kaç revizyon turu, girdi kimden geliyor, kesin teslim saati). Önce genel=false olanları yaz; gizli kalmış belirleyici bilgiyi bulmaya çalış.
22. Büyük işler. Bir adım 30 günü aşıyorsa ya da aynı adımlar her bölge, müşteri ya da kalem için tekrar edecekse varsayımlara "Bu iş birden çok akışa bölünmeli" diye yaz ve ilk akışı (ör. ilk bölge) kur.
23. Gizlilik. Kişisel işlerde adım adlarına sağlık ve özel ayrıntı yazma; genel ad kullan (tetkikler, uzman görüşü, belge toplama).
24. Varsayımlar listesine soru adayı olarak yazdığın konuları yazma; onlar cevaba göre belirlenir.
25. Kısa yaz: açıklama en fazla bir cümle, kriter tek cümle. Önce soruları ve varsayımları, sonra rolleri ve adımları yaz.
26. Sonradan belli olan bilgi. Cevabı ancak iş yürürken belli olacak sorular (ihale, başvuru ya da test sonucu, tetkik sonucu, gelen teklifin tutarı, randevu, duruşma, sınav ya da toplantı tarihi) kullanıcıya şimdi sorulmaz: ne_zaman "sonra" yaz, cevabın belli olduğu adımın id'sini cevaplayan_adim alanına yaz. Sonuca ya da tutara bağlı her dalın adımlarını kosul ile kur (ör. kosul {soru: "ihale_sonucu", deger: "kazanildi"}; diğer dal deger: "kaybedildi"); dal adımları cevaplayan adıma bağımlı olsun. Tarihse o tarihte gerçekleşen adıma tarih_capasi {soru} ver; tarihi uydurma. Devir cevap gelince seçilmeyen dalı atlar, takvimi yeniden kurar. Kullanıcının şimdi bilebileceği soruları (hedef tarih, kim onaylıyor, bütçe) "sonra"ya bırakma; ne_zaman "simdi" olsun.
27. Geçmiş ve bilgi. "Benzer geçmiş işler" bu ekibin gerçekte yaşadığı işlerdir: sonradan eklenen adımlar, yanlış çıkan varsayımlar ve uzun beklemeler bu işte de olabilir; bu işe uyuyorsa baştan kur. "Kanıtlı dersler" geçmişten çıkmış kurallardır: kesin olanları bu işe uyuyorsa mutlaka uygula (adım ekle, soru sor, süreyi uzat); aday olanları yalnızca bu işe açıkça uyuyorsa uygula. "Alan bilgi kartları" kaynaklı kurallardır (yasal süre, kurum, belge); bu işe uyuyorsa adımları, süreleri ve kapıları onlara göre kur. Geçmişte yaşanmamış bir şeyi yaşanmış gibi yazma.
28. dayanak. Bir adımı, süreyi ya da soruyu bir derse, karta ya da geçmiş işe dayanarak kurduysan o adımın ya da sorunun dayanak alanına kaynağın kodunu aynen yaz (ör. ["D12"], ["K:sgk-ise-giris"], ["G:Q3XB"]). Dayanağı olmayan adımda alanı boş bırak; uydurma kod yazma.
29. Adlar. Her adımın ad'ı tam ve kendi başına anlaşılır cümledir: nesne + fiil, kimin neyi yaptığı belli ("Geçici teminat mektubunu bankadan al"); "ve" ile iki iş birleştirme, iki işse iki adım kur. Her adıma ayrıca kisa_ad yaz: en çok 40 karakter, akışta tekil, işi ayırt eden kelimeyi koruyan nesne + fiil ("Teminat mektubunu al", "Teminat iadesini al"); üç nokta, kısaltma ya da bağlaçla bitiş yok. Akışa da kisa_ad yaz: varlık + iş, 2–4 kelime ("Park aydınlatma ihalesi", "Hasat çiftçi kazanımı"). Ayrıntı ad'da değil aciklama, kriter ve beklenen_cikti'da durur; beklenen_cikti'yı boş bırakma (ör. "imzalı sözleşme PDF").
30. Karar ve çıktı. Her adım için karar_gerekli ve cikti_bekleniyor alanlarını doldur. karar_gerekli=true: adım bir seçim, onay, ödeme ya da imzayla biter ve son sözü insan verir; o zaman karar_kriteri de yaz. Hazırlık, toplama ve gönderme adımları karar değildir. cikti_bekleniyor=true: adım bir belge, dosya, metin, kayıt ya da teslim edilebilir bir şey üretir (beklenen_cikti'ya ne olduğunu yaz); yalnızca bir şeyin olmasını bekleyen ya da karar veren adımda false.
31. Dil. Yalnız Türkçe yaz; İngilizce ya da yarım kalmış kelime kullanma (rapor, şahit numune, vadeli ödeme gibi yerleşik terimleri kullan). Bir adın içinde aynı kelimeyi ya da aynı liste ögesini tekrarlama. Varsayım cümleleri tam ve tek anlamlı olsun.
32. Türkçe yaz.`;

export const TASLAK_ARACI: LlmTool = {
  name: "taslak_yaz",
  description: "Akış taslağını ve soru adaylarını kaydeder.",
  input_schema: {
    type: "object",
    required: ["is_turu", "baslik", "sorular", "varsayimlar", "roller", "adimlar"],
    properties: {
      is_turu: { type: "object", required: ["kod", "ad", "mevcut"], properties: { kod: { type: "string" }, ad: { type: "string" }, mevcut: { type: "boolean", description: "Listedeki mevcut bir iş türü mü?" } } },
      anahtar_varlik: { type: "object", properties: { tur: { type: "string" }, ad: { type: "string" } } },
      baslik: { type: "string" },
      kisa_ad: { type: "string", description: "Akışın kısa adı: varlık + iş, en çok 40 karakter." },
      amac: { type: "string" },
      hedef_tarih: { type: ["string", "null"], description: "YYYY-AA-GG; cümleden çıkıyorsa." },
      roller: { type: "array", items: { type: "object", required: ["kod", "ad", "tip"], properties: { kod: { type: "string" }, ad: { type: "string" }, kisi: { type: ["string", "null"] }, tip: { type: "string", enum: ["insan", "dis", "agent"] }, arac: { type: ["string", "null"] } } } },
      sorular: {
        type: "array",
        items: {
          type: "object", required: ["kod", "boyut", "soru", "neden", "tip", "varsayilan", "guven", "cikarilabilir", "etki"],
          properties: {
            kod: { type: "string" }, boyut: { type: "string", enum: Object.keys(BOYUTLAR) }, soru: { type: "string" }, neden: { type: "string" },
            tip: { type: "string", enum: ["secim", "tarih", "metin"] },
            secenekler: { type: "array", items: { type: "object", properties: { deger: { type: "string" }, etiket: { type: "string" } } } },
            varsayilan: { type: "string" }, guven: { type: "number" }, cikarilabilir: { type: "boolean" }, etki: { type: "number" },
            genel: { type: "boolean", description: "Bu soru her işte sorulabilecek genel bir soru mu (true), yoksa bu işe özgü mü (false)?" },
            kalici: { type: "boolean", description: "Cevap bu varlık için kalıcı mı (true), yoksa işin o anki durumuna ya da bu işe özgü bir şeye mi bağlı (false)?" },
            ne_zaman: { type: "string", enum: ["simdi", "sonra"], description: "simdi: kullanıcı şimdi cevaplayabilir. sonra: cevap ancak iş yürürken belli olur (sonuç, tutar, dışarıdan verilen tarih)." },
            cevaplayan_adim: { type: ["string", "null"], description: "ne_zaman=sonra ise cevabın belli olduğu adımın id'si." },
            dayanak: { type: "array", items: { type: "string" }, description: "Bu soruyu sorduran ders, kart ya da geçmiş iş kodları (D12, K:kod, G:akış)." },
          },
        },
      },
      varsayimlar: { type: "array", items: { type: "object", properties: { boyut: { type: "string" }, metin: { type: "string" } } } },
      adimlar: {
        type: "array",
        items: {
          type: "object", required: ["id", "tur_kod", "ad", "sahip_rol", "kriter", "sure_tahmin_gun", "bagimli", "boyut", "karar_gerekli", "cikti_bekleniyor"],
          properties: {
            id: { type: "string" }, tur_kod: { type: "string" }, ad: { type: "string" }, kisa_ad: { type: "string", description: "en çok 40 karakter, akışta tekil; nesne + fiil." }, aciklama: { type: "string" },
            sahip_rol: { type: "string", description: "roller içindeki kod" }, arac: { type: ["string", "null"] },
            kriter: { type: "string" }, beklenen_cikti: { type: ["string", "null"] }, karar_kriteri: { type: ["string", "null"] },
            karar_gerekli: { type: "boolean", description: "Adım bir seçim, onay, ödeme ya da imzayla mı bitiyor (son söz insanda)?" },
            cikti_bekleniyor: { type: "boolean", description: "Adım belge, dosya, metin ya da kayıt gibi bir çıktı üretiyor mu?" },
            sure_tahmin_gun: { type: "number" }, bagimli: { type: "array", items: { type: "string" } },
            boyut: { type: "string", enum: Object.keys(BOYUTLAR).concat(["genel"]) },
            kosul: { type: ["object", "null"], properties: { soru: { type: "string" }, deger: { type: "string" } } },
            tarih_capasi: { type: ["object", "null"], description: "Adım belirli bir günde gerçekleşiyorsa: {tarih} ya da o günü soran {soru}.", properties: { soru: { type: "string" }, tarih: { type: "string" } } },
            dayanak: { type: "array", items: { type: "string" }, description: "Bu adımı ya da süresini belirleyen ders, kart ya da geçmiş iş kodları (D12, K:kod, G:akış)." },
          },
        },
      },
    },
  },
};

export const TUR_ARACI: LlmTool = {
  name: "adim_turu",
  description: "Yeni eklenen adımın türünü ve hangi boyuttan geldiğini kaydeder.",
  input_schema: { type: "object", required: ["tur_kod", "boyut"], properties: { tur_kod: { type: "string" }, boyut: { type: "string", enum: Object.keys(BOYUTLAR).concat(["genel"]) } } },
};

// taslağın bağımlılıklarını ikinci, ucuz bir çağrıyla denetler: yalnızca eksik ve kesin olanlar eklenir
export const BAGIMLILIK_SISTEM = `Sen bir iş akışı denetçisisin. Sana bir akışın adımları verilir (id, ad, sahip, bağımlılıklar, varsa sabit tarih). Görevin YALNIZCA kesin eksik bağımlılıkları bulmak:
- Bir adımın girdisi başka bir adımın sonucuysa (ör. değerlendirme tetkik sonuçlarını, sözleşme seçilen firmayı, kayıt işe alınan kişiyi bekler) ve bu bağımlılık yoksa ekle.
- İzin, onay, yasal kapı (arabuluculuk, izin, sözleşme imzası) ilgili işten önce bitmeli.
- Bildirim, duyuru gibi işler, neyi bildiriyorsa ondan sonra gelir.
- Sabit tarihli bir olaydan önce yapılması gereken hazırlık, o olayın bağımlılığı olmalı.
- "yalnızca X=a ise" ve "yalnızca X=b ise" adımları birbirini dışlayan dallardır; biri ötekini bekleyemez.
Var olan bağımlılıkları kaldırma, tartışmalı olanları ekleme, döngü oluşturma. Emin değilsen ekleme. Türkçe ve kısa yaz.`;
export const BAGIMLILIK_ARACI: LlmTool = {
  name: "bagimlilik_ekle",
  description: "Eksik bağımlılıkları kaydeder.",
  input_schema: { type: "object", required: ["ekle"], properties: { ekle: { type: "array", items: { type: "object", required: ["id", "bekledigi", "neden"], properties: { id: { type: "string", description: "Bekleyecek adımın id'si" }, bekledigi: { type: "array", items: { type: "string" }, description: "Önce bitmesi gereken adımların id'leri" }, neden: { type: "string" } } } } } },
};
export function bagimlilikEkle(adimlar: any[], ekle: any[]) {
  const by = new Map<string, any>(adimlar.map((s) => [String(s.id), s]));
  const ulasir = (bas: string, hedef: string) => { const seen = new Set<string>(); const yigin = [bas]; while (yigin.length) { const x = yigin.pop()!; if (x === hedef) return true; if (seen.has(x)) continue; seen.add(x); for (const d of by.get(x)?.bagimli || []) yigin.push(String(d)); } return false; };
  const eklenen: string[] = [];
  for (const e of Array.isArray(ekle) ? ekle : []) {
    const s = by.get(String(e.id)); if (!s) continue;
    for (const d0 of e.bekledigi || []) {
      const d = String(d0);
      if (d === String(s.id) || !by.has(d) || (s.bagimli || []).map(String).includes(d)) continue;
      if (ulasir(d, String(s.id))) continue; // döngü olur
      const k1 = s.kosul, k2 = by.get(d).kosul;
      if (k1?.soru && k2?.soru && k1.soru === k2.soru && String(k1.deger) !== String(k2.deger)) continue; // birbirini dışlayan dallar birbirini bekleyemez
      s.bagimli = [...(s.bagimli || []), d];
      eklenen.push(`"${s.ad}" → "${by.get(d).ad}" bekler${e.neden ? ` (${e.neden})` : ""}`);
    }
  }
  return eklenen;
}

// 1.5.5 denetçi: sabit kontrol listesiyle ikinci, ucuz bir çağrı; yalnızca kesin eksikler için yama önerir
export const DENETCI_SISTEM = `Sen Devir'in akış denetçisisin. Sana bir akış taslağı (adımlar, sorular) ve varsa bu işe getirilen dersler ile bilgi kartları verilir. Aşağıdaki kontrol listesini sırayla uygula ve YALNIZCA kesin eksikler için yama öner:
1. Girdiler: dışarıdan toplanması gereken belge, veri, onay ya da malzeme ayrı bir toplama adımı olarak var mı? Bir adım bir girdiyi kullanıyor ama o girdiyi toplayan adım yoksa adim_ekle.
2. Kapılar: izin, onay, imza, ödeme, yasal süre (ihbar, itiraz, bekleme) ilgili işten önce mi? Eksik kapıyı adim_ekle, yanlış sırayı bagimlilik ile düzelt.
3. Bağımlılık: bir adımın girdisi başka bir adımın sonucuysa ona bağımlı olmalı; bildirim, bildirdiği şeyden sonra gelir; sabit tarihli olaydan önceki hazırlık o olayın bağımlılığıdır. "yalnızca X=a ise" ve "yalnızca X=b ise" adımları birbirini bekleyemez.
4. Sahiplik: bir şeyi toplayan, isteyen kişi o adımın sahibidir; karar, onay, ödeme insandadır. Hedef ülkedeki işler (ithalat gümrüğü, o ülkedeki kayıt) alıcının ya da temsilcisinin; etiket, kalite ve ürün uygunluğu üreticinin ya da ihracatçının işidir, muhasebecinin değil. Sahiplik hatası yama değil, not olarak yaz.
5. Dersler ve kartlar: kesin dersler ve bu işe uyan kartlar taslakta uygulanmış mı? Uygulanmamışsa adim_ekle ya da soru_ekle ile uygula ve dayanak alanına kodunu yaz.
6. Sorular: akışı değiştirecek ama sorulmayan kritik bir bilinmeyen varsa (en fazla 2) soru_ekle.
7. Dallar: her seçim sorusunun cevabı en az bir adımı değiştirmeli. Bir cevapta gereksiz kalacak adımlara kosul_ekle ile koşul ekle (ör. şirket türü şahıs ise ana sözleşme, noter ve sermaye adımları yalnızca ltd|as ise). Her durumda gereken işe (ticari fatura, temel belge) koşul ekleme.
Eklediğin adımın adı insanın okuyacağı kısa bir cümle olsun, kod değil. Bir soruyla cevaplanacak bir seçimi adım yapma; soru zaten varsa ekleme. Bekleme süresi ya da yasal süre yalnızca kartta ya da derste açıkça yazıyorsa adım olur; "X gün içinde yapılır" bir bekleme değildir.
Var olan adımları ve bağımlılıkları kaldırma, döngü kurma, tartışmalı yama önerme. Emin değilsen önerme. Türkçe ve kısa yaz.`;
export const DENETCI_ARACI: LlmTool = {
  name: "denetim_yaz",
  description: "Denetim yamalarını kaydeder.",
  input_schema: {
    type: "object", required: ["bagimlilik", "adim_ekle", "soru_ekle", "notlar"],
    properties: {
      bagimlilik: { type: "array", items: { type: "object", required: ["id", "bekledigi", "neden"], properties: { id: { type: "string", description: "Bekleyecek adımın id'si" }, bekledigi: { type: "array", items: { type: "string" } }, neden: { type: "string" } } } },
      adim_ekle: { type: "array", items: { type: "object", required: ["ad", "tur_kod", "sahip_rol", "kriter", "sure_tahmin_gun", "bagimli", "neden"], properties: { ad: { type: "string" }, tur_kod: { type: "string" }, sahip_rol: { type: "string" }, kriter: { type: "string" }, sure_tahmin_gun: { type: "number" }, bagimli: { type: "array", items: { type: "string" } }, bekleyen: { type: "array", items: { type: "string" }, description: "Bu yeni adımı beklemesi gereken mevcut adımların id'leri" }, boyut: { type: "string" }, kosul: { type: ["object", "null"], properties: { soru: { type: "string" }, deger: { type: "string" } } }, neden: { type: "string" }, dayanak: { type: "array", items: { type: "string" } } } } },
      soru_ekle: { type: "array", items: { type: "object", required: ["kod", "boyut", "soru", "neden", "tip", "varsayilan", "guven", "etki"], properties: { kod: { type: "string" }, boyut: { type: "string", enum: Object.keys(BOYUTLAR) }, soru: { type: "string" }, neden: { type: "string" }, tip: { type: "string", enum: ["secim", "tarih", "metin"] }, secenekler: { type: "array", items: { type: "object", properties: { deger: { type: "string" }, etiket: { type: "string" } } } }, varsayilan: { type: "string" }, guven: { type: "number" }, etki: { type: "number" }, dayanak: { type: "array", items: { type: "string" } } } } },
      kosul_ekle: { type: "array", items: { type: "object", required: ["id", "soru", "deger", "neden"], properties: { id: { type: "string", description: "Koşul eklenecek adımın id'si" }, soru: { type: "string", description: "Var olan bir seçim sorusunun kodu" }, deger: { type: "string", description: "Adımın gerektiği seçenek değerleri, | ile (ör. ltd|as)" }, neden: { type: "string" } } } },
      notlar: { type: "array", items: { type: "string" }, description: "Yama olarak uygulanamayan uyarılar (sahiplik, tarih)." },
    },
  },
};
export function denetimListesi(t: any) {
  const rolAd = new Map<string, string>((t.roller || []).map((x: any) => [x.kod, `${x.kisi || x.ad} (${x.kod}, ${x.tip})`]));
  const adimlar = (t.adimlar || []).map((x: any) => `${x.id} | ${x.ad} | sahip: ${rolAd.get(x.sahip_rol) || x.sahip_rol} | ${x.sure_tahmin_gun ?? "?"} gün | bekler: ${(x.bagimli || []).join(", ") || "-"}${x.tarih_capasi ? ` | sabit tarih: ${x.tarih_capasi.tarih || x.tarih_capasi.soru}` : ""}${x.kosul?.soru ? ` | yalnızca ${x.kosul.soru}=${x.kosul.deger} ise` : ""}${x.dayanak?.length ? ` | dayanak: ${x.dayanak.join(",")}` : ""}`);
  const sorular = (t.sorular || []).map((q: any) => `${q.kod}: ${q.soru}`);
  return `Roller: ${[...rolAd.values()].join("; ") || "-"}\nAdımlar (id | ad | sahip | süre | bekler):\n${adimlar.join("\n")}\nSoru adayları: ${sorular.join("; ") || "-"}`;
}
// denetçi yamalarını uygular: en fazla 3 adım, 2 soru; döngü ve bilinmeyen kimlik yok
export function denetimUygula(t: any, d: any) {
  const notlar: string[] = [];
  const adimlar: any[] = t.adimlar;
  const roller = new Set((t.roller || []).map((r: any) => r.kod));
  const ids = new Set(adimlar.map((s) => String(s.id)));
  const red: string[] = [];
  const soruKok = (t.sorular || []).map((q: any) => [q.kod, harf(q.kod)]).filter(([, k]: any) => k.length >= 5);
  let n = 0;
  for (const e of (Array.isArray(d?.adim_ekle) ? d.adim_ekle : []).slice(0, 3)) {
    if (!e?.ad || adimlar.some((s) => s.tur_kod === e.tur_kod || nv(s.ad) === nv(e.ad))) continue;
    const ayni = adimlar.find((s) => benzerlik(s.ad, e.ad) >= 0.6);
    if (ayni) { red.push(`Denetçinin önerdiği "${String(e.ad).trim()}" adımı eklenmedi: "${ayni.ad}" adımıyla aynı iş.`); continue; }
    // denetçi yamaları da doğrulanır: ham kod adı, soruyu adım yapma, uzun bekleme, hiçbir şeye bağlanmayan adım
    const ad = String(e.ad).trim();
    if (KOD_AD.test(ad)) { red.push(`Denetçinin önerdiği "${ad}" adımı eklenmedi: ad kod olarak geldi.`); continue; }
    const soru = soruKok.find(([, k]: any) => harf(`${e.tur_kod || ""}${ad}`).includes(k));
    if (soru) { red.push(`Denetçinin önerdiği "${ad}" adımı eklenmedi: bu seçim zaten [${soru[0]}] sorusuyla soruluyor.`); continue; }
    if (Number(e.sure_tahmin_gun) > DENETCI_AZAMI_GUN) { red.push(`Denetçinin önerdiği "${ad}" adımı eklenmedi: ${e.sure_tahmin_gun} günlük ek adım denetimden gelmez; gerekiyorsa elle ekle.`); continue; }
    const bagli = (e.bagimli || []).map(String).some((x: string) => ids.has(x)) || (e.bekleyen || []).map(String).some((x: string) => ids.has(x));
    if (!bagli) { red.push(`Denetçinin önerdiği "${ad}" adımı eklenmedi: hiçbir adıma bağlanmıyor.`); continue; }
    const id = `den${++n}`;
    const rol = roller.has(e.sahip_rol) ? e.sahip_rol : (t.roller || []).find((r: any) => r.tip === "insan")?.kod || (t.roller || [])[0]?.kod;
    adimlar.push({ id, tur_kod: slug(e.tur_kod || e.ad), ad: String(e.ad), sahip_rol: rol, kriter: e.kriter || `${e.ad} tamam`, sure_tahmin_gun: Number(e.sure_tahmin_gun) > 0 ? Number(e.sure_tahmin_gun) : 1, bagimli: (e.bagimli || []).map(String).filter((x: string) => ids.has(x)), boyut: e.boyut && e.boyut in BOYUTLAR ? e.boyut : "genel", kosul: e.kosul?.soru ? e.kosul : null, dayanak: Array.isArray(e.dayanak) ? e.dayanak.map(String) : [], _denetim: true });
    ids.add(id);
    const bek = (e.bekleyen || []).map(String).filter((x: string) => ids.has(x) && x !== id);
    if (bek.length) bagimlilikEkle(adimlar, bek.map((b: string) => ({ id: b, bekledigi: [id] })));
    notlar.push(`"${e.ad}" eklendi${e.neden ? `: ${e.neden}` : ""}`);
  }
  const bag = bagimlilikEkle(adimlar, d?.bagimlilik || []);
  const sorular: any[] = t.sorular || (t.sorular = []);
  const sEk: string[] = [];
  for (const q of (Array.isArray(d?.soru_ekle) ? d.soru_ekle : []).slice(0, 2)) {
    if (!q?.kod || sorular.some((x) => x.kod === q.kod)) continue;
    sorular.push({ ...q, cikarilabilir: false, genel: false, kalici: false, ne_zaman: "simdi", _denetim: true });
    sEk.push(`[${q.kod}] ${q.soru}`);
  }
  const kosul: string[] = [];
  const secimler = new Map<string, any>((t.sorular || []).filter((q: any) => q.tip === "secim" && Array.isArray(q.secenekler) && q.secenekler.length).map((q: any) => [q.kod, q]));
  for (const k of (Array.isArray(d?.kosul_ekle) ? d.kosul_ekle : []).slice(0, 8)) {
    const s = adimlar.find((x) => String(x.id) === String(k?.id)), q = secimler.get(k?.soru);
    if (!s || !q || s.kosul?.soru) continue;
    const degerler = String(k.deger || "").split("|").map((x) => x.trim()).filter((x) => q.secenekler.some((o: any) => nv(o.deger) === nv(x)));
    if (!degerler.length || degerler.length >= q.secenekler.length) continue; // bilinmeyen seçenek ya da her seçenekte gerekli: koşul anlamsız
    s.kosul = { soru: q.kod, deger: degerler.join("|") };
    kosul.push(`"${s.ad}" yalnızca ${q.kod}=${s.kosul.deger} ise${k.neden ? `: ${k.neden}` : ""}`);
  }
  return { adim: notlar, bagimlilik: bag, soru: sEk, not: [...kosul, ...red, ...(d?.notlar || []).map(String).slice(0, 4)] };
}
const KOD_AD = /^[a-z0-9]+(?:[-_][a-z0-9]+)+$/; // "sirket-turu-sec" gibi: boşluksuz, küçük harf, tireli
const DENETCI_AZAMI_GUN = 5;
const benzerlik = (a: unknown, b: unknown) => kelimeBenzer(kokler(a), kokler(b));
const harf = (x: string) => slug(x).replace(/-/g, "");
// iş türü etiketi doğrulaması: motor var olan bir türü seçtiyse işin cümlesiyle ortak kökü olmalı; yoksa yeni tür açılır
const kokSet = (x: string) => new Set(slug(x).split("-").filter((w) => w.length > 3).map((w) => w.slice(0, 5)));
export function turDogrula(t: any, turler: any[], cumle: string) {
  const kod = slug(t.is_turu?.kod || "");
  const tur = kod && turler.find((x: any) => x.kod === kod);
  if (!tur) return [];
  const A = kokSet(`${cumle} ${t.baslik || ""}`), B = kokSet(`${tur.ad || ""} ${tur.kod}`);
  if ([...B].some((w) => A.has(w))) return [];
  const yeni = slug(t.baslik || cumle);
  t.is_turu = { kod: yeni, ad: t.baslik || yeni, mevcut: false, _onceki: kod };
  return [`İş türü "${tur.ad || kod}" bu işle ortak bir şey taşımıyor; yeni tür açıldı: ${yeni}.`];
}
// kurallı doğrulayıcı: bilinmeyen bağımlılık, kendine bağımlılık, döngü, bilinmeyen rol, koşulun bilinmeyen soruya bağlanması
export function kuralDenetimi(t: any) {
  const notlar: string[] = [];
  const adimlar: any[] = t.adimlar || [];
  const ids = new Set(adimlar.map((s) => String(s.id)));
  const roller = new Set((t.roller || []).map((r: any) => r.kod));
  const soruKod = new Set((t.sorular || []).map((q: any) => q.kod));
  for (const s of adimlar) {
    const once = (s.bagimli || []).map(String);
    s.bagimli = [...new Set(once.filter((x: string) => ids.has(x) && x !== String(s.id)))];
    if (s.bagimli.length !== once.length) notlar.push(`"${s.ad}": geçersiz bağımlılık çıkarıldı.`);
    if (!roller.has(s.sahip_rol) && (t.roller || []).length) { const r = (t.roller.find((x: any) => x.tip === "insan") || t.roller[0]).kod; notlar.push(`"${s.ad}": bilinmeyen sahip rolü ${s.sahip_rol} → ${r}.`); s.sahip_rol = r; }
    if (s.kosul?.soru && !soruKod.has(s.kosul.soru)) { notlar.push(`"${s.ad}": koşulu bilinmeyen soruya (${s.kosul.soru}) bağlıydı; koşulsuz yapıldı.`); s.kosul = null; }
  }
  // döngü kır: DFS'de geri kenarı kaldır
  const by = new Map<string, any>(adimlar.map((s) => [String(s.id), s]));
  const renk = new Map<string, number>();
  const gez = (id: string) => {
    renk.set(id, 1);
    const s = by.get(id);
    for (const d of [...(s.bagimli || [])]) {
      if (renk.get(d) === 1) { s.bagimli = s.bagimli.filter((x: string) => x !== d); notlar.push(`"${s.ad}" ↔ "${by.get(d)?.ad}" döngüsü kırıldı.`); }
      else if (!renk.get(d)) gez(d);
    }
    renk.set(id, 2);
  };
  for (const id of by.keys()) if (!renk.get(id)) gez(id);
  // etkisiz soru: hiçbir adımın koşulunda ya da tarih çapasında geçmeyen seçim sorusu sorulmaz; cevabı yok sayılacak bir soru yanıltır
  const kullanilan = new Set(adimlar.flatMap((s) => [s.kosul?.soru, s.tarih_capasi?.soru]).filter(Boolean));
  for (const q of t.sorular || []) {
    if (q.tip !== "secim" || ["hedef_tarih", "ekip", "iliski"].includes(q.kod) || q.ne_zaman === "sonra" || kullanilan.has(q.kod) || (q.dayanak || []).length) continue; // dersten gelen soru öğrenmek için sorulur
    // M6: koşul yok ama bir adım seçenekleri sayıyor ("peşin ya da akreditif"): cevap o adımın içeriğini belirler, soru düşmez
    const ilgili = soruAdimlari(t, q);
    if (ilgili.length) { q._ilgili = ilgili; continue; }
    q._etkisiz = true;
    const qv = bilinmiyorDuzelt(q); // sec() "bilinmiyor" varsayılanı ilk gerçek seçeneğe çevirir; not aynı değeri söylesin
    const o = (qv.secenekler || []).find((x: any) => nv(x.deger) === nv(qv.varsayilan));
    notlar.push(`[${q.kod}] sorusu hiçbir adımı değiştirmiyor; sorulmadı, "${o?.etiket || qv.varsayilan}" varsayıldı. Yanlışsa ilgili adımları kurmadan önce düzelt.`);
  }
  return notlar;
}

export const slug =(s: string) => String(s || "").toLocaleLowerCase("tr").replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "adim";
const nv = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr").trim();
export const BILMIYORUM = /^(bilmiyorum|emin değilim|emin degilim|belirsiz|\?|bilinmiyor)$/i;

const GUN = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
export function kullaniciMesaji(o: { cumle: string; bugun: string; kisi: string; baglam: any; turler: any[]; ogrenim?: string[]; istatistik: string[]; gecmis: string[]; kararlar?: string[]; acikIsler?: string[]; benzer?: string[]; dersler?: string[]; kartlar?: string[]; standart?: string | null }) {
  const g = GUN[new Date(o.bugun + "T12:00:00Z").getUTCDay()];
  const L = [`Bugün: ${o.bugun} (${g}). Akışı kuran: ${o.kisi}.`, `Cümle: "${o.cumle}"`];
  if (o.baglam && Object.keys(o.baglam).length) L.push(`Ek bağlam: ${JSON.stringify(o.baglam)}`);
  if (o.standart) L.push("", "Standart süreç (ekip bu işi böyle yürütmeyi sabitledi; temel al, yalnızca cevaplara ve dallara göre uyarla):", o.standart);
  // iş türü yalnızca etikettir; adım yapısı benzer işlerden, derslerden ve kartlardan gelir
  if (o.turler.length) L.push("", `Kullanılmış iş türü etiketleri (uyuyorsa kodu aynen kullan, yoksa yeni aç): ${o.turler.map((t: any) => `${t.kod} (${t.ad})`).join("; ")}`);
  else L.push("", "Henüz iş türü etiketi yok; yeni bir tür aç.");
  if (o.benzer?.length) L.push("", "Benzer geçmiş işler (bu ekipte gerçekten yaşandı; kod G:<akış>):", ...o.benzer.map((x) => `- ${x}`));
  if (o.dersler?.length) L.push("", "Kanıtlı dersler (kod D<no>; kesin olanları uyuyorsa uygula):", ...o.dersler.map((x) => `- ${x}`));
  if (o.kartlar?.length) L.push("", "Alan bilgi kartları (kaynaklı kurallar; kod K:<kod>):", ...o.kartlar.map((x) => `- ${x}`));
  if (o.ogrenim?.length) L.push("", "Öğrenimler:", ...o.ogrenim.map((x) => `- ${x}`));
  if (o.istatistik.length) L.push("", "Soru istatistikleri (bu ekipte, benzer işler önce):", ...o.istatistik.map((x) => `- ${x}`));
  if (o.kararlar?.length) L.push("", "Geçerli kararlar (kısıt; taslak bunlarla çelişmemeli):", ...o.kararlar.map((x) => `- ${x}`));
  if (o.acikIsler?.length) L.push("", "Bu varlıkta ertelenmiş açık işler:", ...o.acikIsler.map((x) => `- ${x}`));
  if (o.gecmis.length) L.push("", "Aynı varlıkla geçmiş cevaplar (yalnızca ipucu; durum soruları değişmiş olabilir):", ...o.gecmis.map((x) => `- ${x}`));
  return L.join("\n");
}

export type Stat = { n: number; ort: number; kacan: number };
export function sec(t: any, stats: Map<string, Stat>, kacanBoyut: Map<string, number>, gecmisCevap: Record<string, string>, bilinen: Record<string, string> = {}, yanlis: Map<string, number> = new Map()) {
  const sorular: any[] = (Array.isArray(t.sorular) ? t.sorular : []).map(bilinmiyorDuzelt);
  const secilen: any[] = [], varsayim: any[] = [], olu: string[] = [];
  const puanli = sorular.map((q) => {
    const st = stats.get(q.kod);
    const kendi = Math.max(0, Math.min(3, Number(q.etki) || 0));
    let etki = st && st.n >= 2 ? 0.5 * kendi + 0.5 * Math.min(3, st.ort) : kendi;
    etki += 0.5 * Math.min(2, kacanBoyut.get(q.boyut) || 0);
    let belirsiz = q.cikarilabilir ? 0.1 : Math.max(0, Math.min(1, 1 - (Number(q.guven) || 0)));
    const yanlisN = yanlis.get(q.kod) || 0;
    if (yanlisN) { belirsiz = Math.max(belirsiz, 0.8); etki = Math.max(etki, 2); } // bu varsayım daha önce yanlış çıktı: sor
    const isOlu = !yanlisN && !!st && st.n >= 3 && st.ort === 0 && q.tip !== "tarih";
    const ceza = q.genel === true ? 0.5 : 1; // her işte sorulabilecek genel sorular geri planda
    return { q, puan: isOlu ? 0 : belirsiz * etki * ceza, isOlu, yanlisN };
  }).sort((a, b) => b.puan - a.puan);
  // sınırın dışında sorulacaklar: hedef tarih (tarih yoksa) ve ekip; ana sınır bunlar kadar daralır, toplam en fazla 5
  const tarihVar = !!t.hedef_tarih || (Array.isArray(t.adimlar) && t.adimlar.some((s: any) => s.tarih_capasi?.tarih));
  const kisisizRol = (t.roller || []).some((r: any) => r.tip === "insan" && !r.kisi && !ONAYCI.test(r.ad || "")); // uydurma rol riski yoksa ekip sorulmaz
  const ekstra = new Set(sorular.filter((q) => q.ne_zaman !== "sonra" || q.kod === "hedef_tarih" || q.kod === "ekip").filter((q) => (q.kod === "hedef_tarih" && !tarihVar) || (q.kod === "ekip" && kisisizRol)).filter((q) => !(q.kod in bilinen) && !(q.kod in gecmisCevap && q.kalici === true)).map((q) => q.kod));
  const ust = Math.max(3, 5 - ekstra.size);
  const sonra: any[] = [];
  for (const { q, puan, isOlu, yanlisN } of puanli) {
    if (q.kod in bilinen) { varsayim.push({ ...q, cevap: bilinen[q.kod], kaynak: "baglam" }); continue; }
    if (q.ne_zaman === "sonra" && q.kod !== "hedef_tarih" && q.kod !== "ekip" && q.kod !== "iliski") { sonra.push(q); continue; } // iş yürürken cevaplanır
    if (ekstra.has(q.kod)) continue;
    if (q.kod === "ekip" && !kisisizRol) { varsayim.push({ ...q, cevap: q.varsayilan, kaynak: "varsayilan" }); continue; } // adı geçmeyen iş rolü yoksa ekip sorusu gereksiz
    // geçmiş cevap yalnızca kalıcı sorularda ve hiç yanlış çıkmamışsa taşınır
    if (q.kod in gecmisCevap && q.tip !== "tarih" && q.kalici === true && !yanlisN) { varsayim.push({ ...q, cevap: gecmisCevap[q.kod], kaynak: "gecmis" }); continue; }
    if (q._etkisiz && !yanlisN) { olu.push(q.kod); varsayim.push({ ...q, cevap: q.varsayilan, kaynak: "olu" }); continue; }
    if (yanlisN) q.neden = `${q.neden ? q.neden + " " : ""}(Bu varsayım daha önce ${yanlisN} kez yanlış çıktı.)`;
    if (isOlu) olu.push(q.kod);
    const yer = secilen.length < 3 ? puan >= 0.3 : secilen.length < ust && puan >= 1;
    if (yer) secilen.push({ ...q, puan: Math.round(puan * 100) / 100 });
    else varsayim.push({ ...q, cevap: q.varsayilan, kaynak: isOlu ? "olu" : "varsayilan" });
  }
  for (const q of sorular) if (ekstra.has(q.kod)) secilen.push({ ...q, puan: 0, sinir_disi: true });
  return { secilen, varsayim, olu, sonra };
}

// "bilinmiyor" bir seçenek ya da varsayılan değildir: tek biçime ("bilmiyorum", sonda) indirilir; bilinmeyen varsayılan yerine soru sorulur
function bilinmiyorDuzelt(q: any) {
  if (q?.tip !== "secim" || !Array.isArray(q.secenekler)) return q;
  const gercek = q.secenekler.filter((o: any) => !BILMIYORUM.test(nv(o.deger)) && !BILMIYORUM.test(nv(o.etiket)));
  if (!gercek.length) return q;
  const vardi = gercek.length !== q.secenekler.length;
  const vBilinmez = !q.varsayilan || BILMIYORUM.test(nv(q.varsayilan));
  const y = { ...q, secenekler: vardi ? [...gercek, { deger: "bilmiyorum", etiket: "Bilmiyorum" }] : q.secenekler };
  if (vBilinmez) { y.varsayilan = String(gercek[0].deger); y.guven = Math.min(Number(q.guven) || 0.3, 0.3); }
  return y;
}
// cevaplar → adım listesi (validateSteps girdisi) ve soru etkileri
const ONAYCI = /(onay|yönetici|ortak|danışman|direktör|kurul|müdür|yatırımcı|avukat|hukuk|müşavir|denetçi|sponsor)/i;
export function uygula(t: any, secilen: any[], varsayim: any[], cevaplar: Record<string, unknown>, sahip: string, haric: Set<string> = new Set(), sonraSorular: any[] = []) {
  const tum = new Map<string, any>();
  for (const q of varsayim) tum.set(q.kod, { q, cevap: String(q.cevap ?? q.varsayilan ?? ""), kaynak: q.kaynak });
  for (const q of sonraSorular) {
    const c = cevaplar && q.kod in cevaplar ? String(cevaplar[q.kod] ?? "").trim() : "";
    tum.set(q.kod, c && !BILMIYORUM.test(c) ? { q, cevap: cevapCoz(q, c), kaynak: "kullanici" } : { q, cevap: "", kaynak: "sonra" }); // kullanıcı zaten biliyorsa hemen uygulanır
  }
  const acik = (kod: string) => { const k = tum.get(kod)?.kaynak; return k === "bilinmiyor" || k === "sonra"; };
  for (const q of secilen) {
    const c = cevaplar && q.kod in cevaplar ? String(cevaplar[q.kod] ?? "") : null;
    if (c == null || c === "") { tum.set(q.kod, { q, cevap: String(q.varsayilan ?? ""), kaynak: "cevapsiz" }); continue; }
    if (BILMIYORUM.test(c.trim())) { tum.set(q.kod, { q, cevap: c, kaynak: "bilinmiyor" }); continue; }
    tum.set(q.kod, { q, cevap: cevapCoz(q, c), kaynak: "kullanici" });
  }
  const adimlar: any[] = Array.isArray(t.adimlar) ? t.adimlar : [];
  const roller = new Map<string, any>((t.roller || []).map((r: any) => [r.kod, r]));
  const eslesir = (kosul: any, cevap: string) => kosulEslesir(tum.get(kosul.soru)?.q || sorular(t).get(kosul.soru), kosul.deger, cevap);
  const dahil = (s: any, over?: { kod: string; cevap: string }) => {
    if (s.tur_kod && haric.has(s.tur_kod)) return false; // kararı zaten verilmiş adım
    if (!s.kosul || !s.kosul.soru) return true;
    const kod = s.kosul.soru;
    const x = tum.get(kod);
    if (!x) { const q = sorular(t).get(kod); return q ? eslesir(s.kosul, q.varsayilan ?? "") : true; } // tanımsız koşul: adımı koru
    const cevap = over && over.kod === kod ? over.cevap : x.cevap;
    if (!(over && over.kod === kod) && (x.kaynak === "bilinmiyor" || x.kaynak === "sonra")) return true; // kötümser: cevap bilinmiyorsa tüm dalların adımları dahil, Netleştir'i bekler
    return eslesir(s.kosul, cevap);
  };
  const kume = (over?: { kod: string; cevap: string }) => new Set(adimlar.filter((s) => dahil(s, over)).map((s) => s.id));
  // etki
  const etkiler: any[] = [];
  const hedefDegisti = (cevaplar as any)?.hedef_tarih;
  for (const [kod, x] of tum) {
    if (x.kaynak === "varsayilan" || x.kaynak === "gecmis" || x.kaynak === "olu" || x.kaynak === "baglam" || x.kaynak === "sonra") continue;
    let eklenen: string[] = [], cikarilan: string[] = [], puan = 0;
    if (x.q.tip === "tarih") puan = x.cevap && x.cevap !== x.q.varsayilan ? 1 : 0;
    else if (x.q.tip === "metin") puan = 0.5;
    else {
      const a = kume({ kod, cevap: x.cevap }), b = kume({ kod, cevap: String(x.q.varsayilan ?? "") });
      eklenen = [...a].filter((i) => !b.has(i)); cikarilan = [...b].filter((i) => !a.has(i));
      puan = eklenen.length + cikarilan.length;
    }
    const degisen = x.kaynak === "kullanici" ? (x.q._ilgili || []) : [];
    if (degisen.length) puan += 0.5;
    etkiler.push({ kod, boyut: x.q.boyut, soru: x.q.soru, cevap: x.cevap, kaynak: x.kaynak, eklenen, cikarilan, degisen, puan });
  }
  void hedefDegisti;
  const secili = kume();
  const byId = new Map(adimlar.map((s) => [s.id, s]));
  const coz = (id: string, seen: Set<string>): string[] => {
    if (secili.has(id)) return [id];
    if (seen.has(id)) return [];
    seen.add(id);
    return ((byId.get(id) || {}).bagimli || []).flatMap((d: string) => coz(d, seen));
  };
  const liste = adimlar.filter((s) => secili.has(s.id));
  // bilinmeyen sorular için netleştir adımı
  const netlestir: any[] = [];
  for (const [kod, x] of tum) {
    if (x.kaynak !== "bilinmiyor") continue;
    const id = "netlestir-" + kod;
    netlestir.push({ id, tur_kod: "netlestir-" + slug(kod), ad: `Netleştir: ${x.q.soru}`, sahip_rol: "__sahip", kriter: "Cevap netleşti; gereksiz kalan adımlar atlandı, gerekenler devam ediyor", sure_tahmin_gun: 1, bagimli: [], boyut: x.q.boyut, aciklama: x.q.neden, _cevapSoru: kod });
    for (const s of liste) if ((s.kosul && s.kosul.soru === kod) || s.tarih_capasi?.soru === kod) s.bagimli = [...(s.bagimli || []), id];
  }
  // sonradan cevaplanacak sorular: cevabın belli olduğu adım işaretlenir, dal ve tarih adımları onu bekler
  const sonucAdimi: any[] = [];
  const ata = (bas: string, hedef: string) => { const seen = new Set<string>(); const y = [bas]; while (y.length) { const k = y.pop()!; if (k === hedef) return true; if (seen.has(k)) continue; seen.add(k); for (const d of (byId.get(k) || {}).bagimli || []) y.push(String(d)); } return false; };
  for (const [kod, x] of tum) {
    if (x.kaynak !== "sonra") continue;
    let c = liste.find((s) => String(s.id) === String(x.q.cevaplayan_adim || ""));
    if (!c) { c = { id: "sonuc-" + kod, tur_kod: "sonuc-" + slug(kod), ad: `Sonucu kaydet: ${x.q.soru}`, sahip_rol: "__sahip", kriter: "Cevap Devir'e yazıldı", sure_tahmin_gun: 0.5, bagimli: [], boyut: x.q.boyut, aciklama: x.q.neden }; sonucAdimi.push(c); byId.set(c.id, c); }
    c._cevapSoru = kod;
    for (const s of liste) if (s !== c && ((s.kosul && s.kosul.soru === kod) || s.tarih_capasi?.soru === kod) && !(s.bagimli || []).map(String).includes(String(c.id)) && !ata(String(c.id), String(s.id))) s.bagimli = [...(s.bagimli || []), c.id];
  }
  const son = [...netlestir, ...liste, ...sonucAdimi];
  const noOf = new Map(son.map((s, i) => [s.id, i + 1]));
  const TARIH = /^\d{4}-\d{2}-\d{2}$/;
  const capaOf = (s: any): string | null => {
    const c = s.tarih_capasi;
    if (!c) return null;
    if (c.soru) { const x = tum.get(c.soru); if (x && (x.kaynak === "bilinmiyor" || x.kaynak === "sonra")) return null; /* bilinmeyen tarih uydurulmaz; adım Netleştir'i bekler */ const v = x ? x.cevap : null; if (TARIH.test(String(v || ""))) return String(v); }
    return TARIH.test(String(c.tarih || "")) ? String(c.tarih) : null;
  };
  const yalniz = /^(yalniz|yalnız|tek|ben|sadece)/i.test(nv(tum.get("ekip")?.cevap || ""));
  // M6: seçenek sayan adımlara bilinen cevap işlenir (kullanıcının cevabı ya da sorulmadan kabul edilen varsayım)
  const metinCevap = new Map<string, { q: any; d: string[] }[]>();
  for (const [, x] of tum) {
    if (!x.q?._ilgili?.length || x.kaynak === "bilinmiyor" || x.kaynak === "sonra" || !x.cevap) continue;
    const d = cevapDegerleri(x.q, x.cevap).filter((v) => (x.q.secenekler || []).some((o: any) => nv(o.deger) === nv(v)));
    if (d.length) for (const id of x.q._ilgili) metinCevap.set(id, [...(metinCevap.get(id) || []), { q: x.q, d }]);
  }
  const isle = (s: any) => {
    const m = metinCevap.get(String(s.id));
    if (!m) return { ad: s.ad, aciklama: s.aciklama || null };
    let ad = String(s.ad), ac = s.aciklama ? String(s.aciklama) : "";
    for (const { q, d } of m) {
      const re = secenekIfadesi(q), yazi = seceneklerYazi(q, d);
      if (re && re.test(ad)) ad = ad.replace(re, yazi);
      else if (re && re.test(ac)) ac = ac.replace(re, yazi);
      else ac = `${ac ? ac + " " : ""}${q.soru.replace(/\?\s*$/, "")}: ${yazi}.`;
    }
    return { ad, aciklama: ac || null };
  };
  const out = son.map((s) => {
    let r = s.sahip_rol === "__sahip" ? { ad: sahip, tip: "insan" } : roller.get(s.sahip_rol) || { ad: s.sahip_rol, tip: "insan" };
    if (yalniz && r.tip === "insan" && !r.kisi && !ONAYCI.test(r.ad || "")) r = { ad: sahip, tip: "insan" }; // ekip yok: adı geçmeyen iş rolleri kullanıcıya; onaylayanlar üçüncü taraf olarak kalır
    const deps = [...new Set((s.bagimli || []).flatMap((d: string) => (son.some((x) => x.id === d) ? [d] : coz(d, new Set()))))].map((d) => noOf.get(d)).filter((n) => n && n !== noOf.get(s.id));
    const yazi = isle(s);
    return {
      ad: yazi.ad, kisa_ad: s.kisa_ad || null, aciklama: yazi.aciklama, sahip: sahipAdi(r),
      sahip_tip: r.tip === "agent" ? "agent" : r.tip === "dis" ? "dis" : "insan", arac: s.arac || r.arac || null,
      kriter: s.kriter, beklenen_cikti: s.beklenen_cikti || null, karar_kriteri: s.karar_kriteri || null,
      karar_gerekli: typeof s.karar_gerekli === "boolean" ? s.karar_gerekli : null, cikti_bekleniyor: typeof s.cikti_bekleniyor === "boolean" ? s.cikti_bekleniyor : null,
      sure_tahmin_gun: s.sure_tahmin_gun, bagimli: deps, _tur: s.tur_kod || slug(s.ad), _boyut: s.boyut, _capa: capaOf(s), _netlestir: String(s.id).startsWith("netlestir-"),
      _kosul: s.kosul?.soru && acik(s.kosul.soru) ? { soru: s.kosul.soru, deger: String(s.kosul.deger) } : null,
      _capaSoru: s.tarih_capasi?.soru && acik(s.tarih_capasi.soru) ? s.tarih_capasi.soru : null,
      _cevapSoru: s._cevapSoru || null,
    };
  });
  let hedef: string | null = t.hedef_tarih || null;
  const ht = tum.get("hedef_tarih");
  if (ht && ht.kaynak === "kullanici" && /^\d{4}-\d{2}-\d{2}$/.test(ht.cevap)) hedef = ht.cevap;
  const tumCevap: Record<string, string> = {};
  const onayli: Record<string, string> = {}; // yalnızca kullanıcının verdiği ya da bağlamdan/geçmişten gelen cevaplar; varsayımlar taşınmaz
  for (const [k, x] of tum) { tumCevap[k] = x.cevap; if (x.kaynak === "kullanici" || x.kaynak === "baglam" || x.kaynak === "gecmis") onayli[k] = x.cevap; }
  const bekleyen = [...tum].filter(([, x]) => x.kaynak === "bilinmiyor" || x.kaynak === "sonra").map(([kod, x]) => ({ kod, soru: x.q.soru, tip: x.q.tip, secenekler: x.q.secenekler, boyut: x.q.boyut, kaynak: x.kaynak, adim_ad: (son.find((s) => s._cevapSoru === kod) || {}).ad || null }));
  return { adimlar: out, etkiler, hedef, tumCevap, onayli, netlestir: netlestir.map((n) => n.ad), bekleyen };
}
// seçim sorusunda serbest cevabı seçeneğe eşle (etiket, değer ya da evet/hayır eşanlamlıları)
export function esle(q: any, c: string) {
  const ops: any[] = Array.isArray(q.secenekler) ? q.secenekler : [];
  if (q.tip !== "secim" || !ops.length) return c;
  const x = nv(c);
  const hit = ops.find((o) => nv(o.deger) === x) || ops.find((o) => nv(o.etiket) === x) || ops.find((o) => x && (nv(o.etiket).startsWith(x) || x.startsWith(nv(o.deger))));
  if (hit) return String(hit.deger);
  // çekimli serbest cevap (kazandık → kazanildi, kaybettik → kaybedildi): ortak kök en az 4 harf ve tek aday
  const kok = (a: string, b: string) => { const A = slug(a), B = slug(b); let i = 0; while (i < A.length && i < B.length && A[i] === B[i]) i++; return i; };
  const puan = ops.map((o) => Math.max(kok(x, o.deger), kok(x, o.etiket || ""))).map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
  if (puan[0].p >= 4 && (puan.length < 2 || puan[0].p > puan[1].p)) return String(ops[puan[0].i].deger);
  const evet = /^(evet|e|var|olur|yes|tabii|kesinlikle)/i.test(x), hayir = /^(hayır|hayir|yok|h|no|olmaz)/i.test(x);
  const yes = ops.find((o) => /^(evet|var|yes)/i.test(nv(o.deger))), no = ops.find((o) => /^(hayır|hayir|yok|no)/i.test(nv(o.deger)));
  if (evet && yes) return String(yes.deger);
  if (hayir && no) return String(no.deger);
  return c;
}
function sorular(t: any) { return new Map<string, any>((t.sorular || []).map((q: any) => [q.kod, q])); }
// ---------- çoklu seçim (C2) ----------
const OLUMSUZ = /^(hayir|hayır|yok|no|none|gerekmiyor|gerekli degil|gerekli değil|hicbiri|hiçbiri|istemiyorum|olmayacak)$/;
const HEPSI = /^(her ?iki(si)?( de)?|iki(si)? de|ikisi|hepsi( de| birden)?|tümü|tumu|tamamı|tamami|her biri|hepsini|both|all)$/;
const hepsiMi = (x: unknown) => HEPSI.test(nv(x).replace(/[-_]+/g, " ").replace(/\s+/g, " "));
const secimMi = (q: any) => q?.tip === "secim" && Array.isArray(q.secenekler) && q.secenekler.length > 0;
/** Cevabın karşıladığı seçenek değerleri: "her ikisi"/"hepsi" bütün olumlu seçenekleri, "a, b" ya da "a|b" ikisini birden karşılar. */
export function cevapDegerleri(q: any, cevap: unknown): string[] {
  const c = String(cevap ?? "").trim();
  if (!secimMi(q) || !c) return c ? [c] : [];
  const ops: any[] = q.secenekler;
  const var0 = (v: string) => ops.find((o) => nv(o.deger) === nv(v));
  const olumlu = ops.filter((o) => !BILMIYORUM.test(nv(o.deger)) && !OLUMSUZ.test(nv(o.deger)) && !hepsiMi(o.deger) && !hepsiMi(o.etiket));
  const hepsi = (o?: any) => [...new Set([...(o ? [String(o.deger)] : []), ...olumlu.map((x) => String(x.deger))])];
  const tam = ops.find((x) => nv(x.deger) === nv(c) || nv(x.etiket) === nv(c));
  const yay = (o: any) => (hepsiMi(o.deger) || hepsiMi(o.etiket) ? hepsi(o) : [String(o.deger)]);
  if (tam) return yay(tam);
  if (hepsiMi(c)) return hepsi(ops.find((x) => hepsiMi(x.deger) || hepsiMi(x.etiket)));
  const parca = c.split(/\s*(?:\||,|;|\+|\/|&|\sve\s|\sile\s)\s*/i).map((x) => x.trim()).filter(Boolean);
  if (parca.length >= 2) {
    const d = [...new Set(parca.map((x) => var0(esle(q, x))).filter(Boolean).flatMap(yay))];
    if (d.length) return d;
  }
  const o = var0(esle(q, c));
  return o ? yay(o) : [c];
}
/** Serbest cevabı kayda geçecek biçime getirir: tek seçenek değeri ya da birden çoksa "a|b". */
export function cevapCoz(q: any, cevap: unknown) {
  const d = cevapDegerleri(q, cevap);
  return d.length > 1 ? d.join("|") : d[0] ?? String(cevap ?? "");
}
/** Koşul (deger "a|b") bu cevapla sağlanıyor mu? Çoklu cevapta herhangi bir değer yeter. */
export function kosulEslesir(q: any, deger: unknown, cevap: unknown) {
  const D = new Set(String(deger ?? "").split("|").map(nv));
  return [String(cevap ?? ""), ...cevapDegerleri(q, cevap)].some((c) => D.has(nv(c)));
}
const seceneklerYazi = (q: any, d: string[]) => d.map((v) => { const o = (q.secenekler || []).find((x: any) => nv(x.deger) === nv(v)); return o?.etiket || v; }).join(" ve ");
// adın içinde seçenekleri sayan ifade ("peşin ya da akreditif"): cevap belli olunca seçilene indirgenir (M6)
const kacis = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function secenekIfadesi(q: any) {
  const adlar = ([...new Set((q.secenekler || []).flatMap((o: any) => [o.etiket, o.deger]).filter((x: unknown) => x && !BILMIYORUM.test(nv(x)) && String(x).length >= 3).flatMap((x: unknown) => [String(x), nv(x)]))] as string[]) // "İhracatçı" /i ile "ihracatçı"yı tutmaz: Türkçe küçük biçim de aranır.sort((a, b) => b.length - a.length);
  if (adlar.length < 2) return null;
  const A = `(?:${adlar.map(kacis).join("|")})`;
  return new RegExp(`${A}(?:\\s*(?:,|/|\\bya da\\b|\\bveya\\b|\\byahut\\b|\\bya\\b)\\s*${A})+`, "iu");
}
/** Soru hiçbir adımı koşullamıyor ama bir adımın metni seçeneklerini sayıyorsa o adımlar (M6). */
export function soruAdimlari(t: any, q: any): string[] {
  if (!secimMi(q)) return [];
  const re = secenekIfadesi(q);
  return re ? (t.adimlar || []).filter((s: any) => re.test(`${s.ad || ""} · ${s.aciklama || ""} · ${s.kriter || ""}`)).map((s: any) => String(s.id)) : [];
}

// ---------- dil ve sahiplik (m2, m3) ----------
// "(belge, girdi, belge, kanal)" → "(belge, girdi, kanal)"; art arda aynı kelime tek
export function dilDuzelt(x: unknown) {
  let s = String(x ?? "");
  s = s.replace(/\(([^()]*,[^()]*)\)/g, (_m, ic: string) => `(${[...new Map(ic.split(",").map((p) => p.trim()).filter(Boolean).map((p) => [nv(p), p])).values()].join(", ")})`);
  s = s.replace(/(^|\s)([\p{L}\d'’]+)(\s+\2)+(?=\s|[.,;:!?)]|$)/giu, "$1$2");
  return s.replace(/\s{2,}/g, " ").trim();
}
export function dilDenetimi(t: any) {
  const notlar: string[] = [];
  for (const s of t.adimlar || []) for (const k of ["ad", "kisa_ad", "aciklama", "kriter"]) {
    if (!s[k]) continue;
    const y = dilDuzelt(s[k]);
    if (y !== s[k]) { if (k === "ad") notlar.push(`"${s[k]}" adındaki tekrar düzeltildi → "${y}".`); s[k] = y; }
  }
  for (const v of t.varsayimlar || []) if (v?.metin) v.metin = dilDuzelt(v.metin);
  return notlar;
}
const MUHASEBE = /(muhasebe|mali müşavir|mali musavir|smmm|finans)/i;
const URUN_ISI = /(etiket|kalite|analiz|ambalaj|numune|uygunluk|sertifika|laboratuvar|standart)/i;
const GUMRUK = /(gümrük müşavir|gumruk musavir|gümrükçü)/i;
const HEDEF_ULKE = /(ithalat|varış|varis|alıcı ülke|hedef ülke|lucid)/i;
/** Kurallı sahiplik uyarıları (m3): değiştirmez, taslak çıktısında söyler. */
export function sahiplikUyarilari(t: any) {
  const rol = new Map<string, any>((t.roller || []).map((r: any) => [r.kod, r]));
  const notlar: string[] = [];
  for (const s of t.adimlar || []) {
    const r = rol.get(s.sahip_rol); if (!r) continue;
    const rAd = `${r.ad || ""} ${r.kisi || ""}`, metin = `${s.ad} ${s.aciklama || ""}`;
    if (MUHASEBE.test(rAd) && URUN_ISI.test(metin)) notlar.push(`"${s.ad}" ${sahipAdi(r)} üzerinde; etiket, kalite ve ürün uygunluğu genelde üreticinin ya da ihracatçının işidir. Sahibini kullanıcıya sor.`);
    else if (GUMRUK.test(rAd) && HEDEF_ULKE.test(metin)) notlar.push(`"${s.ad}" ${sahipAdi(r)} üzerinde; hedef ülkedeki ithalat ve kayıt işleri genelde alıcının ya da onun temsilcisinin işidir. Sahibini kullanıcıya sor.`);
  }
  return notlar;
}
/** Rol adı ekranda: "Mert (Gümrük müşaviri)"; "Gümrük Müşaviri (Mert)" gibi rol adındaki kişi tekrarlanmaz (m2). */
export function sahipAdi(r: any) {
  if (!r?.kisi) return String(r?.ad || "");
  const rolAd = String(r.ad || "").replace(/\s*\([^)]*\)/g, "").trim();
  return r.tip === "dis" && rolAd && nv(rolAd) !== nv(r.kisi) && !String(r.kisi).includes("(") ? `${r.kisi} (${rolAd})` : String(r.kisi);
}

