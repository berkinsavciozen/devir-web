import { handle } from "../server.ts";
let idc = 1;
const T: Record<string, any[]> = {};
const match = (r: any, w: any) => Object.entries(w).every(([k, v]) => v === null ? r[k] == null : Array.isArray(v) ? v.includes(r[k]) : r[k] === v);
let NOW = Date.parse("2026-10-14T09:00:00+03:00");
const tok = () => Array.from(crypto.getRandomValues(new Uint8Array(12))).map((x) => x.toString(16).padStart(2, "0")).join("");
const DEF: Record<string, () => any> = { adim: () => ({ durum: "sirada", ciktilar: [] }), akis: () => ({ durum: "aktif", kurallar: {}, baglam: {} }), katilimci: () => ({ link_token: tok() }), cikti: () => ({ durum: "taslak", paylasim: "ekip" }) };
const db: any = {
  async one(t: string, w: any) { const r = (T[t] || []).find((r) => match(r, w)); return r ? { ...r } : null; },
  async many(t: string, w: any, o?: string) { const x = (T[t] || []).filter((r) => match(r, w)); return (o ? x.sort((a, b) => (a[o] > b[o] ? 1 : a[o] < b[o] ? -1 : 0)) : x).map((r) => ({ ...r })); },
  async insert(t: string, rows: any[]) { T[t] = T[t] || []; const now = new Date(NOW).toISOString(); const out = rows.map((r) => ({ id: ["adim", "akis", "taslak", "katilimci", "anahtar", "kullanici", "uye", "davet"].includes(t) ? crypto.randomUUID() : idc++, created_at: now, durum_at: now, ...(DEF[t]?.() || {}), ...r })); T[t].push(...out); return out.map((r) => ({ ...r })); },
  async update(t: string, w: any, p: any) { for (const r of T[t] || []) if (match(r, w)) Object.assign(r, p); },
  async delete(t: string, w: any) { T[t] = (T[t] || []).filter((r) => !match(r, w)); },
};
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((x) => x.toString(16).padStart(2, "0")).join("");
const ok = (c: boolean, m: string) => { console.log((c ? "✓ " : "✗ ") + m); if (!c) process.exitCode = 1; };
const B = "https://x.supabase.co/functions/v1/devir-mcp";
async function api(method: string, path: string, body?: any, token = "dv_sahip") {
  NOW += 36e5;
  const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined }), db, NOW, EK);
  return { st: r.status, j: await r.json() };
}
async function mcp(name: string, args: any) {
  NOW += 36e5;
  const r = await handle(new Request(B + "/dv_sahip", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }) }), db, NOW, EK);
  return (await r.json()).result.content[0].text as string;
}


// sahte Supabase: oturum belirteci "jwt:<auth_id>:<eposta>", posta kutusu, kova
const GIDEN: any[] = [];
const KOVA = new Map<string, { boyut: number; tur: string }>();
const SILINEN: string[] = [];
const EK: any = {
  taban: B,
  kimlik: async (j: string) => { const m = /^jwt:([\w-]+):(.+)$/.exec(j); return m ? { id: m[1], email: m[2] } : null; },
  posta: { async girisBaglantisi(e: string, y: string | null) { GIDEN.push({ e, y }); } },
  depo: {
    async yuklemeAdresi(yol: string) { return { url: "https://kova/upload/" + yol + "?token=t", token: "t" }; },
    async indirmeAdresi(yol: string, sn: number, ad: string) { return `https://kova/sign/${yol}?sn=${sn}&ad=${encodeURIComponent(ad)}`; },
    async bilgi(yol: string) { return KOVA.get(yol) || null; },
    async sil(L: string[]) { for (const y of L) { KOVA.delete(y); SILINEN.push(y); } },
  },
};
async function link(method: string, path: string, body?: any, baslik?: string) {
  NOW += 36e5;
  const r = await handle(new Request(B + path, { method, headers: { "content-type": "application/json", ...(baslik ? { "x-devir-baglanti": baslik } : {}) }, body: body ? JSON.stringify(body) : undefined }), db, NOW, EK);
  return { st: r.status, j: await r.json() };
}
const AUTH_BERKIN = "jwt:11111111-1111-4111-8111-111111111111:berkin@ornek.com";
const AUTH_AYSE = "jwt:22222222-2222-4222-8222-222222222222:Ayse@Ornek.com";
const AUTH_YABANCI = "jwt:33333333-3333-4333-8333-333333333333:kimse@ornek.com";
const AUTH_KURUCU = "jwt:44444444-4444-4444-8444-444444444444:kurucu@ornek.com";

