import { useOzet } from '../api/sorgular';
import { git as yonlen } from '../yonlendirme';
import { usePanelIcinde } from './Kabuk';

export type Sekme = 'evren' | 'akislar' | 'bana' | 'ayarlar';
const YOL: Record<Sekme, string> = { evren: '/', akislar: '/akislar', bana: '/gorevler', ayarlar: '/ayarlar' };

const renk = (on: boolean) => (on ? 'var(--renk-vurgu-altin)' : 'var(--renk-vurgu-lila)');
const Parilti = ({ on }: { on: boolean }) => (on ? <circle r="14" fill="url(#glowGold)" opacity=".6" /> : null);
const EvrenIkon = ({ on }: { on: boolean }) => (
  <svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden>
    <Parilti on={on} />
    <circle r="7" fill="none" stroke={renk(on)} strokeWidth="1.5" />
    <line x1="0" y1="0" x2="5" y2="-5" stroke={renk(on)} strokeWidth="1.5" />
  </svg>
);
const AkislarIkon = ({ on }: { on: boolean }) => (
  <svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden>
    <Parilti on={on} />
    <circle r="2.2" fill={renk(on)} />
    <path d="M-7,-3 Q0,-9 7,-3 M7,3 Q0,9 -7,3" fill="none" stroke={renk(on)} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
/** Görevler (eski Bana düşenler): sırası gelmiş gezegen (halka + nokta) */
const BanaIkon = ({ on }: { on: boolean }) => (
  <svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden>
    <Parilti on={on} />
    <circle r="3.6" fill={renk(on)} />
    <circle r="7.5" fill="none" stroke={renk(on)} strokeWidth="1.3" strokeDasharray="2.2 2.6" />
  </svg>
);

const SEKMELER: [Sekme, string, (p: { on: boolean }) => JSX.Element, string][] = [
  ['evren', 'Evren', EvrenIkon, '18%'], ['akislar', 'Akışlar', AkislarIkon, '50%'], ['bana', 'Görevler', BanaIkon, '82%'],
];



/**
 * Alt gezinme (358 × 58, yarıçap 29): Evren, Akışlar, Görevler (plan 27 Eki, 2.8). Yeni iş (+) ve Ayarlar sayfanın
 * üstünde zilin yanında (UstDugmeler). Masaüstü kabuğunun panelinde çizilmez (N13).
 */
export function AltGezinme({ aktif, git }: { aktif: Sekme | null; git?: (s: Sekme) => void; yeni?: () => void }) {
  const panelde = usePanelIcinde();
  const ozet = useOzet();
  const bekleyen = (ozet.data?.benim || []).filter((b: any) => b.durum !== 'suruyor').length;
  const sec = git ?? ((s: Sekme) => yonlen(YOL[s]));
  if (panelde) return null;
  return (
    <nav className="alt-gezinme" aria-label="Ana gezinme">
      {SEKMELER.map(([s, ad, Ikon, x]) => (
        <button key={s} type="button" className={`sekme ${aktif === s ? 'aktif' : ''}`} style={{ left: x }} aria-current={aktif === s ? 'page' : undefined}
          aria-label={s === 'bana' && bekleyen ? `${ad}: ${bekleyen} görev` : undefined} onClick={() => sec(s)}>
          <Ikon on={aktif === s} /><span>{ad}</span>
          {s === 'bana' && bekleyen > 0 && <b className="sekme-sayi" aria-hidden>{bekleyen}</b>}
        </button>
      ))}
    </nav>
  );
}
