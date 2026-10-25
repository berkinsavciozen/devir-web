import { useState } from 'react';

/** Önizleme sayfasında (VITE_HASH) örnek hallere geçiş: hal ya da senaryo değişince örnek sunucu baştan kurulur. */
const ORNEKLER: [string, string][] = [
  ['Günlük görünüm', '/?senaryo=berkin&hal='],
  ['Karar bekleyen adım', '/akis/XPVZ/adim/9?senaryo=berkin&hal=karar'],
  ['Kalemli adım (uydular)', '/akis/XPVZ?senaryo=berkin&hal=uydu'],
  ['Alt görevli adım', '/akis/RTD5/adim/10?senaryo=berkin&hal=alt'],
  ['Hedefi geçmiş akış', '/akis/RTD5?senaryo=berkin&hal=gecikme'],
  ['Kapanmış akış', '/akis/GKX8?senaryo=berkin&hal='],
  ['Yeni iş taslağı', '/yeni?senaryo=berkin&hal='],
  ['14 akışlı evren', '/?senaryo=berkin&hal=olcek'],
  ['Ekip ve ayarlar', '/ayarlar/ekip?senaryo=berkin&hal=ekip'],
  ['Dış katılımcı bağlantısı', '/l/k7Q2emreTestBank00wP9?senaryo=berkin&hal='],
  ['Yeni hesap (boş evren)', '/?senaryo=bos&hal='],
  ['Davetle gelen kişi', '/?senaryo=davetli&hal='],
  ['Giriş ekranı', '/?senaryo=berkin&hal=&oturum=yok'],
];

export function OrnekMenusu() {
  const [acik, setAcik] = useState(false);
  const git = (h: string) => {
    try { sessionStorage.clear(); localStorage.removeItem('devir:alan'); } catch { /* yok */ }
    location.hash = h;
    location.reload();
  };
  return (
    <div className="ornek-menusu">
      <button type="button" className="ornek-dugme" aria-expanded={acik} onClick={() => setAcik(!acik)}>Örnekler</button>
      {acik && <ul>{ORNEKLER.map(([ad, h]) => <li key={ad}><button type="button" onClick={() => git(h)}>{ad}</button></li>)}</ul>}
    </div>
  );
}
