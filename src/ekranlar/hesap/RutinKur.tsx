import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { sorguIstemcisi } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Dugme } from '../../bilesen/Dugme';
import { gunAy, saat } from '../../cizim/yol.js';

const CLAUDE_BAGLAYICI = 'https://claude.ai/settings/connectors';
const CLAUDE_RUTINLER = 'https://claude.ai/code/routines';

function Kopyala({ metin, etiket, kopyalandi = 'Kopyalandı' }: { metin: string; etiket: string; kopyalandi?: string }) {
  const [tamam, setTamam] = useState(false);
  return (
    <button type="button" className="rk-kopya" disabled={!metin} onClick={async () => {
      try { await navigator.clipboard.writeText(metin); } catch {
        const t = document.createElement('textarea'); t.value = metin; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
      }
      setTamam(true); window.setTimeout(() => setTamam(false), 1400);
    }}>{tamam ? kopyalandi : etiket}</button>
  );
}

function Adim({ no, baslik, bitti, children }: { no: number; baslik: string; bitti: boolean; children: React.ReactNode }) {
  return (
    <li className={`rk-adim ${bitti ? 'bitti' : ''}`}>
      <span className="rk-no" aria-hidden>{bitti ? '✓' : no}</span>
      <div className="rk-govde">
        <h3>{baslik}<span className="gorunmez">{bitti ? ' (tamam)' : ' (yapılacak)'}</span></h3>
        {children}
      </div>
    </li>
  );
}

/**
 * AI yapsın kurulumu (0.29.1): iki adım, her kullanıcı bir kez. 1) Claude'u Devir'e bağla (MCP). 2) Claude'da zamanlanmış bir rutin kur;
 * iki yol, seçimi kullanıcı yapar: belirli saatlerde (jetonsuz; rutin Devir'e uğrar, hazır işlerini alır) ya da iş hazır olunca hemen (API tetiği).
 * Rutin kişinin kendi Claude hesabında yaşar; Devir onu kendisi kuramaz, bu yüzden adımlar burada tek tek anlatılır.
 */
