// Tasarım kaynağından (d3-son/kaynak/ortak.js) taşındı: SVG dizgesi üreten çizim parçaları. Mantık ve ölçüler değiştirilmez.
// D3 · "Fener Masalı" — ortak çizim parçaları (SVG üreticileri)
// Sıcak masalsı illüstrasyon: Küçük Prens gezegenleri + Monument Valley kuleleri.

const C = {
  ink: '#FFF3E8',      // ana metin
  ink2: '#E2D6F5',     // ikincil metin
  ink3: '#BFB0E0',     // sönük metin (koyu zeminde ≥4.5)
  night0: '#150F33',
  night1: '#1E1745',
  night2: '#2C2063',
  plum: '#4A2A63',
  peach: '#FFC9A3',
  apricot: '#F59E7A',
  rose: '#E07A93',
  gold: '#FFD27A',
  lilac: '#B9A6F2',
  mint: '#9EE6CF',
  coral: '#FF8A78',
  dark: '#2A2452',
};

// tohumlu rastgele
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const f = (n) => Math.round(n * 100) / 100;

function defs() {
  return `
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#090619"/>
    <stop offset=".4" stop-color="#120C2E"/>
    <stop offset=".8" stop-color="#1D1240"/>
    <stop offset="1" stop-color="#2B1546"/>
  </linearGradient>
  <radialGradient id="neb1"><stop offset="0" stop-color="#7B4FB0" stop-opacity=".42"/><stop offset="1" stop-color="#7B4FB0" stop-opacity="0"/></radialGradient>
  <radialGradient id="neb2"><stop offset="0" stop-color="#F58E7A" stop-opacity=".28"/><stop offset="1" stop-color="#F59E7A" stop-opacity="0"/></radialGradient>
  <radialGradient id="neb3"><stop offset="0" stop-color="#3E6BD0" stop-opacity=".30"/><stop offset="1" stop-color="#4E7BD0" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowPeach"><stop offset="0" stop-color="#FFD9B8" stop-opacity=".9"/><stop offset=".35" stop-color="#FFB48F" stop-opacity=".35"/><stop offset="1" stop-color="#FF9F7A" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowGold"><stop offset="0" stop-color="#FFE7A8" stop-opacity="1"/><stop offset=".4" stop-color="#FFD27A" stop-opacity=".35"/><stop offset="1" stop-color="#FFD27A" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowCoral"><stop offset="0" stop-color="#FF8A78" stop-opacity=".75"/><stop offset=".45" stop-color="#FF6F6F" stop-opacity=".25"/><stop offset="1" stop-color="#FF6F6F" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowGreen"><stop offset="0" stop-color="#B8F5CF" stop-opacity=".85"/><stop offset=".4" stop-color="#6FE0A0" stop-opacity=".32"/><stop offset="1" stop-color="#6FE0A0" stop-opacity="0"/></radialGradient>
  <radialGradient id="glowLilac"><stop offset="0" stop-color="#B9A6F2" stop-opacity=".45"/><stop offset="1" stop-color="#B9A6F2" stop-opacity="0"/></radialGradient>
  <radialGradient id="pLit" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#FFF0D9"/><stop offset=".35" stop-color="#FFC59E"/><stop offset=".75" stop-color="#EE8E86"/><stop offset="1" stop-color="#B35C8A"/></radialGradient>
  <radialGradient id="pLit2" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#FFF6DE"/><stop offset=".4" stop-color="#FFD98E"/><stop offset=".8" stop-color="#F0A070"/><stop offset="1" stop-color="#C06C78"/></radialGradient>
  <radialGradient id="pLit3" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="#F2FFF6"/><stop offset=".4" stop-color="#B8EBD4"/><stop offset=".8" stop-color="#7FB7C8"/><stop offset="1" stop-color="#5E6FA8"/></radialGradient>
  <radialGradient id="pDark" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#4A4190"/><stop offset=".6" stop-color="#2E2765"/><stop offset="1" stop-color="#1B1640"/></radialGradient>
  <radialGradient id="pWait" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#F7D3C0"/><stop offset=".35" stop-color="#C9A0D6"/><stop offset=".8" stop-color="#5E4C9E"/><stop offset="1" stop-color="#2E2765"/></radialGradient>
  <radialGradient id="pBlock" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#FFB7A3"/><stop offset=".45" stop-color="#E26F72"/><stop offset="1" stop-color="#6A2754"/></radialGradient>
  <radialGradient id="shade" cx=".78" cy=".8" r=".75"><stop offset="0" stop-color="#1A0F3A" stop-opacity=".55"/><stop offset=".6" stop-color="#1A0F3A" stop-opacity=".12"/><stop offset="1" stop-color="#1A0F3A" stop-opacity="0"/></radialGradient>
  <linearGradient id="flame" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#FFE6A0"/><stop offset=".5" stop-color="#FF9F7A" stop-opacity=".8"/><stop offset="1" stop-color="#FF7A8A" stop-opacity="0"/></linearGradient>
  <linearGradient id="todayG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFD9B8" stop-opacity=".95"/><stop offset=".85" stop-color="#FFB48F" stop-opacity=".45"/><stop offset="1" stop-color="#FFB48F" stop-opacity="0"/></linearGradient>
  <linearGradient id="btn" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE0C2"/><stop offset="1" stop-color="#FFB08C"/></linearGradient>
  <linearGradient id="sheet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2F2468"/><stop offset=".5" stop-color="#231A52"/><stop offset="1" stop-color="#1A1440"/></linearGradient>
  <linearGradient id="fadeR" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1E1745" stop-opacity="0"/><stop offset="1" stop-color="#1E1745" stop-opacity=".92"/></linearGradient>
  <linearGradient id="dawn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFB48F" stop-opacity=".30"/><stop offset=".35" stop-color="#E07A93" stop-opacity=".12"/><stop offset=".7" stop-color="#E07A93" stop-opacity="0"/></linearGradient>
  <linearGradient id="tower" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFE3CC"/><stop offset=".5" stop-color="#F6B9A4"/><stop offset=".5" stop-color="#D88C9C"/><stop offset="1" stop-color="#B9708F"/></linearGradient>
  <linearGradient id="towerDark" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A4C99"/><stop offset=".5" stop-color="#4A3F86"/><stop offset=".5" stop-color="#3A3170"/><stop offset="1" stop-color="#2D2660"/></linearGradient>
  <radialGradient id="vign" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#05030F" stop-opacity="0"/><stop offset="1" stop-color="#05030F" stop-opacity=".75"/></radialGradient>
  <radialGradient id="bloom"><stop offset="0" stop-color="#FFE2B8" stop-opacity=".95"/><stop offset=".18" stop-color="#FFB47F" stop-opacity=".55"/><stop offset=".5" stop-color="#E86F8E" stop-opacity=".16"/><stop offset="1" stop-color="#E86F8E" stop-opacity="0"/></radialGradient>
  <linearGradient id="litArm" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFE7B0"/><stop offset="1" stop-color="#FF9E7A"/></linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE3B8"/><stop offset=".5" stop-color="#E9A879"/><stop offset="1" stop-color="#B9708F"/></linearGradient>
  <filter id="blur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="blur6" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="blur14" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 .9  0 0 0 0 .85  0 0 0 .07 0"/>
  </filter>
  <filter id="paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".012 .02" numOctaves="3" seed="3" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 .55  0 0 0 0 .35  0 0 0 0 .75  0 0 0 .22 -.02"/>
  </filter>
</defs>`;
}

