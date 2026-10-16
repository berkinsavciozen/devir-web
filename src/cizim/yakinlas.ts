import { hareketAz } from '../ayar/hareket';
import { git } from '../yonlendirme';

const BAYRAK = 'devir:yakinlas';
const EGRI = 'cubic-bezier(.2,0,0,1)';

/**
 * Z1 · evrenden galaksiye yakınlaşma. Tasarım 900 ms ve ~6.5× ölçek diyordu; denetim planıyla (CELISKILER 63)
 * kısaldı ve yumuşadı: 0–120 ms tek halka büyür; 40–280 ms kamera galaksiye en çok 2.5× yaklaşır ve söner,
 * seyrek hız çizgileri hafifçe görünür; 280 ms'de harita açılır, katmanlar 260 ms'de belirir (toplam ≤ 560 ms).
 * Hareket azaltılmışsa doğrudan geçer.
 */
export const YAKINLAS_MS = 280;
export function yakinlas(kod: string, hedef: HTMLElement) {
  const yol = `/akis/${encodeURIComponent(kod)}`;
  const main = hedef.closest('main') as HTMLElement | null;
  if (!main || hareketAz() || !main.animate) return git(yol);
  const r = hedef.getBoundingClientRect(), m = main.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const katman = document.createElement('div');
  katman.className = 'yakinlas-katman';
  katman.setAttribute('aria-hidden', 'true');
  // hız çizgileri: seyrek (48), merkezden dışa 6–24 px
  let cizgi = '';
  for (let i = 0; i < 48; i++) {
    const a = (i * 137.5) % 360 * Math.PI / 180, d0 = 70 + ((i * 53) % 340), L = 6 + ((i * 29) % 19);
    cizgi += `<line x1="${(x + Math.cos(a) * d0).toFixed(1)}" y1="${(y + Math.sin(a) * d0).toFixed(1)}" x2="${(x + Math.cos(a) * (d0 + L)).toFixed(1)}" y2="${(y + Math.sin(a) * (d0 + L)).toFixed(1)}" stroke="${i % 3 ? '#E8E0FF' : '#FFD9B8'}" stroke-width="${(.5 + (i % 4) * .2).toFixed(2)}" stroke-linecap="round"/>`;
  }
  katman.innerHTML = `<svg width="${innerWidth}" height="${innerHeight}"><g class="yakinlas-cizgi">${cizgi}</g><circle class="yakinlas-halka" cx="${x}" cy="${y}" r="30" fill="none" stroke="#FFF3E8" stroke-width="2"/></svg>`;
  document.body.appendChild(katman);
  katman.querySelector('.yakinlas-halka')!.animate([{ r: 30, opacity: .45 }, { r: 42, opacity: 0 }] as Keyframe[], { duration: 120, easing: EGRI, fill: 'forwards' });
  katman.querySelector('.yakinlas-cizgi')!.animate([{ opacity: 0 }, { opacity: .35, offset: .5 }, { opacity: 0 }], { duration: YAKINLAS_MS - 40, delay: 40, fill: 'both' });
  main.style.transformOrigin = `${x - m.left}px ${y - m.top}px`;
  main.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(2.5)', opacity: 0 }], { duration: YAKINLAS_MS - 40, delay: 40, easing: EGRI, fill: 'forwards' });
  setTimeout(() => {
    try { sessionStorage.setItem(BAYRAK, '1'); } catch { /* yok */ }
    git(yol, { gecissiz: true });
    katman.remove();
  }, YAKINLAS_MS);
}

/** Harita yakınlaşmayla mı açıldı? (bir kez okunur) */
export function haritaGelisi(): boolean {
  try { const v = sessionStorage.getItem(BAYRAK) === '1'; sessionStorage.removeItem(BAYRAK); return v; } catch { return false; }
}
