/**
 * Kimlik: iki yol (SPESIFIKASYON §5 A).
 *  - E-postayla giriş: Supabase Auth sihirli bağlantı (örtük akış). İstekler `Bearer <oturum belirteci>` taşır.
 *    PKCE'den vazgeçildi (20 Eki): PKCE doğrulayıcısı bağlantıyı isteyen tarayıcıda durur; e-posta başka tarayıcıda
 *    (telefondaki posta uygulaması, başka profil) açılınca kod değiştirilemiyor ve kullanıcı "süresi dolmuş" görüyordu.
 *  - Devir anahtarı (`dv_…`): web'de yalnız oturum süresince (sessionStorage) tutulur.
 *  - OAuth onayı (MK-1): Claude/ChatGPT bağlayıcısı Supabase Auth'a gelir, kişi /oauth/onay'da izin verir.
 * Sahte kipte Supabase'e gidilmez; oturum senaryodan kurulur.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SAHTE } from './ortam';
import { arama, tamAdres } from '../yonlendirme';

export interface Kimlik {
  /** Authorization başlığına girecek değer (oturum belirteci ya da dv_ anahtarı); yoksa null */
  belirtec(): Promise<string | null>;
  /** 401 sonrası bir kez: oturumu yenile; yenilenemezse false */
  yenile(): Promise<boolean>;
  /** sonra: girişten sonra açılacak yol (ör. OAuth onayı) */
  girisBaglantisi(eposta: string, sonra?: string): Promise<void>;
  /** /giris dönüşü (#access_token=…, ?token_hash=…&type=… ya da eski ?code=) → oturum */
  donusIsle(d: Donus): Promise<{ eposta: string }>;
  eposta(): Promise<string | null>;
  anahtarlaGir(anahtar: string): void;
  cikis(): Promise<void>;
  /** OAuth onay isteği: onay gerekiyorsa istemci bilgisi, daha önce izin verildiyse doğrudan dönüş adresi */
  oauthAyrinti(id: string): Promise<OauthAyrinti>;
  /** Onay ya da ret; istemcinin dönüş adresi */
  oauthKarar(id: string, onay: boolean): Promise<string>;
  /** İzin verilmiş istemciler (Claude, ChatGPT, Claude Code) */
  istemciler(): Promise<BagliIstemci[]>;
  istemciKaldir(id: string): Promise<void>;
}

export type OauthAyrinti = { tur: 'onay'; istemci: string; site: string | null; eposta: string } | { tur: 'yonlen'; adres: string };
export interface BagliIstemci { id: string; ad: string; site: string | null; tarih: string }

/** /giris adresinin taşıdığı giriş bilgisi; hangisi geldiyse o dolu. */
export type Donus =
  | { tur: 'belirtec'; access: string; refresh: string }
  | { tur: 'hash'; tokenHash: string; tip: string }
  | { tur: 'kod'; kod: string };

const ANAHTAR_YERI = 'devir:anahtar';
const oku = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const yaz = (k: string, v: string | null) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* gizli pencere */ } };