// gökyüzü: degrade + bulutsu + yıldızlar + kâğıt dokusu
function sky(w, h, seed = 1, opts = {}) {
  const r = rng(seed);
  let s = `<rect width="${w}" height="${h}" fill="url(#sky)"/>`;
  s += `<rect width="${w}" height="${h}" filter="url(#paper)"/>`;
  const nebs = opts.nebs || [
    [w * .15, h * .25, 240, 'neb1'], [w * .95, h * .55, 260, 'neb3'], [w * .3, h * .9, 280, 'neb2'], [w * .8, h * .12, 200, 'neb2'],
  ];
  for (const [x, y, rr, id] of nebs) s += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${rr}" ry="${rr * .7}" fill="url(#${id})"/>`;
  const n = opts.stars ?? Math.round(w * h / 900);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, z = r();
    const rr = z < .85 ? .4 + r() * .7 : 1 + r() * .8;
    const op = .25 + r() * .6;
    const col = r() < .2 ? '#FFD9B8' : r() < .3 ? '#C9B8FF' : '#FFF6EC';
    // harita alanında yıldızlar seyrek ve soluk: tıklanır nesnelerle karışmasın
    const H = opts.sakin, ic = H && Math.hypot(x - H[0], y - H[1]) < H[2];
    if (ic && i % 2) continue;
    if (ic) { s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.min(rr, .9))}" fill="${col}" opacity="${f(op * .45)}"/>`; continue; }
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rr)}" fill="${col}" opacity="${f(op)}"/>`;
  }
  // birkaç 4 köşeli parıltı
  for (let i = 0; i < (opts.sparkles ?? 7); i++) s += sparkle(r() * w, r() * h, 3 + r() * 4, r() < .5 ? '#FFE7C7' : '#D9CCFF', .5 + r() * .4);
  s += `<rect width="${w}" height="${h}" fill="url(#vign)"/>`;
  return s;
}

function sparkle(x, y, s, col = '#FFF1D6', op = .9) {
  return `<path d="M${f(x)},${f(y - s)} Q${f(x + s * .16)},${f(y - s * .16)} ${f(x + s)},${f(y)} Q${f(x + s * .16)},${f(y + s * .16)} ${f(x)},${f(y + s)} Q${f(x - s * .16)},${f(y + s * .16)} ${f(x - s)},${f(y)} Q${f(x - s * .16)},${f(y - s * .16)} ${f(x)},${f(y - s)}Z" fill="${col}" opacity="${op}"/>`;
}

function grain(w, h) { return `<rect width="${w}" height="${h}" filter="url(#grain)" pointer-events="none"/>`; }

