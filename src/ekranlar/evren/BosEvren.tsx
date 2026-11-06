import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { UYGULAMALAR, type Uygulama } from './ClaudeaBagla';
import { AltGezinme } from '../../bilesen/AltGezinme';
import { Kabuk, type KabukSekme } from '../../bilesen/Kabuk';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { UstDugmeler } from '../../bilesen/Zil';
import { evrenHalkasi } from '../../cizim/ekran';
import { galaxy, ship, sparkle, C } from '../../cizim/ortak.js';
import { simdi } from '../../api/ortam';
import { git } from '../../yonlendirme';

function a2Cizim() {
  let s = evrenHalkasi([], { c: { cx: 195, cy: 380, R: 138 }, bands: [], simdi: simdi() }).svg;
  // tek karanlık bulutsu: ilk iş burada doğacak
  s += `<circle cx="195" cy="380" r="70" fill="url(#glowLilac)" opacity=".9"/>`;
  s += `<ellipse cx="195" cy="380" rx="44" ry="32" fill="#B9A6F2" fill-opacity=".08" stroke="#D9CCFF" stroke-width="1.2" stroke-dasharray="2 5" transform="rotate(-14 195 380)"/>`;
  s += galaxy(195, 380, Array.from({ length: 5 }, () => ({ state: 'dark' })), { scale: .7, seed: 3, rot: -14, pr: 2.6 });
  s += sparkle(195, 380, 9, '#FFF1D6', 1);
  return s;
}

/** Başlıktaki avatar + ad (B1, A2). Avatar ayarları açar (yalnız sahip). */
export function AvatarAd({ ad, ac }: { ad: string; ac?: () => void }) {
  const ic = <svg aria-hidden width="44" height="44" viewBox="-22 -22 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -20, 'insan', (ad[0] || '?').toLocaleUpperCase('tr'), C.peach, .9, { flame: false }) }} />;
  return (
    <>
      <Kutu x={8} y={36} w={44} h={44} as={ac ? 'button' : 'div'} onClick={ac} aria-label={ac ? `${ad} · hesap ve çalışma alanı` : undefined} className="avatar-dugme">{ic}</Kutu>
      <Metin y={63} x={50} fs={15} agirlik={650} style={{ right: 'auto', pointerEvents: 'none' }}>{ad}</Metin>
    </>
  );
}

/** W3 (B7): kişinin bağlı LLM'i (Claude ya da ChatGPT); yoksa null. Yüklenene kadar `yukleniyor`. */
export function useBagliLlm(): { yukleniyor: boolean; uyg: Uygulama | null } {
  const ag = useQuery({ queryKey: ['agentlar'], queryFn: () => api.get<any>('/ben/agentlar'), retry: false });
  const L = ((ag.data?.agentlar || []) as any[]).filter((a) => !a.kullanilmiyor);
  const uyg = L.some((a) => UYGULAMALAR.claude.esle.test(String(a.ad || ''))) ? 'claude'
    : L.some((a) => UYGULAMALAR.chatgpt.esle.test(String(a.ad || ''))) ? 'chatgpt' : L.length ? 'claude' : null;
  return { yukleniyor: ag.isPending, uyg };
}

/** Sohbette yeni sayfa: bağlı uygulamada işi anlatmak için. */
const SOHBET_AC: Record<Uygulama, string> = { claude: 'https://claude.ai/new', chatgpt: 'https://chatgpt.com/' };
const ORNEK = 'Aralık sonuna kadar 5 çiftçi daha kazandırmam lazım.';