function gercekKimlik(): Kimlik {
  let sb: Promise<SupabaseClient> | null = null;
  const al = () => (sb ||= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANAHTAR, { auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: false } })));
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
    async girisBaglantisi(eposta, sonra) {
      // Kayıt herkese açık (15 Eki kararı): yeni e-postaya da bağlantı gider; hata dönse de ekran ilerler (e-posta varlığı sızmasın)
      const donus = tamAdres('/giris') + (sonra ? `?sonra=${encodeURIComponent(sonra)}` : '');
      await (await al()).auth.signInWithOtp({ email: eposta, options: { emailRedirectTo: donus, shouldCreateUser: true } }).catch(() => undefined);
    },
    async donusIsle(d) {
      const auth = (await al()).auth;
      const { data, error } =
        d.tur === 'belirtec' ? await auth.setSession({ access_token: d.access, refresh_token: d.refresh })
        : d.tur === 'hash' ? await auth.verifyOtp({ token_hash: d.tokenHash, type: d.tip as 'email' | 'magiclink' | 'signup' | 'invite' })
        // eski PKCE bağlantısı: yalnız isteyen tarayıcıda açılır
        : await auth.exchangeCodeForSession(d.kod);
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
    async oauthAyrinti(id) {
      const { data, error } = await (await al()).auth.oauth.getAuthorizationDetails(id);
      if (error || !data) throw new Error(error?.message || 'Bağlantı isteği bulunamadı.');
      if (!('authorization_id' in data)) return { tur: 'yonlen', adres: data.redirect_url };
      return { tur: 'onay', istemci: data.client.name || 'Bir uygulama', site: data.client.uri || null, eposta: data.user.email };
    },
    async oauthKarar(id, onay) {
      const o = (await al()).auth.oauth;
      const { data, error } = onay ? await o.approveAuthorization(id, { skipBrowserRedirect: true }) : await o.denyAuthorization(id, { skipBrowserRedirect: true });
      if (error || !data) throw new Error(error?.message || 'İstek tamamlanamadı.');
      return data.redirect_url;
    },
    async istemciler() {
      const { data, error } = await (await al()).auth.oauth.listGrants();
      if (error) throw new Error(error.message);
      return (data || []).map((g) => ({ id: g.client.id, ad: g.client.name || 'Adsız uygulama', site: g.client.uri || null, tarih: g.granted_at }));
    },
    async istemciKaldir(id) {
      const { error } = await (await al()).auth.oauth.revokeGrant({ clientId: id });
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Sahte oturum: "sahte:<auth_id>:<eposta>" belirteci; sahte sunucunun kimlik işlevi bunu çözer.
 * Senaryonun kişisi kendiliğinden oturum açmış sayılır; `?oturum=yok` ya da "Çıkış" giriş ekranını açar.
 */
const SAHTE_KISI: Record<string, string> = {
  berkin: 'sahte-berkin:berkin@ornek.com', 'iki-alan': 'sahte-berkin:berkin@ornek.com', bos: 'sahte-berkin-yeni:berkin@ornek.com',
  davetli: 'sahte-emre:emre@ornek.com', davetsiz: 'sahte-davetsiz:emre.k@ornek.com',
};
function sahteKimlik(): Kimlik {
  const OTURUM = 'devir:sahte-oturum', CIKTI = 'devir:sahte-cikti', ISTEMCI = 'devir:sahte-istemci';
  const q = arama();
  if (q.get('oturum') === 'yok') yaz(CIKTI, '1');
  const senaryoKisi = () => SAHTE_KISI[q.get('senaryo') || oku('devir:senaryo') || 'berkin'] || SAHTE_KISI.berkin;
  const okuL = () => oku(OTURUM) || (oku(CIKTI) ? null : `sahte:${senaryoKisi()}`);
  return {
    async belirtec() { return oku(ANAHTAR_YERI) || okuL(); },
    async yenile() { return false; },
    async girisBaglantisi() { /* e-posta gitmez; A1b'ye geçilir */ },
    async donusIsle(d) {
      // sahte bağlantı: /giris?code=<auth_id>:<eposta>
      const [id, eposta] = d.tur === 'kod' ? d.kod.split(':') : [];
      await new Promise((r) => setTimeout(r, 600)); // ağ gecikmesi (A1c görünsün)
      if (!id || !eposta) throw new Error('Giriş bağlantısı açılamadı.');
      yaz(OTURUM, `sahte:${id}:${eposta}`); yaz(CIKTI, null);
      return { eposta };
    },
    async eposta() { return okuL()?.split(':')[2] ?? null; },
    anahtarlaGir(anahtar) { yaz(ANAHTAR_YERI, anahtar.trim()); yaz(CIKTI, null); },
    async cikis() { yaz(ANAHTAR_YERI, null); yaz(OTURUM, null); yaz(CIKTI, '1'); },
    // sahte OAuth: istek kimliği "yonlen" ise daha önce izin verilmiş sayılır
    async oauthAyrinti(id) {
      if (id === 'yonlen') return { tur: 'yonlen', adres: tamAdres('/') };
      if (!id || id === 'gecersiz') throw new Error('Bağlantı isteği bulunamadı ya da süresi doldu.');
      return { tur: 'onay', istemci: 'Claude', site: 'https://claude.ai', eposta: okuL()?.split(':')[2] || '' };
    },
    async oauthKarar(_id, onay) {
      if (onay) yaz(ISTEMCI, JSON.stringify([{ id: 'sahte-claude', ad: 'Claude', site: 'https://claude.ai', tarih: new Date().toISOString() }]));
      return tamAdres(onay ? '/?oauth=onaylandi' : '/?oauth=reddedildi');
    },
    async istemciler() {
      const k = oku(ISTEMCI);
      if (k) { try { return JSON.parse(k); } catch { return []; } }
      return q.get('senaryo') === 'bos' ? [] : [{ id: 'sahte-claude', ad: 'Claude', site: 'https://claude.ai', tarih: '2026-10-21T08:30:00.000Z' }];
    },
    async istemciKaldir(id) { const l = (await this.istemciler()).filter((x: BagliIstemci) => x.id !== id); yaz(ISTEMCI, JSON.stringify(l)); },
  };
}

export const kimlik: Kimlik = SAHTE ? sahteKimlik() : gercekKimlik();