// --- gezegen yüzeyindeki hayat ---
function house(r, ang, lit, sc = 1) {
  const w = Math.max(5, r * .34) * sc, hh = w * .8;
  const wall = lit ? '#FFF1E0' : '#3A3274', roof = lit ? '#E8738A' : '#2A2458', win = lit ? '#FFD86E' : '#231D4C';
  return `<g transform="rotate(${ang})"><g transform="translate(0,${f(-r + 1)})">
    <rect x="${f(-w / 2)}" y="${f(-hh)}" width="${f(w)}" height="${f(hh)}" rx="${f(w * .12)}" fill="${wall}" ${lit ? '' : 'stroke="#6B5FB0" stroke-width=".6"'}/>
    <path d="M${f(-w / 2 - w * .15)},${f(-hh)} L0,${f(-hh - w * .6)} L${f(w / 2 + w * .15)},${f(-hh)}Z" fill="${roof}"/>
    <rect x="${f(-w * .16)}" y="${f(-hh * .7)}" width="${f(w * .32)}" height="${f(hh * .38)}" rx="${f(w * .06)}" fill="${win}"/>
    ${lit ? `<circle cx="0" cy="${f(-hh * .5)}" r="${f(w * .7)}" fill="url(#glowGold)" opacity=".7"/>` : ''}
  </g></g>`;
}
function tree(r, ang, lit, sc = 1) {
  const h = Math.max(5, r * .3) * sc;
  return `<g transform="rotate(${ang})"><g transform="translate(0,${f(-r + 1)})">
    <rect x="-.6" y="${f(-h)}" width="1.2" height="${f(h)}" fill="${lit ? '#8A5A6E' : '#3A3274'}"/>
    <circle cx="0" cy="${f(-h)}" r="${f(h * .5)}" fill="${lit ? '#8FD9B6' : '#332C6A'}"/>
  </g></g>`;
}
function lamp(r, ang, lit) {
  const h = Math.max(6, r * .42);
  return `<g transform="rotate(${ang})"><g transform="translate(0,${f(-r + 1)})">
    <rect x="-.5" y="${f(-h)}" width="1" height="${f(h)}" fill="${lit ? '#FFE9D2' : '#4B4380'}"/>
    <circle cx="0" cy="${f(-h)}" r="1.6" fill="${lit ? '#FFE07A' : '#3A3274'}"/>
    ${lit ? `<circle cx="0" cy="${f(-h)}" r="${f(h * .9)}" fill="url(#glowGold)"/>` : ''}
  </g></g>`;
}
function flag(r, ang, col = '#FFD27A') {
  const h = Math.max(9, r * .75);
  return `<g transform="rotate(${ang})"><g transform="translate(0,${f(-r + 1)})">
    <rect x="-.6" y="${f(-h)}" width="1.2" height="${f(h)}" fill="#FFF1E0"/>
    <path d="M.6,${f(-h)} L${f(h * .55)},${f(-h + h * .2)} L.6,${f(-h + h * .4)}Z" fill="${col}"/>
  </g></g>`;
}

