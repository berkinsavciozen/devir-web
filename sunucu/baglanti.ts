// Dış katılımcı bağlantı belirteci (N-3): veritabanında düz durmaz. Arama karmayla (link_hash), gösterim için
// belirteç Edge secret'ındaki anahtarla AES-GCM ile şifreli tutulur (link_sifreli); sahip bağlantıyı yine kopyalayabilir.
// Anahtar tanımlı değilse (yükleme sırası) belirteç eskisi gibi link_token'da kalır, anahtar gelince ilk istekte şifrelenir.
import type { DB } from "./core.ts";

export interface Sifre { sifrele(t: string): Promise<string>; coz(s: string): Promise<string> }

export async function karma(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64c = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** DEVIR_BAGLANTI_ANAHTARI: 32 baytlık anahtarın base64'ü. Geçersizse null (düz saklamaya düşülür, sunucu çökmez). */
export async function sifreKur(anahtar: string | undefined | null): Promise<Sifre | null> {
  if (!anahtar) return null;
  let ham: Uint8Array;
  try { ham = b64c(anahtar.trim()); } catch { return null; }
  if (ham.length !== 32) return null;
  const k = await crypto.subtle.importKey("raw", ham, "AES-GCM", false, ["encrypt", "decrypt"]);
  return {
    async sifrele(t) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(t)));
      return `v1:${b64(iv)}:${b64(c)}`;
    },
    async coz(s) {
      const [v, iv, c] = s.split(":");
      if (v !== "v1") throw new Error("Bilinmeyen şifre sürümü.");
      return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64c(iv) }, k, b64c(c)));
    },
  };
}

export function yeniBelirtec() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(b).map((x) => "abcdefghijkmnopqrstuvwxyz23456789"[x % 33]).join("");
}

/** Yeni ya da yenilenen belirteç için satır alanları */
export async function belirtecAlanlari(t: string, sifre: Sifre | null | undefined) {
  return sifre ? { link_hash: await karma(t), link_sifreli: await sifre.sifrele(t), link_token: null } : { link_hash: await karma(t), link_token: t };
}

/** Sahibin göreceği belirteç: şifreliyse çözülür, eski satırda düz değer. Çözülemezse null (bağlantı gösterilmez, yenilenebilir). */
export async function belirtecAc(k: any, sifre: Sifre | null | undefined): Promise<string | null> {
  if (k.link_sifreli) { try { return sifre ? await sifre.coz(k.link_sifreli) : null; } catch { return null; } }
  return k.link_token || null;
}

/** Belirteçten katılımcı: önce karma, karması olmayan eski satırda düz değer */
export async function belirtecBul(db: DB, t: string) {
  return (await db.one("katilimci", { link_hash: await karma(t) })) || (await db.one("katilimci", { link_token: t }));
}

/** Düz belirteci kalan satırları şifreler (anahtar tanımlıyken, sunucu örneği başına bir kez). Kaç satır şifrelendi. */
export async function bekleyenleriSifrele(db: DB, sifre: Sifre) {
  let n = 0;
  for (const k of await db.many("katilimci", { link_sifreli: null }, "created_at")) {
    if (!k.link_token) continue;
    await db.update("katilimci", { id: k.id }, await belirtecAlanlari(k.link_token, sifre));
    n++;
  }
  return n;
}