/** İlk akışını başlat (B4, B7): metinler LLM bağlı mı değil mi ona göre. "Buradan yaz" yok; elle başlatmak + ile. */
function ilkMetin(uyg: Uygulama | null) {
  if (!uyg) return {
    baslik: ['İlk akışını başlat.', 'Devir’i yapay zekâna bağla.'],
    alt: 'Bağladıktan sonra işini sohbette bir cümleyle anlat; taslak buraya düşer. Kendin kurmak istersen + ile başla.',
  };
  const U = UYGULAMALAR[uyg];
  return {
    baslik: [`${U.ad} bağlı.`, 'İlk işini sohbette anlat.'],
    alt: `${U.da} yeni bir sohbet aç ve yapman gereken işi yaz; ör. “${ORNEK}” Taslak buraya düşer, burada açılır.`,
  };
}

/** A2 · Boş evren: ilk açılış ("5 dakikada ilk akış" buradan başlar). */
export function BosEvren({ ad, avatar }: { ad: string; avatar?: () => void }) {
  const { yukleniyor, uyg } = useBagliLlm();
  const M = ilkMetin(uyg);
  return (
    <Sahne gok={{ tohum: 9, yildiz: 260 }} cizim={a2Cizim()} etiket="Evren">
      <AvatarAd ad={ad} ac={avatar} />
      {/* B2: boş hesapta da yeni iş, bildirimler, ayarlar ve Devir AI açılır */}
      <UstDugmeler y={36} />
      {!yukleniyor && <>
        <Metin y={112} fs={19} lh={25} serif as="h1" style={{ fontWeight: 400 }}>{M.baslik[0]}<br />{M.baslik[1]}</Metin>
        <Metin y={548} fs={14} lh={19} renk="ink2" as="p" hiza="orta" style={{ left: 28, right: 28 }}>{M.alt}</Metin>
        {uyg ? <>
          <Dugme style={{ top: 640 }} kayma={10} ikonX={92} ikon={<UygGemi uyg={uyg} />} onClick={() => window.open(SOHBET_AC[uyg], '_blank', 'noopener')}>{UYGULAMALAR[uyg].i} aç</Dugme>
          <Dugme tur="ikincil" ton="lila" yukseklik={46} fs={14} style={{ top: 704 }} onClick={() => git(`/bagla?uygulama=${uyg === 'claude' ? 'chatgpt' : 'claude'}`)}>{uyg === 'claude' ? 'ChatGPT’yi de bağla' : 'Claude’u da bağla'}</Dugme>
        </> : <>
          <Dugme style={{ top: 640 }} kayma={10} ikonX={98} ikon={<UygGemi uyg="claude" />} onClick={() => git('/bagla')}>Claude’a bağla</Dugme>
          <Dugme tur="ikincil" ton="lila" yukseklik={46} fs={14} style={{ top: 704 }} onClick={() => git('/bagla?uygulama=chatgpt')}>ChatGPT’ye bağla</Dugme>
        </>}
      </>}
      <AltGezinme aktif="evren" yeni={() => git('/yeni')} />
    </Sahne>
  );
}

const UygGemi = ({ uyg }: { uyg: Uygulama }) => <svg aria-hidden width="40" height="30" viewBox="-20 -15 40 30" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -12, 'agent', uyg === 'claude' ? 'C' : 'G', C.lilac, .7, { flame: false }) }} />;

const genisDugme = { position: 'relative', flex: 1, left: 'auto', right: 'auto', top: 'auto' } as const;

/**
 * Geniş ekranda boş hesap (B2/C2, 0.34.0): eskiden her panel sayfası (Ayarlar, Claude'a bağla, Akışlar) boş evrenin
 * altında kalıyordu; panel açılmıyordu. Şimdi kabuk her zamanki gibi kurulur: solda ilk işin bulutsusu, sağda sayfa.
 */