// state: lit (bitti) | run (sürüyor) | wait (sırası geldi, sahibini bekliyor) | dark (sırada) | block (engelli) | ghost (atlandı)
// | ertele (ertelendi) ; opts: {karar, waitRings, life, grad, ring, moon}
// Durum kanalları (plan 27 Eki, 3.A): bitti yeşil ışık, sürüyor yeşil halka, bekliyor kehribar halka, sırada karanlık,
// engelli fırtına, atlandı kesik çizgi ve üstü çizili, ertelendi soluk ve saatli.
function planet(x, y, r, state, o = {}) {
  let s = `<g transform="translate(${f(x)},${f(y)})">`;
  if (state === 'ertele') {
    s += `<g opacity=".45"><circle r="${f(r)}" fill="url(#pDark)" stroke="#8E80D6" stroke-width="1"/></g>`;
    const k = Math.max(3.2, r * .62);
    s += `<g transform="translate(${f(r * .78)},${f(-r * .78)})"><circle r="${f(k)}" fill="#1A1238" stroke="#BFB0E0" stroke-width="1"/><path d="M0,${f(-k * .55)} V0 L${f(k * .45)},${f(k * .2)}" fill="none" stroke="#BFB0E0" stroke-width="1" stroke-linecap="round"/></g>`;
    return s + '</g>';
  }
  if (state === 'run') {
    // sürüyor: dönen yeşil halka
    s += `<g class="dongu-halka"><circle r="${f(r + 5)}" fill="none" stroke="#6FE0A0" stroke-width="1.8" stroke-dasharray="7 3" opacity=".95"/></g>`;
    s += `<circle r="${f(r * 2)}" fill="url(#glowGreen)" opacity=".3"/>`;
    s += `<circle r="${f(r)}" fill="url(#pWait)" stroke="#B8F5CF" stroke-opacity=".6" stroke-width="1"/>`;
    s += `<circle r="${f(r)}" fill="url(#shade)"/>`;
    if (o.life !== false) s += house(r, -15, true) + tree(r, 24, false);
    if (o.karar) s += flag(r, 40);
    return s + '</g>';
  }
  if (state === 'ghost') {
    s += `<circle r="${f(r)}" fill="#2A2452" fill-opacity=".35" stroke="#A99BDB" stroke-width="1.2" stroke-dasharray="2 3" opacity=".8"/>`;
    // atlandı (plan 27 Eki, 3.10): kesik çizgi + gezegenin üstünü çizen çapraz çizik
    s += `<path d="M${f(-r * .78)},${f(r * .78)} L${f(r * .78)},${f(-r * .78)}" stroke="#A99BDB" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>`;
    return s + '</g>';
  }
  if (state === 'lit') {
    // bitti: yeşil ışık (plan 27 Eki, 3.A)
    s += `<circle r="${f(r * 2.6)}" fill="url(#glowGreen)" opacity=".85"/>`;
    if (o.ring) s += `<ellipse rx="${f(r * 1.6)}" ry="${f(r * .38)}" fill="none" stroke="#FFD9B8" stroke-width="1.4" opacity=".55" transform="rotate(-14)"/>`;
    s += `<circle r="${f(r)}" fill="url(#${o.grad || 'pLit'})"/>`;
    s += `<circle r="${f(r)}" fill="url(#shade)"/>`;
    s += `<path d="M${f(-r * .62)},${f(-r * .38)} A${f(r * .78)},${f(r * .78)} 0 0 1 ${f(-r * .05)},${f(-r * .78)}" stroke="#FFFFFF" stroke-opacity=".55" stroke-width="${f(Math.max(1, r * .09))}" fill="none" stroke-linecap="round"/>`;
    // yüzeyde ışık noktaları
    const rr = rng(Math.round(x * 7 + y * 3));
    for (let i = 0; i < Math.max(3, Math.round(r / 4)); i++) {
      const a = rr() * Math.PI * 2, d = r * (.25 + rr() * .6);
      const cx = Math.cos(a) * d, cy = Math.sin(a) * d;
      s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r * .18)}" fill="url(#glowGold)" opacity=".9"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(.7, r * .045))}" fill="#FFF4C2"/>`;
    }
    if (o.life !== false) {
      s += house(r, -18, true) + tree(r, 16, true) + lamp(r, 38, true);
      if (r > 18) s += house(r, -48, true, .8);
    }
    if (o.karar) s += flag(r, 5);
    if (o.moon) s += `<circle cx="${f(r * 1.45)}" cy="${f(-r * .9)}" r="${f(r * .18)}" fill="#FFF1E0"/><circle cx="${f(r * 1.45)}" cy="${f(-r * .9)}" r="${f(r * .6)}" fill="url(#glowPeach)" opacity=".6"/>`;
    return s + '</g>';
  }
  if (state === 'dark') {
    s += `<circle r="${f(r * 1.7)}" fill="url(#glowLilac)" opacity=".5"/>`;
    s += `<circle r="${f(r)}" fill="url(#pDark)" stroke="#8E80D6" stroke-opacity="${o.kenar ? 1 : .7}" stroke-width="${o.kenar ? 1.4 : 1}"/>`;
    s += `<ellipse cx="${f(r * .25)}" cy="${f(r * .3)}" rx="${f(r * .2)}" ry="${f(r * .13)}" fill="#1E1946" opacity=".7"/>`;
    s += `<ellipse cx="${f(-r * .35)}" cy="${f(r * .05)}" rx="${f(r * .12)}" ry="${f(r * .08)}" fill="#1E1946" opacity=".7"/>`;
    if (o.life !== false) s += house(r, -15, false) + tree(r, 22, false);
    if (o.karar) s += flag(r, 5, '#8E80D6');
    return s + '</g>';
  }
  if (state === 'wait') {
    // sırası geldi, sahibini bekliyor: kehribar halka (durağan)
    const n = o.waitRings ?? 1;
    for (let i = n; i >= 1; i--) {
      s += `<circle r="${f(r + 5 * i)}" fill="none" stroke="#FFB547" stroke-width="${f(1.9 - (i - 1) * .4)}" opacity="${f(.95 - (i - 1) * .25)}"/>`;
    }
    s += `<circle r="${f(r * 2)}" fill="url(#glowGold)" opacity=".28"/>`;
    s += `<circle r="${f(r)}" fill="url(#pWait)" stroke="#FFD9B8" stroke-opacity=".6" stroke-width="1"/>`;
    s += `<circle r="${f(r)}" fill="url(#shade)"/>`;
    s += house(r, -15, true) + tree(r, 24, false);
    s += sparkle(r * .55, -r * 1.25, 3.4, '#FFE7A8', 1);
    if (o.karar) s += flag(r, 40);
    return s + '</g>';
  }
  if (state === 'block') {
    s += `<circle r="${f(r * 2.5)}" fill="url(#glowCoral)"/>`;
    s += `<circle r="${f(r)}" fill="url(#pBlock)"/>`;
    // tutulma: önüne geçen karanlık ay
    s += `<circle cx="${f(r * .42)}" cy="${f(r * .18)}" r="${f(r * .82)}" fill="#1A1238" opacity=".92"/>`;
    s += `<circle r="${f(r + 1.5)}" fill="none" stroke="#FF8A78" stroke-width="1.6" opacity=".9"/>`;
    s += house(r, -40, false, .9);
    // fırtına bulutu + şimşek
    const cy = -r - (o.cloudGap ?? 10), cs = Math.max(.7, r / 20);
    s += `<g transform="translate(${f(r * .15)},${f(cy)}) scale(${f(cs)})"><g class="dongu-firtina">
      <path d="M-15,4 Q-19,4 -19,-1 Q-19,-6 -13,-6 Q-12,-13 -4,-13 Q2,-17 8,-11 Q16,-12 16,-4 Q20,-3 19,2 Q18,5 14,5 Z" fill="#6A5A9C" stroke="#C9BAF2" stroke-width="1"/>
      <path d="M-13,4 Q0,8 16,4" fill="none" stroke="#3E336E" stroke-width="2" opacity=".6"/>
      <path class="dongu-simsek" d="M1,4 L-4,13 L1,13 L-3,22 L7,10 L2,10 L6,4Z" fill="#FFD27A" stroke="#FF8A78" stroke-width=".8"/>
    </g></g>`;
    return s + '</g>';
  }
  return s + '</g>';
}

