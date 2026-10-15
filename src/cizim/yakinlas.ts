import { git } from '../yonlendirme';

const BAYRAK = 'devir:yakinlas';
const EGRI = 'cubic-bezier(.2,0,0,1)';

/**
 * Z1 · evrenden galaksiye yakınlaşma (§7.1, 900 ms): 0–150 ms iki halka büyür; 150–600 ms kamera galaksiye
 * yaklaşır (ölçek ≈ 222/34), öteki her şey dışa kayıp söner, yıldızlar hız çizgisine uzar; 600 ms'de harita açılır
 * ve ayrıntı katmanları sırayla belirir (Galaksi, `haritaGelisi`). Azaltılmış harekette doğrudan geçer.
 */
export function yakinlas(kod: string, hedef: HTMLElement) {
  const yol = `/akis/${encodeURIComponent(kod)}`;
  const main = hedef.closest('main') as HTMLElement | null;
  if (!main || matchMedia('(prefers-reduced-motion: reduce)').matches || !main.animate) return git(yol);
  const r = hedef.getBoundingClientRect(), m = main.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const katman = document.createElement('div');
  katman.className = 'yakinlas-katman';
  katman.setAttribute('aria-hidden', 'true');
  // hız çizgileri: merkezden dışa 8–40 px
  let cizgi = '';
  for (let i = 0; i < 120; i++) {
    const a = (i * 137.5) % 360 * Math.PI / 180, d0 = 60 + ((i * 53) % 380), L = 8 + ((i * 29) % 33);
    cizgi += `<line x1="${(x + Math.cos(a) * d0).toFixed(1)}" y1="${(y + Math.sin(a) * d0).toFixed(1)}" x2="${(x + Math.cos(a) * (d0 + L)).toFixed(1)}" y2="${(y + Math.sin(a) * (d0 + L)).toFixed(1)}" stroke="${i % 3 ? '#E8E0FF' : '#FFD9B8'}" stroke-width="${(.6 + (i % 5) * .25).toFixed(2)}" stroke-linecap="round"/>`;
  }
  katman.innerHTML = `<svg width="${innerWidth}" height="${innerHeight}"><g class="yakinlas-cizgi">${cizgi}</g><circle class="yakinlas-halka" cx="${x}" cy="${y}" r="30" fill="none" stroke="#FFF3E8" stroke-width="3"/><circle class="yakinlas-halka" cx="${x}" cy="${y}" r="30" fill="none" stroke="#FFF3E8" stroke-width="4"/></svg>`;
  document.body.appendChild(katman);
  katman.querySelectorAll('.yakinlas-halka').forEach((h, i) => h.animate([{ r: 30, opacity: .7 }, { r: 44, opacity: 0 }] as Keyframe[], { duration: 150, delay: i * 40, easing: EGRI, fill: 'forwards' }));
  katman.querySelector('.yakinlas-cizgi')!.animate([{ opacity: 0 }, { opacity: .8, offset: .5 }, { opacity: 0 }], { duration: 450, delay: 150, fill: 'both' });
  main.style.transformOrigin = `${x - m.left}px ${y - m.top}px`;
  main.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(6.5)', opacity: 0 }], { duration: 450, delay: 150, easing: EGRI, fill: 'forwards' });
  setTimeout(() => {
    try { sessionStorage.setItem(BAYRAK, '1'); } catch { /* yok */ }
    git(yol);
    katman.remove();
  }, 600);
}

/** Harita yakınlaşmayla mı açıldı? (bir kez okunur) */
export function haritaGelisi(): boolean {
  try { const v = sessionStorage.getItem(BAYRAK) === '1'; sessionStorage.removeItem(BAYRAK); return v; } catch { return false; }
}