(async () => {
  const [ws] = await db.insert("kullanici", [{ ad: "Test alanı" }]);
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Berkin", rol: "sahip", token_hash: await sha("dv_sahip") }, { kullanici_id: ws.id, kisi: "Zeynep", rol: "ekip", token_hash: await sha("dv_ekip") }]);
  const r = await mcp("devir_akis_olustur", { baslik: "Hasat sözleşmeleri", hedef_tarih: "2026-11-20", baglam: { musteri: "Hasat" }, adimlar: [
    { ad: "Aday listesi", sahip: "Berkin", kriter: "liste", sure_tahmin_gun: 2 },
    { ad: "Belge modelini onayla", sahip: "Mali müşavir Ayten", sahip_tip: "dis", kriter: "onay", sure_tahmin_gun: 3, bagimli: [1] },
    { ad: "Sözleşme taslağı", sahip: "Zeynep", kriter: "taslak", sure_tahmin_gun: 2, bagimli: [2] },
  ] });
  const kod = /oluşturuldu: (\w+)/.exec(r)![1];

  // ---- giriş ve davet ----
  let x = await api("GET", "/api/v1/ben", null, "jwt:bozuk");
  ok(x.st === 401, "geçersiz oturum 401");
  x = await api("GET", "/api/v1/ozet", null, AUTH_BERKIN);
  ok(x.st === 403 && /üye değilsin/.test(x.j.hata), "üyeliği olmayan oturum ana ekranı göremez");
  x = await api("GET", "/api/v1/ben", null, AUTH_BERKIN);
  ok(x.j.ok && x.j.kayit_gerekli && x.j.eposta === "berkin@ornek.com", "ben: kayıt gerekli");
  x = await api("POST", "/api/v1/kayit", { alan_adi: "Yeni alan" }, AUTH_BERKIN);
  ok(x.st === 403 && /davetle/.test(x.j.hata), "açık kayıt kapalıyken yeni alan açılamaz");

  // davet güven ayarıdır: sahip anahtarıyla yapılamaz (S-C1); alanı kuran sahip e-postalı oturumla davet eder
  const [kurucu] = await db.insert("uye", [{ auth_id: "44444444-4444-4444-8444-444444444444", eposta: "kurucu@ornek.com", kullanici_id: ws.id, kisi: "Kurucu", rol: "sahip" }]);
  x = await api("POST", "/api/v1/davet", { eposta: "Berkin@Ornek.com", kisi: "Berkin", rol: "sahip" });
  ok(x.st === 403 && /e-postayla giriş/.test(x.j.hata) && !GIDEN.length, "sahip anahtarıyla davet edilemez (S-C1)");
  x = await api("GET", "/api/v1/uyeler");
  ok(x.j.ok && x.j.uyeler.length === 1, "anahtarla üye listesi okunur");
  x = await api("POST", "/api/v1/davet", { eposta: "Berkin@Ornek.com", kisi: "Berkin", rol: "sahip" }, AUTH_KURUCU);
  ok(x.j.ok && x.j.gonderildi && GIDEN[0]?.e === "berkin@ornek.com", "davet: e-posta küçük harfe çevrildi, giriş bağlantısı gönderildi");
  x = await api("POST", "/api/v1/davet", { eposta: "ayse@ornek.com", kisi: "Ayşe", rol: "dis", kapsam: "Mali müşavir Ayten" }, AUTH_KURUCU);
  ok(x.j.ok && x.j.davet.kapsam === "Mali müşavir Ayten", "dış davet kapsamla");
  x = await api("POST", "/api/v1/davet", { eposta: "zeynep@ornek.com" }, "dv_ekip");
  ok(x.st === 403, "ekip davet edemez");
  x = await api("POST", "/api/v1/davet", { eposta: "bozuk" }, AUTH_KURUCU);
  ok(x.st === 400, "geçersiz e-posta reddedildi");

  x = await api("GET", "/api/v1/ben", null, AUTH_BERKIN);
  ok(x.j.bekleyen_davetler?.length === 1 && x.j.bekleyen_davetler[0].alan === "Test alanı", "ben: bekleyen davet görünüyor");
  x = await api("POST", "/api/v1/kayit", {}, AUTH_BERKIN);
  ok(x.j.ok && x.j.katildi?.rol === "sahip" && x.j.katildi.kisi === "Berkin", "kayıt: tek davete katıldı");
  x = await api("GET", "/api/v1/ozet", null, AUTH_BERKIN);
  ok(x.j.ok && x.j.rol === "sahip" && x.j.akislar?.length === 1, "oturumla ana ekran açıldı");
  x = await api("POST", "/api/v1/ben/anahtar", {}, AUTH_BERKIN);
  ok(x.j.ok && x.j.token?.startsWith("dv_") && !x.j.mcp_adresi.includes("dv_") && !!x.j.anahtar.son_gecerlilik, "oturumdan anahtar üretildi: adreste değil, süreli");
  const yeniTok = x.j.token;
  x = await api("GET", "/api/v1/ben", null, yeniTok);
  ok(x.j.kisi === "Berkin" && x.j.rol === "sahip", "üretilen anahtar çalışıyor");

  x = await api("POST", "/api/v1/kayit", {}, AUTH_AYSE);
  ok(x.j.ok && x.j.katildi?.rol === "dis" && x.j.katildi.eposta === "ayse@ornek.com", "Ayşe dış rolle katıldı (büyük harfli e-posta eşleşti)");
  x = await api("GET", `/api/v1/akis/${kod}`, null, AUTH_AYSE);
  ok(x.j.ok && x.j.adimlar.length === 1 && x.j.adimlar[0].no === 2, "dış üye yalnızca kendi adımını görüyor");
  x = await api("GET", "/api/v1/kararlar", null, AUTH_AYSE);
  ok(x.st === 403, "dış üye kararları göremez");

  await db.update("uye", { id: kurucu.id }, { kullanici_id: "ayrildi" }); // kurucu ayrıldı: tek sahip Berkin
  x = await api("GET", "/api/v1/uyeler", null, AUTH_BERKIN);
  ok(x.j.uyeler?.length === 2 && x.j.uyeler.some((u: any) => u.ben), "üyeler listesi (oturumla, sahip)");
  const ayseId = x.j.uyeler.find((u: any) => u.rol === "dis").id;
  const berkinId = x.j.uyeler.find((u: any) => u.rol === "sahip").id;
  x = await api("POST", `/api/v1/uye/${berkinId}`, { rol: "ekip" }, AUTH_BERKIN);
  ok(x.st === 400 && /en az bir sahip/.test(x.j.hata), "tek sahip rolünü düşüremez");
  x = await api("GET", "/api/v1/ozet", null, AUTH_YABANCI);
  ok(x.st === 403, "davetsiz kişi giremez");
  x = await api("GET", "/api/v1/ozet?alan=" + crypto.randomUUID(), null, AUTH_BERKIN);
  ok(x.st === 403 && /üye değilsin/.test(x.j.hata), "üye olmadığı alan seçilemez");
  await db.insert("ayar", [{ anahtar: "acik_kayit", deger: "evet" }]);
  x = await api("POST", "/api/v1/kayit", { alan_adi: "Kimse Ltd", kisi: "Kimse" }, AUTH_YABANCI);
  ok(x.j.ok && x.j.acildi?.rol === "sahip" && x.j.acildi.alan === "Kimse Ltd", "açık kayıtta yeni alan açıldı");
  x = await api("GET", `/api/v1/akis/${kod}`, null, AUTH_YABANCI);
  ok(x.st === 404, "başka alanın akışı görünmez");

  // ---- dosya ----
  x = await api("POST", `/api/v1/akis/${kod}/adim/1/dosya`, { ad: "liste.exe", tur: "application/x-msdownload", boyut: 100 }, AUTH_BERKIN);
  ok(x.st === 400 && /türü/.test(x.j.hata), "izinsiz tür reddedildi");
  x = await api("POST", `/api/v1/akis/${kod}/adim/1/dosya`, { ad: "liste.pdf", tur: "application/pdf", boyut: 30 * 1024 * 1024 }, AUTH_BERKIN);
  ok(x.st === 400 && /20 MB/.test(x.j.hata), "20 MB üstü reddedildi");
  x = await api("POST", `/api/v1/akis/${kod}/adim/1/dosya`, { ad: "Aday listesi (Ekim).pdf", tur: "application/pdf", boyut: 1200 }, AUTH_BERKIN);
  ok(x.j.ok && x.j.yukleme.yontem === "PUT" && x.j.dosya.durum === "bekliyor", "yükleme adresi verildi");
  const d1 = x.j.dosya.id;
  const yol1 = T.dosya.find((d: any) => d.id === d1).yol;
  ok(yol1.startsWith(ws.id + "/") && yol1.endsWith("Aday_listesi_Ekim_.pdf"), "kova yolu alan/akış/adım altında, güvenli adla");
  x = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "tamam", cikti: { dosya: d1, ozet: "12 aday" } }, AUTH_BERKIN);
  ok(x.st === 400 && /henüz yüklenmemiş/.test(x.j.hata), "yüklenmeden çıktı yapılamaz");
  KOVA.set(yol1, { boyut: 1180, tur: "application/pdf" });
  x = await api("POST", `/api/v1/akis/${kod}/adim/1`, { durum: "tamam", cikti: { dosya: d1, ozet: "12 aday", paylasim: "dis" } }, AUTH_BERKIN);
  const c1 = x.j.adim?.ciktilar?.[0];
  ok(x.j.ok && c1?.dosya_id === d1 && c1.url === null && c1.ad === "Aday listesi (Ekim).pdf", "dosya çıktı olarak adıma bağlandı");
  ok(T.dosya.find((d: any) => d.id === d1).durum === "yuklendi" && T.dosya.find((d: any) => d.id === d1).boyut === 1180, "dosya yüklendi işaretlendi, gerçek boyut yazıldı");
  x = await api("GET", `/api/v1/dosya/${d1}`, null, AUTH_BERKIN);
  ok(x.j.ok && /sn=600/.test(x.j.url), "ekip indirme adresi aldı (10 dk)");
  x = await api("GET", `/api/v1/dosya/${d1}`, null, AUTH_AYSE);
  ok(x.j.ok, "dış üye kendi adımının girdisi olan dışa açık dosyayı indirebilir");
  x = await api("GET", `/api/v1/dosya/${d1}`, null, AUTH_YABANCI);
  ok(x.st === 404, "başka alan dosyayı göremez");

  // ekibe özel dosya dışa görünmez
  x = await api("POST", `/api/v1/akis/${kod}/adim/3/dosya`, { ad: "taslak.docx", tur: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", boyut: 500 });
  const d3 = x.j.dosya.id; KOVA.set(T.dosya.find((d: any) => d.id === d3).yol, { boyut: 500, tur: "x" });
  x = await api("POST", `/api/v1/akis/${kod}/adim/3`, { not: "ilk taslak", cikti: { dosya: d3, ozet: "taslak" } });
  ok(x.j.ok, "anahtarla dosya çıktısı");
  x = await api("GET", `/api/v1/dosya/${d3}`, null, AUTH_AYSE);
  ok(x.st === 403, "ekibe özel dosya dış üyeye kapalı");
  x = await api("POST", `/api/v1/akis/${kod}/adim/3/dosya`, { ad: "a.pdf", tur: "application/pdf", boyut: 5 }, AUTH_AYSE);
  ok(x.st === 403, "dış üye başkasının adımına dosya yükleyemez");

  // dış katılımcı bağlantısı
  x = await api("POST", `/api/v1/akis/${kod}/katilimci`, { ad: "Mali müşavir Ayten" });
  const lt = T.katilimci[0].link_token;
  x = await link("GET", `/l/${lt}`);
  ok(x.j.adimlar[0].girdiler[0]?.dosya_id === d1, "bağlantıda girdi dosyası görünüyor");
  // N-3: belirteç başlıkta, yolda değil
  x = await link("GET", "/l", undefined, lt);
  ok(x.st === 200 && x.j.adimlar[0].girdiler[0]?.dosya_id === d1, "bağlantı belirteci başlıkla açılır (adres yolunda belirteç yok)");
  x = await link("GET", `/l/dosya/${d1}`, undefined, lt);
  ok(x.j.ok && x.j.url.includes("sign"), "başlıkla bağlantıdan dosya indirilir");
  x = await link("GET", `/l/dosya/${d3}`, undefined, lt);
  ok(x.st === 403, "başlıkla da ekibe özel dosya açılmaz");
  x = await link("GET", "/l", undefined, "yanlis-belirtec");
  ok(x.st === 404, "yanlış belirteç başlıkla da açılmaz");
  x = await link("GET", `/l/${lt}/dosya/${d1}`);
  ok(x.j.ok && x.j.url.includes("sign"), "bağlantıdan girdi dosyası indirildi");
  x = await link("GET", `/l/${lt}/dosya/${d3}`);
  ok(x.st === 403, "bağlantıdan ekibe özel dosya açılmaz");
  x = await link("POST", `/l/${lt}/dosya`, { no: 3, ad: "x.pdf", tur: "application/pdf", boyut: 9 });
  ok(x.st === 403, "bağlantıdan başkasının adımına yükleme yok");
  x = await link("POST", `/l/${lt}/dosya`, { no: 2, ad: "onay.jpg", tur: "image/jpeg", boyut: 900 });
  ok(x.j.ok && x.j.yukleme?.url, "bağlantıdan kendi adımına yükleme adresi");
  const d2 = x.j.dosya.id; KOVA.set(T.dosya.find((d: any) => d.id === d2).yol, { boyut: 900, tur: "image/jpeg" });
  x = await link("POST", `/l/${lt}`, { no: 2, eylem: "tamam", metin: "Onaylandı", cikti: { dosya: d2, ozet: "imzalı onay" } });
  ok(x.j.ok && x.j.adimlar[0].durum === "tamam" && x.j.adimlar[0].ciktilar[0]?.dosya_id === d2, "bağlantıdan dosyalı tamam");
  ok(T.dosya.find((d: any) => d.id === d2).kim === "Mali müşavir Ayten" && T.dosya.find((d: any) => d.id === d2).kim_tip === "dis", "dosya kaydında yükleyen dış kişi");

  x = await api("GET", `/api/v1/akis/${kod}/dosyalar`, null, AUTH_BERKIN);
  ok(x.j.dosyalar?.length === 3, "akışın dosyaları listelendi");
  x = await api("GET", `/api/v1/akis/${kod}/dosyalar`, null, AUTH_AYSE);
  ok(x.j.dosyalar?.length === 2, "dış üye yalnızca görebildiği dosyaları görüyor");

  // KVKK silme
  x = await api("POST", `/api/v1/dosya/${d3}/sil`, {}, AUTH_AYSE);
  ok(x.st === 403, "dış üye dosya silemez");
  x = await api("POST", `/api/v1/dosya/${d3}/sil`, {}, "dv_ekip");
  ok(x.j.silinen === 1 && SILINEN.length === 1, "ekip tek dosyayı sildi");
  ok(T.cikti.find((c: any) => c.adim_no === 3).url === null, "silinen dosyanın çıktı bağlantısı boşaldı");
  x = await api("POST", `/api/v1/akis/${kod}/dosyalari-sil`, {}, "dv_ekip");
  ok(x.st === 403, "akışın bütün dosyalarını yalnızca sahip siler");
  x = await api("POST", `/api/v1/akis/${kod}/dosyalari-sil`, {}, AUTH_BERKIN);
  ok(x.j.silinen === 2 && KOVA.size === 0, "sahip akışın kalan dosyalarını sildi");
  x = await api("GET", `/api/v1/dosya/${d1}`, null, AUTH_BERKIN);
  ok(x.st === 404, "silinen dosya indirilemez");

  // üye çıkarma
  x = await api("POST", `/api/v1/uye/${ayseId}/cikar`, {}, AUTH_BERKIN);
  ok(x.j.cikarildi, "dış üye çıkarıldı");
  x = await api("GET", "/api/v1/ozet", null, AUTH_AYSE);
  ok(x.st === 403, "çıkarılan üye giremez");

  // akış kapsamlı ekip (0.11.0): uye/anahtar kapsamı "akis:KOD"
  const r2 = await mcp("devir_akis_olustur", { baslik: "Fuar hazırlığı", hedef_tarih: "2026-11-30", adimlar: [{ ad: "Stant", sahip: "Berkin", kriter: "stant", sure_tahmin_gun: 2 }] });
  const kod2 = /oluşturuldu: (\w+)/.exec(r2)![1];
  await db.insert("anahtar", [{ kullanici_id: ws.id, kisi: "Selin", rol: "ekip", kapsam: `akis:${kod2}`, token_hash: await sha("dv_selin") }, { kullanici_id: ws.id, kisi: "Zeynep", rol: "ekip", kapsam: `akis:${kod2}`, token_hash: await sha("dv_zeynep2") }]);
  x = await api("GET", "/api/v1/ozet", null, "dv_selin");
  ok(x.j.ok && x.j.akislar.map((k: any) => k.kod).join() === kod2, "kapsamlı ekip yalnız seçili akışı görür");
  x = await api("GET", `/api/v1/akis/${kod}`, null, "dv_selin");
  ok(!x.j.ok && x.st >= 400, "kapsam dışı akış açılmaz");
  x = await api("GET", "/api/v1/akislar?durum=hepsi", null, "dv_selin");
  ok(x.j.akislar?.length === 1, "akış listesi kapsamla süzülür");
  x = await api("GET", "/api/v1/ozet", null, "dv_zeynep2");
  ok(x.j.akislar?.length === 2, "kendi adımı olan akış kapsam dışında da görünür");
  x = await api("GET", "/api/v1/ozet", null, "dv_ekip");
  ok(x.j.akislar?.length === 2, "kapsamsız ekip bütün akışları görür");

  // mevcut anahtar akışı bozulmadı
  x = await api("GET", "/api/v1/ozet");
  ok(x.j.ok && x.j.rol === "sahip", "dv_ anahtarıyla eski yol çalışıyor");
  console.log(process.exitCode ? "BAŞARISIZ" : "hepsi geçti");
})();