// --- gemiler ---
// kind: insan | agent | dis
function ship(x, y, ang, kind, initial, col = C.peach, sc = 1, o = {}) {
  let s = `<g transform="translate(${f(x)},${f(y)})"><g class="dongu-gemi"><g transform="rotate(${f(ang)}) scale(${sc})">`;
  const son = '</g></g></g>';
  if (kind === 'dis') {
    // UFO (plan 27 Eki, 3.17): Devir kullanıcısıysa (o.kullanici) kubbe dolu, değilse boş
    s += `<ellipse cx="0" cy="9" rx="13" ry="7" fill="url(#glowPeach)" opacity=".55"/>`;
    s += `<path d="M-8,-1 A8,8 0 0 1 8,-1Z" fill="${o.kullanici ? col : '#2B2160'}" stroke="${col}" stroke-width="1.4"/>`;
    s += `<ellipse cx="0" cy="1" rx="17" ry="5.5" fill="#FFF1E2" stroke="${col}" stroke-width="1.4"/>`;
    s += `<circle cx="-9" cy="1.5" r="1.4" fill="${col}"/><circle cx="0" cy="3" r="1.4" fill="${col}"/><circle cx="9" cy="1.5" r="1.4" fill="${col}"/>`;
    return s + son;
  }
  if (kind === 'agent') {
    // füze (plan 27 Eki, 3.16): ince uzun gövde, sahip renginde sivri burun ve üç kanat; köşeli pencere
    if (o.flame !== false) s += `<path d="M-17,-3 Q-34,0 -17,3Z" fill="url(#flame)"/>`;
    s += `<path d="M-10,-4.5 L-18,-11 L-17,-4.5Z M-10,4.5 L-18,11 L-17,4.5Z" fill="${col}"/>`;
    s += `<rect x="-17" y="-4.8" width="25" height="9.6" rx="2" fill="#FFF1E2"/>`;
    s += `<path d="M8,-4.8 Q17,-3 21,0 Q17,3 8,4.8Z" fill="${col}"/>`;
    s += `<path d="M-17,-1 L-21,0 L-17,1Z M-13,-.8 H-6 V.8 H-13Z" fill="${col}"/>`;
    s += `<rect x="-4" y="-4" width="8.5" height="8" rx="1.5" fill="#2B2160" stroke="${col}" stroke-width="1.4"/>`;
    s += `<text x=".25" y="2.9" transform="rotate(${f(-ang)} .25 0)" text-anchor="middle" font-family="Inter" font-weight="700" font-size="7.5" fill="#FFF3E8">${initial}</text>`;
    if (o.sira) s += `<text x="12" y="-8" transform="rotate(${f(-ang)} 12 -9)" text-anchor="middle" font-family="Inter" font-weight="800" font-size="6.5" fill="${col}">#${o.sira}</text>`;
    return s + son;
  }
  if (o.flame !== false) s += `<path d="M-11,-4 Q-30,0 -11,4Z" fill="url(#flame)"/>`;
  s += `<path d="M-9,-6 L-15,-11 L-12,-3Z M-9,6 L-15,11 L-12,3Z" fill="${col}"/>`;
  s += `<path d="M15,0 C11,-8.5 -1,-10 -10,-7.5 Q-13,0 -10,7.5 C-1,10 11,8.5 15,0Z" fill="#FFF1E2"/>`;
  s += `<path d="M15,0 C11,8.5 -1,10 -10,7.5 Q-11,4 -11,2 C0,4 9,3 15,0Z" fill="${col}" opacity=".55"/>`;
  s += `<path d="M15,0 C13,-3 11,-5 9,-6 L9,6 C11,5 13,3 15,0Z" fill="${col}"/>`;
  s += `<circle cx="-.5" cy="0" r="6" fill="#2B2160" stroke="${col}" stroke-width="1.6"/>`;
  s += `<text x="-.5" y="3.2" transform="rotate(${f(-ang)} -.5 0)" text-anchor="middle" font-family="Inter" font-weight="700" font-size="8.5" fill="#FFF3E8">${initial}</text>`;
  return s + son;
}

// isim etiketi (koyu hap)
function pill(x, y, text, o = {}) {
  const fs = o.fs || 11, w = o.w || Math.round(text.length * fs * .56 + 14), h = fs + 9;
  const ax = o.anchor === 'start' ? x : o.anchor === 'end' ? x - w : x - w / 2;
  return `<g><rect x="${f(ax)}" y="${f(y - h / 2)}" width="${w}" height="${h}" rx="${h / 2}" fill="${o.bg || '#1A1440'}" fill-opacity="${o.bgo ?? .88}" stroke="${o.stroke || 'none'}" stroke-width="1"/>
  <text x="${f(ax + w / 2)}" y="${f(y + fs * .36)}" text-anchor="middle" font-family="Inter" font-weight="${o.fw || 600}" font-size="${fs}" fill="${o.col || C.ink}">${text}</text></g>`;
}

