import { useEffect, useState } from 'react';
import { kimlik, type OauthAyrinti } from '../../api/kimlik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { Ikon } from '../../bilesen/Svg';
import { bilgiIkon } from '../../cizim/ekran';
import { planet, tower } from '../../cizim/ortak.js';
import { arama, git } from '../../yonlendirme';
import { Giris } from './Giris';

// İki gövde: Devir kulesi ve bağlanan istemcinin gezegeni, arada kesik yörünge
const CIZIM =
  `<ellipse cx="195" cy="300" rx="190" ry="150" fill="url(#bloom)" opacity=".45"/>` +
  `<path d="M120,300 C160,250 230,250 270,300" fill="none" stroke="#B9A6F2" stroke-width="1.6" stroke-dasharray="3 6" opacity=".8"/>` +
  `<circle cx="120" cy="300" r="40" fill="url(#glowGold)" opacity=".7"/>` + tower(120, 330, 1, true) +
  `<circle cx="270" cy="300" r="40" fill="url(#glowLilac)" opacity=".7"/>` + planet(270, 300, 22, 'lit', { life: false });

type Hal = { tur: 'yukleniyor' } | { tur: 'giris' } | { tur: 'onay'; a: Extract<OauthAyrinti, { tur: 'onay' }> } | { tur: 'gidiyor'; onay: boolean } | { tur: 'hata'; mesaj: string };
const alanAdi = (u: string | null) => { try { return u ? new URL(u).host : null; } catch { return null; } };

/**
 * OAuth onayı (MK-1): Claude ya da ChatGPT bağlayıcısı eklenince Supabase Auth kişiyi buraya gönderir (?authorization_id=).
 * Oturum yoksa giriş, sonra buraya dönülür. İzin verilen istemci kişinin adına agent olarak yazar.
 */
export function OauthOnay() {
  const id = arama().get('authorization_id') || '';
  const [hal, setHal] = useState<Hal>({ tur: 'yukleniyor' });

  useEffect(() => {
    let iptal = false;
    (async () => {
      if (!id) { setHal({ tur: 'hata', mesaj: 'Bağlantı isteği eksik. Bağlayıcıyı Claude’dan yeniden ekle.' }); return; }
      if (!(await kimlik.eposta())) { if (!iptal) setHal({ tur: 'giris' }); return; }
      try {
        const a = await kimlik.oauthAyrinti(id);
        if (iptal) return;
        if (a.tur === 'yonlen') { window.location.assign(a.adres); return; }
        setHal({ tur: 'onay', a });
      } catch (e) {
        if (!iptal) setHal({ tur: 'hata', mesaj: (e as Error).message || 'Bağlantı isteği bulunamadı ya da süresi doldu.' });
      }
    })();
    return () => { iptal = true; };
  }, [id]);

  const karar = async (onay: boolean) => {
    setHal({ tur: 'gidiyor', onay });
    try { window.location.assign(await kimlik.oauthKarar(id, onay)); }
    catch (e) { setHal({ tur: 'hata', mesaj: (e as Error).message || 'İstek tamamlanamadı.' }); }
  };

  if (hal.tur === 'giris') return <Giris sonra={`/oauth/onay?authorization_id=${encodeURIComponent(id)}`} />;
  if (hal.tur === 'yukleniyor' || hal.tur === 'gidiyor') {
    const m = hal.tur === 'gidiyor' ? (hal.onay ? 'Claude’a dönülüyor' : 'İstek reddediliyor') : 'Bağlantı isteği açılıyor';
    return (
      <Sahne gok={{ tohum: 9, yildiz: 280, parilti: 4 }} cizim={CIZIM} etiket={m} ortala>
        <Metin y={470} fs={26} lh={32} serif agirlik={700} hiza="orta" as="h1">{m}</Metin>
        <div className="nokta-nabzi" style={{ top: 504 }} role="status" aria-label={m}><i /><i /><i /></div>
      </Sahne>
    );
  }
  if (hal.tur === 'hata') {
    return (
      <Sahne gok={{ tohum: 13, yildiz: 200, parilti: 2 }} cizim={CIZIM} etiket="Bağlantı isteği" ortala>
        <Metin y={460} fs={26} lh={32} serif agirlik={700} hiza="orta" as="h1">Bağlantı kurulamadı</Metin>
        <Metin y={496} fs={16} lh={22} serif renk="ink2" hiza="orta" style={{ padding: '0 24px' }}>{hal.mesaj}</Metin>
        <Dugme tur="ikincil" ton="lila" yukseklik={50} fs={15} style={{ top: 580 }} onClick={() => git('/', { yerine: true })}>Devir’e dön</Dugme>
      </Sahne>
    );
  }
  const { istemci, site, eposta } = hal.a;
  const host = alanAdi(site);
  return (
    <Sahne gok={{ tohum: 9, yildiz: 300, parilti: 5 }} cizim={CIZIM} etiket={`${istemci} bağlantı isteği`} ortala>
      <Metin y={420} fs={28} lh={34} serif agirlik={700} hiza="orta" as="h1">{istemci} Devir’e<br />bağlanmak istiyor</Metin>
      <Metin y={492} fs={14} agirlik={550} renk="ink3" hiza="orta">{host ? `${host} · ` : ''}{eposta} hesabınla</Metin>
      <Kutu y={516} h={88} className="kart bilgi-karti oauth-izin">
        <Ikon svg={bilgiIkon()} w={18} />
        <span>Akışlarını okur, senin adına adım günceller ve taslak yazar. Yazdıkları “{istemci} (senin adına)” diye görünür; kararlar Ayarlar’daki karar kuralına uyar.</span>
      </Kutu>
      <Dugme style={{ top: 652 }} onClick={() => karar(true)}>İzin ver</Dugme>
      <Dugme tur="ikincil" ton="lila" yukseklik={48} fs={15} style={{ top: 718 }} onClick={() => karar(false)}>Reddet</Dugme>
      <Metin y={796} fs={12} renk="ink3" hiza="orta">İzni Ayarlar › Bağlı uygulamalar’dan kaldırabilirsin.</Metin>
    </Sahne>
  );
}
