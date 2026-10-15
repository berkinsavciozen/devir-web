export type Sekme = 'evren' | 'akislar';

const EvrenIkon = ({ on }: { on: boolean }) => (
  <svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden>
    {on && <circle r="14" fill="url(#glowGold)" opacity=".6" />}
    <circle r="7" fill="none" stroke={on ? 'var(--renk-vurgu-altin)' : 'var(--renk-vurgu-lila)'} strokeWidth="1.5" />
    <line x1="0" y1="0" x2="5" y2="-5" stroke={on ? 'var(--renk-vurgu-altin)' : 'var(--renk-vurgu-lila)'} strokeWidth="1.5" />
  </svg>
);
const AkislarIkon = ({ on }: { on: boolean }) => {
  const c = on ? 'var(--renk-vurgu-altin)' : 'var(--renk-vurgu-lila)';
  return (
    <svg width="24" height="24" viewBox="-12 -12 24 24" aria-hidden>
      {on && <circle r="14" fill="url(#glowGold)" opacity=".6" />}
      <circle r="2.2" fill={c} />
      <path d="M-7,-3 Q0,-9 7,-3 M7,3 Q0,9 -7,3" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};

/** Alt gezinme (358 × 58, yarıçap 29): solda Evren, ortada + (yeni iş), sağda Akışlar. */
export function AltGezinme({ aktif, git, yeni }: { aktif: Sekme | null; git: (s: Sekme) => void; yeni: () => void }) {
  return (
    <nav className="alt-gezinme" aria-label="Ana gezinme">
      <button className={`sekme ${aktif === 'evren' ? 'aktif' : ''}`} style={{ left: '17.88%' }} aria-current={aktif === 'evren' ? 'page' : undefined} onClick={() => git('evren')}>
        <EvrenIkon on={aktif === 'evren'} /><span>Evren</span>
      </button>
      <button className="yeni-is" onClick={yeni} aria-label="Yeni iş">
        <svg width="60" height="60" viewBox="-30 -30 60 60" aria-hidden>
          <circle r="30" fill="url(#bloom)" opacity=".7" />
          <circle r="22" fill="url(#btn)" />
          <path d="M0,-8 L0,8 M-8,0 L8,0" stroke="var(--renk-metin-koyu-uzerine)" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </button>
      <button className={`sekme ${aktif === 'akislar' ? 'aktif' : ''}`} style={{ left: '82.12%' }} aria-current={aktif === 'akislar' ? 'page' : undefined} onClick={() => git('akislar')}>
        <AkislarIkon on={aktif === 'akislar'} /><span>Akışlar</span>
      </button>
    </nav>
  );
}