// Monument Valley kulesi (hedef)
function tower(x, y, sc = 1, lit = true) {
  const g = lit ? 'tower' : 'towerDark';
  return `<g transform="translate(${f(x)},${f(y)}) scale(${sc})">
    ${lit ? '<ellipse cx="0" cy="-30" rx="46" ry="60" fill="url(#glowPeach)" opacity=".55"/>' : ''}
    <path d="M-16,0 L-16,-34 L16,-34 L16,0Z" fill="url(#${g})"/>
    <path d="M-16,-34 L0,-40 L16,-34 L0,-28Z" fill="${lit ? '#FFF0E2' : '#6A5FB0'}"/>
    <path d="M-10,-34 L-10,-58 L10,-58 L10,-34Z" fill="url(#${g})"/>
    <path d="M-10,-58 L0,-62 L10,-58 L0,-54Z" fill="${lit ? '#FFF0E2' : '#6A5FB0'}"/>
    <path d="M-12,-58 L0,-78 L12,-58Z" fill="${lit ? '#E8738A' : '#3A3170'}"/>
    <path d="M-5,0 L-5,-10 A5,5 0 0 1 5,-10 L5,0Z" fill="${lit ? '#FFD86E' : '#231D4C'}"/>
    <rect x="-3" y="-50" width="6" height="8" rx="3" fill="${lit ? '#FFD86E' : '#231D4C'}"/>
    <rect x="-.7" y="-92" width="1.4" height="15" fill="#FFF1E0"/>
    <path d="M.7,-92 L10,-88 L.7,-84Z" fill="${lit ? '#FFD27A' : '#8E80D6'}"/>
    <path d="M-22,0 L22,0 L16,7 L-16,7Z" fill="${lit ? '#C9768F' : '#2D2660'}"/>
  </g>`;
}

// varış kapısı (hedef, plan 27 Eki 3.G): halka biçimli geçit; tabanı y'de, boyu tower ile aynı ölçekte
function kapi(x, y, sc = 1, lit = true) {
  // açık akışta da altın (hedef her zaman bulunsun); kapanınca içi ışır
  const c = lit ? '#FFE29A' : '#FFD27A';
  return `<g transform="translate(${f(x)},${f(y)}) scale(${sc})">
    <circle cx="0" cy="-42" r="40" fill="url(#glowGold)" opacity="${lit ? .8 : .45}"/>
    <circle cx="0" cy="-42" r="22" fill="#1A1238" fill-opacity=".55"/>
    <circle cx="0" cy="-42" r="22" fill="none" stroke="${c}" stroke-width="7"/>
    <circle cx="0" cy="-42" r="22" fill="none" stroke="#FFF1E0" stroke-width="1.6" stroke-dasharray="4 7" opacity=".8"/>
    <circle cx="0" cy="-42" r="9" fill="url(#${lit ? 'glowPeach' : 'glowLilac'})" opacity=".9"/>
    <path d="M-10,-18 L-14,0 L14,0 L10,-18" fill="${lit ? '#C9768F' : '#2D2660'}"/>
    <path d="M-20,0 L20,0 L16,6 L-16,6Z" fill="${lit ? '#E8738A' : '#3A3170'}"/>
  </g>`;
}
// merkez (başlangıç) yıldızı
function yildiz(x, y, s = 1) {
  return `<g transform="translate(${f(x)},${f(y)})"><circle r="${f(12 * s)}" fill="url(#glowGold)" opacity=".9"/>${sparkle(0, 0, 8 * s, '#FFF1D6', 1)}<circle r="${f(2.2 * s)}" fill="#FFFFFF"/></g>`;
}

// kübik eğri yardımcıları (rota)
function bez(p0, p1, k = .5) {
  const dx = (p1[0] - p0[0]) * k;
  return [p0, [p0[0] + dx, p0[1]], [p1[0] - dx, p1[1]], p1];
}
function bAt(b, t) {
  const u = 1 - t;
  const x = u * u * u * b[0][0] + 3 * u * u * t * b[1][0] + 3 * u * t * t * b[2][0] + t * t * t * b[3][0];
  const y = u * u * u * b[0][1] + 3 * u * u * t * b[1][1] + 3 * u * t * t * b[2][1] + t * t * t * b[3][1];
  return [x, y];
}
function bAng(b, t) {
  const a = bAt(b, Math.max(0, t - .01)), c = bAt(b, Math.min(1, t + .01));
  return Math.atan2(c[1] - a[1], c[0] - a[0]) * 180 / Math.PI;
}
const bPath = (b) => `M${f(b[0][0])},${f(b[0][1])} C${f(b[1][0])},${f(b[1][1])} ${f(b[2][0])},${f(b[2][1])} ${f(b[3][0])},${f(b[3][1])}`;
function bLen(b) { let L = 0, p = bAt(b, 0); for (let i = 1; i <= 40; i++) { const q = bAt(b, i / 40); L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; } return L; }

