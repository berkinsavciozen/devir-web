/**
 * Kimlik: iki yol (SPESIFIKASYON §5 A).
 *  - E-postayla giriş: Supabase Auth sihirli bağlantı (PKCE). İstekler `Bearer <oturum belirteci>` taşır.
 *  - Devir anahtarı (`dv_…`): web'de yalnız oturum süresince (sessionStorage) tutulur.
 * Sahte kipte Supabase'e gidilmez; oturum senaryodan kurulur.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SAHTE } from './ortam';

export interface Kimlik {
  /** Authorization başlığına girecek değer (oturum belirteci ya da dv_ anahtarı); yoksa null */
  belirtec(): Promise<string | null>;
  /** 401 sonrası bir kez: oturumu yenile; yenilenemezse false */
  yenile(): Promise<boolean>;
  girisBaglantisi(eposta: string): Promise<void>;
  /** /giris dönüşü: ?code= → oturum */
  kodDegistir(kod: string): Promise<{ eposta: string }>;
  eposta(): Promise<string | null>;
  anahtarlaGir(anahtar: string): void;
  cikis(): Promise<void>;
}

const ANAHTAR_YERI = 'devir:anahtar';
const oku = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const yaz = (k: string, v: string | null) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* gizli pencere */ } };

function gercekKimlik(): Kimlik {
  let sb: Promise<SupabaseClient> | null = null;
  const al = () => (sb ||= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANAHTAR, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: false } })));
  return {
    async belirtec() {
      const a = oku(ANAHTAR_YERI); if (a) return a;
      const { data } = await (await al()).auth.getSession();
      return data.session?.access_token ?? null;
    },
    async yenile() {
      if (oku(ANAHTAR_YERI)) return false;
      const { data, error } = await (await al()).auth.refreshSession();
      return !error && !!data.session;
    },
    async girisBaglantisi(eposta) {
      // shouldCreateUser: false → davetsiz kişiye bağlantı gitmez; hata dönse de ekran ilerler (e-posta varlığı sızmasın)
      await (await al()).auth.signInWithOtp({ email: eposta, options: { emailRedirectTo: `${location.origin}/giris`, shouldCreateUser: false } }).catch(() => undefined);
    },
    async kodDegistir(kod) {
      const { data, error } = await (await al()).auth.exchangeCodeForSession(kod);
      if (error || !data.session) throw new Error(error?.message || 'Giriş bağlantısı açılamadı.');
      yaz(ANAHTAR_YERI, null);
      return { eposta: data.session.user.email || '' };
    },
    async eposta() {
      const { data } = await (await al()).auth.getSession();
      return data.session?.user.email ?? null;
    },
    anahtarlaGir(anahtar) { yaz(ANAHTAR_YERI, anahtar.trim()); },
    async cikis() { yaz(ANAHTAR_YERI, null); await (await al()).auth.signOut().catch(() => undefined); },
  };
}

/** Sahte oturum: "sahte:<auth_id>:<eposta>" belirteci; sahte sunucunun kimlik işlevi bunu çözer. */
function sahteKimlik(): Kimlik {
  const OTURUM = 'devir:sahte-oturum';
  const okuL = () => { try { return localStorage.getItem(OTURUM); } catch { return null; } };
  const yazL = (v: string | null) => { try { if (v == null) localStorage.removeItem(OTURUM); else localStorage.setItem(OTURUM, v); } catch { /* yok */ } };
  return {
    async belirtec() { return oku(ANAHTAR_YERI) || okuL(); },
    async yenile() { return false; },
    async girisBaglantisi() { /* e-posta gitmez; A1b'ye geçilir */ },
    async kodDegistir(kod) {
      // sahte bağlantı: /giris?code=<auth_id>:<eposta>
      const [id, eposta] = kod.split(':');
      if (!id || !eposta) throw new Error('Giriş bağlantısı açılamadı.');
      yazL(`sahte:${id}:${eposta}`);
      return { eposta };
    },
    async eposta() { return okuL()?.split(':')[2] ?? null; },
    anahtarlaGir(anahtar) { yaz(ANAHTAR_YERI, anahtar.trim()); },
    async cikis() { yaz(ANAHTAR_YERI, null); yazL(null); },
  };
}

export const kimlik: Kimlik = SAHTE ? sahteKimlik() : gercekKimlik();
