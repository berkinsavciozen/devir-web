// API yanıt türleri (knowledge/claude/devir-api.md, sunucu 0.9.0). Yalnız arayüzün kullandığı alanlar.
export type Rol = 'sahip' | 'ekip' | 'dis';
export interface Uyelik { id: string; eposta: string; kisi: string; rol: Rol; kapsam: string | null; alan_id: string; alan: string; katildi: string; son_giris: string | null }
export interface Davet { id: string; eposta: string; kisi: string | null; rol: Rol; kapsam: string | null; davet_eden: string | null; tarih: string; alan_id?: string; alan?: string }
export interface Ben {
  ok: true; eposta?: string; acik_kayit?: boolean; uyelikler?: Uyelik[]; bekleyen_davetler?: Davet[]; kayit_gerekli?: boolean;
  kisi?: string; rol?: Rol; kapsam?: string | null; calisma_alani?: { id: string; ad: string };
  /** OAuth ile bağlı istemcinin (Claude, ChatGPT) son MCP çağrısı */
  mcp_son_kullanim?: string | null;
  /** referansla gelip onay bekleyen (0.28.0, karar 4.B) */
  bekleme?: { durum: 'bekliyor' | 'onaylandi' | 'reddedildi' | 'katildi'; tarih: string } | null;
}
export interface OzetParca { tur: 'metin' | 'kisi' | 'adim' | 'akis' | 'sure' | 'tarih' | 'uyari'; metin: string; ref?: { akis?: string; no?: number; tarih?: string } }