// rota: kind normal | critical | ghost ; prog: geminin ilerleme oranı
function route(p0, p1, o = {}) {
  const b = bez(p0, p1, o.k ?? .5);
  const col = o.col || C.lilac;
  let s = '';
  if (o.kind === 'ghost') return `<path d="${bPath(b)}" fill="none" stroke="#9A8CCB" stroke-width="1" stroke-dasharray="1.5 4" opacity=".7" stroke-linecap="round"/>`;
  if (o.kind === 'critical') {
    s += `<path d="${bPath(b)}" fill="none" stroke="#FFD27A" stroke-width="7" opacity=".14" filter="url(#blur2)"/>`;
    s += `<path d="${bPath(b)}" fill="none" stroke="#FFD27A" stroke-width="1.6" opacity=".85"/>`;
    const L = bLen(b), n = Math.max(2, Math.floor(L / 15));
    for (let i = 1; i < n; i++) {
      const [x, y] = bAt(b, i / n);
      s += `<g transform="translate(${f(x)},${f(y)})"><circle r="6" fill="url(#glowGold)" opacity=".8"/><rect x="-2.4" y="-3" width="4.8" height="6" rx="1.6" fill="#FFE29A" stroke="#C98A4E" stroke-width=".6"/></g>`;
    }
  } else {
    s += `<path d="${bPath(b)}" fill="none" stroke="${col}" stroke-width="1.4" stroke-dasharray="4 4" opacity=".75" stroke-linecap="round"/>`;
  }
  if (o.prog != null) {
    let pts = [];
    for (let i = 0; i <= 30; i++) pts.push(bAt(b, o.prog * i / 30));
    s += `<polyline points="${pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ')}" fill="none" stroke="${o.shipCol || C.peach}" stroke-width="3" stroke-linecap="round" opacity=".95"/>`;
    // iz pırıltıları
    for (let i = 1; i < 4; i++) { const [x, y] = bAt(b, o.prog * (1 - i * .22)); s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.6 - i * .3)}" fill="#FFF1D6" opacity="${f(.9 - i * .2)}"/>`; }
  }
  return s;
}
function onRoute(p0, p1, t, k = .5) { const b = bez(p0, p1, k); return { p: bAt(b, t), a: bAng(b, t) }; }

// galaksi (uzak ölçek): adım sayısı kadar gezegen spiral kollarda
// steps: [{state}], o: {scale, tilt, seed, attention:'block'|'wait'|null, done:bool}
function galaxy(cx, cy, steps, o = {}) {
  const sc = o.scale || 1, n = steps.length;
  const lit = steps.filter((s) => s.state === 'lit').length / n;
  const r = rng(o.seed || 3);
  let s = `<g transform="translate(${f(cx)},${f(cy)}) rotate(${o.rot ?? -18}) scale(${sc},${f(sc * (o.flat ?? .58))})">`;
  // halo
  s += `<circle r="${f(70)}" fill="url(#${lit > .5 ? 'glowPeach' : 'glowLilac'})" opacity="${f(.35 + lit * .6)}"/>`;
  // spiral toz kolları
  for (let arm = 0; arm < 2; arm++) {
    let d = '';
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, a = arm * Math.PI + t * Math.PI * 1.5, rr = 8 + t * 52;
      d += (i ? 'L' : 'M') + f(Math.cos(a) * rr) + ',' + f(Math.sin(a) * rr);
    }
    s += `<path d="${d}" fill="none" stroke="${lit > .5 ? '#FFC9A3' : '#9C8BE0'}" stroke-width="9" opacity="${f(.12 + lit * .18)}" stroke-linecap="round" filter="url(#blur2)"/>`;
    s += `<path d="${d}" fill="none" stroke="${lit > .5 ? '#FFE3C8' : '#B9A6F2'}" stroke-width="1" opacity="${f(.35 + lit * .3)}" stroke-linecap="round"/>`;
  }
  // toz yıldızları
  for (let i = 0; i < 26; i++) {
    const t = r(), arm = r() < .5 ? 0 : Math.PI, a = arm + t * Math.PI * 1.5 + (r() - .5) * .5, rr = 8 + t * 52 + (r() - .5) * 8;
    s += `<circle cx="${f(Math.cos(a) * rr)}" cy="${f(Math.sin(a) * rr)}" r="${f(.5 + r() * .8)}" fill="${lit > .5 ? '#FFE9D2' : '#D2C6FF'}" opacity="${f(.4 + r() * .5)}"/>`;
  }
  // çekirdek
  s += `<circle r="${f(14 + lit * 10)}" fill="url(#glowPeach)" opacity="${f(.25 + lit * .75)}"/>`;
  s += `<circle r="${f(3 + lit * 3)}" fill="${lit > .3 ? '#FFF1DC' : '#8E80D6'}"/>`;
  s += '</g>';
  // gezegenler (yamuk dönüşümün dışında, yuvarlak kalsın)
  const pos = galaxyPos(cx, cy, n, o);
  steps.forEach((st, i) => {
    const [x, y] = pos[i];
    const pr = (o.pr || 4.2) * (st.state === 'lit' ? 1.15 : 1);
    if (st.state === 'lit') s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(pr * 3)}" fill="url(#glowGold)" opacity=".75"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(pr)}" fill="url(#pLit2)"/>`;
    else if (st.state === 'ghost') s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(pr * .7)}" fill="none" stroke="#A99BDB" stroke-width=".8" stroke-dasharray="1.5 1.5"/>`;
    else if (st.state === 'wait') s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(pr + 3)}" fill="none" stroke="#FFD27A" stroke-width="1" stroke-dasharray="2 2" opacity=".9"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(pr)}" fill="url(#pWait)"/>`;
    else if (st.state === 'block') s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(pr * 3.2)}" fill="url(#glowCoral)"/><circle cx="${f(x)}" cy="${f(y)}" r="${f(pr * 1.2)}" fill="url(#pBlock)"/><circle cx="${f(x + pr * .5)}" cy="${f(y + pr * .2)}" r="${f(pr)}" fill="#1A1238" opacity=".9"/>`;
    else s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(pr)}" fill="url(#pDark)" stroke="#8E80D6" stroke-width=".7" stroke-opacity=".8"/>`;
  });
  return s;
}
function galaxyPos(cx, cy, n, o = {}) {
  const sc = o.scale || 1, flat = o.flat ?? .58, rot = (o.rot ?? -18) * Math.PI / 180;
  const out = [];
  for (let i = 0; i < n; i++) {
    const arm = i % 2, t = (Math.floor(i / 2) + .7) / Math.ceil(n / 2);
    const a = arm * Math.PI + t * Math.PI * 1.5, rr = 10 + t * 48;
    let x = Math.cos(a) * rr * sc, y = Math.sin(a) * rr * sc * flat;
    const X = x * Math.cos(rot) - y * Math.sin(rot), Y = x * Math.sin(rot) + y * Math.cos(rot);
    out.push([cx + X, cy + Y]);
  }
  return out;
}

