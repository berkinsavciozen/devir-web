import { AltGezinme } from '../../bilesen/AltGezinme';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { Ikon } from '../../bilesen/Svg';
import { evrenHalkasi, kalemIkon } from '../../cizim/ekran';
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

/** A2 · Boş evren: ilk açılış ("5 dakikada ilk akış" buradan başlar). */
export function BosEvren({ ad, avatar }: { ad: string; avatar?: () => void }) {
  return (
    <Sahne gok={{ tohum: 9, yildiz: 260 }} cizim={a2Cizim()} etiket="Evren">
      <AvatarAd ad={ad} ac={avatar} />
      <Metin y={112} fs={19} lh={25} serif as="h1" style={{ fontWeight: 400 }}>Henüz akış yok.<br />İlk işini Claude’a anlat.</Metin>
      <Dugme style={{ top: 588 }} kayma={10} ikonX={98}
        ikon={<svg aria-hidden width="40" height="30" viewBox="-20 -15 40 30" style={{ overflow: 'visible' }} dangerouslySetInnerHTML={{ __html: ship(0, 0, -12, 'agent', 'C', C.lilac, .7, { flame: false }) }} />}
        onClick={() => git('/bagla')}>
        Claude’a bağla
      </Dugme>
      <Dugme tur="ikincil" ton="altin" yukseklik={50} fs={15} style={{ top: 654 }} ikon={<Ikon svg={kalemIkon()} />} ikonX={110} onClick={() => git('/yeni')}>
        Buradan yaz
      </Dugme>
      <AltGezinme aktif="evren" git={(s) => git(s === 'evren' ? '/' : '/akislar')} yeni={() => git('/yeni')} />
    </Sahne>
  );
}