export function BosEvrenGenis({ ad, avatar, panel, konum, geri, aktif }: { ad: string; avatar: () => void; panel?: ReactNode; konum?: string; geri?: () => void; aktif?: KabukSekme | null }) {
  const { yukleniyor, uyg } = useBagliLlm();
  const M = ilkMetin(uyg);
  const sol = (
    <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, textAlign: 'center', padding: 24 }}>
      <button type="button" className="avatar-dugme genis-geri" style={{ position: 'absolute', left: 34, top: 36 }} onClick={avatar} aria-label={`${ad} · hesap ve çalışma alanı`}>
        <svg aria-hidden width="44" height="44" viewBox="-22 -22 44 44" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -20, 'insan', (ad[0] || '?').toLocaleUpperCase('tr'), C.peach, .9, { flame: false }) }} />
      </button>
      <span style={{ position: 'absolute', left: 84, top: 47, fontSize: 15, fontWeight: 650, color: 'var(--renk-metin-ink)' }}>{ad}</span>
      <svg aria-hidden width="300" height="300" viewBox="47 232 296 296" dangerouslySetInnerHTML={{ __html: a2Cizim() }} />
      {!yukleniyor && <>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 400, fontSize: 22, lineHeight: '29px', margin: 0, color: 'var(--renk-metin-ink)' }}>{M.baslik[0]}<br />{M.baslik[1]}</h1>
        <p style={{ margin: 0, maxWidth: 440, fontSize: 14.5, lineHeight: '20px', color: 'var(--renk-metin-ink2)' }}>{M.alt}</p>
        <div style={{ display: 'flex', gap: 12, width: 'min(440px, 100%)' }}>
          {uyg ? <>
            <button type="button" className="dugme dugme-birincil" style={genisDugme} onClick={() => window.open(SOHBET_AC[uyg], '_blank', 'noopener')}>{UYGULAMALAR[uyg].i} aç</button>
            <button type="button" className="dugme dugme-ikincil ton-lila" style={{ ...genisDugme, height: 54 }} onClick={() => git(`/bagla?uygulama=${uyg === 'claude' ? 'chatgpt' : 'claude'}`)}>{uyg === 'claude' ? 'ChatGPT’yi de bağla' : 'Claude’u da bağla'}</button>
          </> : <>
            <button type="button" className="dugme dugme-birincil" style={genisDugme} onClick={() => git('/bagla')}>Claude’a bağla</button>
            <button type="button" className="dugme dugme-ikincil ton-lila" style={{ ...genisDugme, height: 54 }} onClick={() => git('/bagla?uygulama=chatgpt')}>ChatGPT’ye bağla</button>
          </>}
        </div>
      </>}
    </div>
  );
  return (
    <Kabuk sol={sol} aktif={aktif ?? 'evren'} geri={geri} konum={panel ? konum : 'Başla'} etiket="Evren">
      {panel ?? <BosPanel uyg={uyg} />}
    </Kabuk>
  );
}

/** Panel boşken: ilk akışın iki yolu (B4: "Buradan yaz" yok; elle kurmak üstteki + ile). */
function BosPanel({ uyg }: { uyg: Uygulama | null }) {
  const U = uyg ? UYGULAMALAR[uyg] : null;
  return (
    <div style={{ padding: '8px 24px 24px', display: 'grid', gap: 14 }}>
      <p style={{ margin: 0, color: 'var(--renk-metin-ink)' }}>İlk akışın iki yoldan kurulur:</p>
      <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, color: 'var(--renk-metin-ink)' }}>
        <li>{U ? <><b>{U.da} anlat.</b> Bağlantın hazır. Yeni sohbette işini bir cümleyle yaz; Devir adımları, kişileri ve takvimi önerir, taslak burada açılır.</>
          : <><b>Claude ya da ChatGPT’ye bağla.</b> Devir’i bağlayıcı olarak ekle, işini sohbette anlat; taslak burada açılır.</>}</li>
        <li><b>Kendin başlat.</b> Üstteki + ile hedefini bir cümleyle yaz; taslak aynı yoldan çıkar.</li>
      </ol>
      <p style={{ margin: 0, opacity: .75 }}>Ayarlar, bildirimler ve Devir AI üstteki düğmelerden her zaman açılır.</p>
    </div>
  );
}