export function RutinKur({ mcpAdres, mcpBagli, kapat }: { mcpAdres: string; mcpBagli: boolean; kapat: () => void }) {
  const tk = useQuery({ queryKey: ['tetikler'], queryFn: () => api.get<any>('/tetikler'), refetchInterval: 10_000, retry: false });
  const L: any[] = tk.data?.tetikler || [];
  const zamanli = L.find((t) => t.tur === 'zamanli');
  const apiTetik = L.filter((t) => t.tur !== 'zamanli');
  const rutinVar = !!(zamanli?.son_tetik_at || apiTetik.length);
  const [yol, setYol] = useState<'zamanli' | 'api'>('zamanli');
  const [ad, setAd] = useState('');
  const [url, setUrl] = useState('');
  const [jeton, setJeton] = useState('');
  const m = useMutation({ mutationFn: () => api.post<any>('/tetikler', { ad: ad.trim(), url: url.trim(), jeton: jeton.trim() }), onSuccess: () => void sorguIstemcisi.invalidateQueries({ queryKey: ['tetikler'] }) });
  const son = zamanli?.son_tetik_at ? Date.parse(zamanli.son_tetik_at) : null;

  return (
    <AltSayfa acik kapat={kapat} baslik="AI yapsın kurulumu" yukseklik={60} duraklar={['yuksek']}>
      <div className="rutin-kur">
        <h2>AI yapsın kurulumu</h2>
        <p className="rk-giris">Bir kez kurulur. Sonra “AI yapsın” işaretlediğin görevleri Claude, sırası gelince senin hesabından kendiliğinden yapar; çıktıyı sen onaylarsın.</p>
        <ol className="rk-adimlar">
          <Adim no={1} baslik="Claude’u Devir’e bağla" bitti={mcpBagli}>
            {mcpBagli ? <p>Claude bağlı. Bu adım tamam.</p> : <>
              <ol className="rk-alt">
                <li>Claude’da <b>Ayarlar › Bağlayıcılar</b>’ı aç, <b>Özel bağlayıcı ekle</b>’ye bas.</li>
                <li>Ad olarak <b>Devir</b> yaz, adres alanına aşağıdaki adresi yapıştır. <Kopyala metin={mcpAdres} etiket="Adresi kopyala" /></li>
                <li><b>Bağlan</b>’a bas, açılan Devir sayfasında e-postanla izin ver.</li>
              </ol>
              <a className="rk-git" href={CLAUDE_BAGLAYICI} target="_blank" rel="noopener noreferrer">Claude bağlayıcılarını aç</a>
            </>}
          </Adim>
          <Adim no={2} baslik="Claude’da rutini kur" bitti={rutinVar}>
            <p>Rutin ne zaman çalışsın? İkisinden birini seç; istersen sonra ötekini de eklersin.</p>
            <div className="rk-sec" role="radiogroup" aria-label="Rutin ne zaman çalışsın">
              <button type="button" role="radio" aria-checked={yol === 'zamanli'} className={yol === 'zamanli' ? 'secili' : ''} onClick={() => setYol('zamanli')}><b>Belirli saatlerde</b><span>En kolayı. Jeton yok; ör. günde 3 kez işlerine bakar.</span></button>
              <button type="button" role="radio" aria-checked={yol === 'api'} className={yol === 'api' ? 'secili' : ''} onClick={() => setYol('api')}><b>İş hazır olunca hemen</b><span>Beklemez. Rutinin adresini ve jetonunu buraya yazarsın.</span></button>
            </div>
            {yol === 'zamanli' ? <>
              <ol className="rk-alt">
                <li>Claude rutinleri sayfasını aç, <b>Yeni rutin</b>’e bas.</li>
                <li>Ad: <b>Devir AI yapsın</b>.</li>
                <li>İstem alanına bu metni yapıştır. <Kopyala metin={tk.data?.zamanli_metni || ''} etiket="Rutin istemini kopyala" /></li>
                <li>Bağlayıcılarda <b>Devir</b>’i aç.</li>
                <li>Tetik olarak <b>Zamanlama</b>’yı seç. İş günlerinde 2–3 kez (ör. 09:00, 13:00, 17:00) çoğu kişiye yeter; Claude planının günlük rutin sınırını aşma.</li>
                <li><b>Kaydet</b>, sonra <b>Şimdi çalıştır</b> ile bir kez dene.</li>
              </ol>
              <a className="rk-git" href={CLAUDE_RUTINLER} target="_blank" rel="noopener noreferrer">Claude rutinlerini aç</a>
            </> : m.data ? <p className="rk-tamam">{m.data.not}</p> : <form className="rk-api" onSubmit={(e) => { e.preventDefault(); if (ad.trim() && url.trim() && jeton.trim()) m.mutate(); }}>
              <ol className="rk-alt">
                <li>Claude rutinleri sayfasını aç (bilgisayardan; API tetiği yalnız web’de eklenir), <b>Yeni rutin</b>’e bas.</li>
                <li>İstem alanına bu metni yapıştır. <Kopyala metin={tk.data?.rutin_metni || ''} etiket="Rutin istemini kopyala" /></li>
                <li>Bağlayıcılarda <b>Devir</b>’i aç, kaydet.</li>
                <li>Rutinin <b>Tetikler</b> bölümünde <b>API</b> ekle. Gösterilen adresi ve <b>bir kez gösterilen</b> jetonu aşağıya yapıştır.</li>
              </ol>
              <a className="rk-git" href={CLAUDE_RUTINLER} target="_blank" rel="noopener noreferrer">Claude rutinlerini aç</a>
              <label><span className="alan-etiket">Agent adı (görevlerde sahip)</span><input className="alan" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ör. Berkin’in Claude’u" /></label>
              <label><span className="alan-etiket">Tetik adresi</span><input className="alan" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.anthropic.com/v1/claude_code/routines/…/fire" inputMode="url" /></label>
              <label><span className="alan-etiket">Jeton</span><input className="alan" type="password" autoComplete="off" value={jeton} onChange={(e) => setJeton(e.target.value)} placeholder="Yalnız bir kez gösterilen jeton" /></label>
              <p className="rk-not">Jeton şifreli saklanır, bir daha gösterilmez.</p>
              <Dugme type="submit" fs={16} disabled={!ad.trim() || !url.trim() || !jeton.trim()} mesgul={m.isPending}>Bağla</Dugme>
              {m.isError && <p className="rk-hata" role="alert">{(m.error as Error).message}</p>}
            </form>}
          </Adim>
          <Adim no={3} baslik="Çalıştığını gör" bitti={!!son || apiTetik.length > 0}>
            <p role="status" className={son || apiTetik.length ? 'rk-durum yesil' : 'rk-durum'}>
              {son ? `Rutin bağlı · Devir’e son uğradığı an ${gunAy(son)} ${saat(son)}`
                : apiTetik.length ? `API tetiği bağlı: ${apiTetik.map((t) => t.ad).join(', ')}`
                  : 'Rutin henüz Devir’e uğramadı. “Şimdi çalıştır”dan bir iki dakika sonra burası yeşil olur.'}
            </p>
          </Adim>
        </ol>
        <p className="rk-not">Rutin senin Claude aboneliğinden çalışır. İşi olmayan çalışma hemen biter. Karar, ödeme ve dışarıya gönderme işlerini AI yapsın yapmaz.</p>

        <Dugme type="button" tur="ikincil" ton="lila" fs={15} yukseklik={48} onClick={kapat}>Kapat</Dugme>
      </div>
    </AltSayfa>
  );
}