function page(w, h, body, extraCss = '') {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=${w}">
<style>html,body{margin:0;padding:0;background:#090619;width:${w}px;height:${h}px;overflow:hidden}svg{display:block}${extraCss}</style></head>
<body>${body}</body></html>`;
}

// sinematik kenar kararması
function vignette(w, h) { return `<rect width="${w}" height="${h}" fill="url(#vign)" pointer-events="none"/>`; }

// İş payı halesi: kişi payına göre bölünmüş halka. insan = dolu ışık yayı, agent = pırıltı boncuk dizisi (renkten bağımsız)
// shares: [{ad, n, agent}]
function shareRing(x, y, r, shares, o = {}) {
  const tot = shares.reduce((a, b) => a + b.n, 0); if (!tot) return '';
  const col = (sh) => sh.agent ? '#C8B6FF' : '#FFC27E';
  let s = `<g transform="translate(${f(x)},${f(y)})">`;
  let a0 = -90; const gap = shares.length > 1 ? 10 : 0;
  for (const sh of shares) {
    const da = sh.n / tot * 360, a1 = a0 + da;
    const s0 = (a0 + gap / 2) * Math.PI / 180, s1 = (a1 - gap / 2) * Math.PI / 180;
    if (sh.agent) {
      const n = Math.max(3, Math.round((s1 - s0) * r / 5.5));
      for (let i = 0; i <= n; i++) { const a = s0 + (s1 - s0) * i / n; s += `<circle cx="${f(Math.cos(a) * r)}" cy="${f(Math.sin(a) * r)}" r="${o.bead || 1.7}" fill="${col(sh)}"/>`; }
    } else {
      const large = (s1 - s0) > Math.PI ? 1 : 0;
      const full = (s1 - s0) >= Math.PI * 2 - .01;
      if (full) s += `<circle r="${r}" fill="none" stroke="${col(sh)}" stroke-width="${o.w || 3}"/><circle r="${r}" fill="none" stroke="${col(sh)}" stroke-width="${(o.w || 3) * 3}" opacity=".25" filter="url(#blur2)"/>`;
      else { const d = `M${f(Math.cos(s0) * r)},${f(Math.sin(s0) * r)} A${r},${r} 0 ${large} 1 ${f(Math.cos(s1) * r)},${f(Math.sin(s1) * r)}`; s += `<path d="${d}" fill="none" stroke="${col(sh)}" stroke-width="${(o.w || 3) * 3}" opacity=".25" filter="url(#blur2)" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col(sh)}" stroke-width="${o.w || 3}" stroke-linecap="round"/>`; }
    }
    if (o.beads !== false) {
      const am = (a0 + da / 2) * Math.PI / 180, bx = Math.cos(am) * r, by = Math.sin(am) * r, br = o.br || 7;
      s += `<circle cx="${f(bx)}" cy="${f(by)}" r="${br}" fill="#1A1238" stroke="${col(sh)}" stroke-width="1.3"/><text x="${f(bx)}" y="${f(by + br * .42)}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="${f(br * 1.15)}" fill="#FFF3E8">${sh.ad[0]}</text>`;
    }
    a0 = a1;
  }
  return s + '</g>';
}

// masalsı kilit parantezi: dört yumuşak köşe + köşede küçük yıldız + işaret rozeti
function brackets(x, y, w, h, col, glyph = '', gl = false) {
  const L = Math.min(18, w * .25), r = 7;
  const c = (cx, cy, sx, sy) => `<path d="M${f(cx)},${f(cy + sy * L)} L${f(cx)},${f(cy + sy * r)} Q${f(cx)},${f(cy)} ${f(cx + sx * r)},${f(cy)} L${f(cx + sx * L)},${f(cy)}" fill="none" stroke="${col}" stroke-width="2.2" stroke-linecap="round"/>`;
  let s = `<g>`;
  s += `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="16" fill="${col}" opacity=".05"/>`;
  s += c(x, y, 1, 1) + c(x + w, y, -1, 1) + c(x, y + h, 1, -1) + c(x + w, y + h, -1, -1);
  s += sparkle(gl ? x + w : x, y, 4.5, col, 1);
  if (glyph) s += `<g transform="translate(${f(gl ? x : x + w)},${f(y)})"><circle r="12" fill="#150E33" stroke="${col}" stroke-width="1.4"/>${glyph}</g>`;
  return s + '</g>';
}

export { kapi, yildiz, vignette, shareRing, brackets, C, rng, f, defs, sky, sparkle, grain, planet, ship, pill, tower, route, onRoute, bez, bAt, galaxy, galaxyPos, page, flag };
