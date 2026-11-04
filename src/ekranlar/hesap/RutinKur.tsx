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

/** Kurulum alt adımı: tek cümle ne yapacağın, altında ne göreceğin (W3) */
function Is({ children, gor }: { children: React.ReactNode; gor?: React.ReactNode }) {
  return <li>{children}{gor && <small className="rk-gor">Göreceğin: {gor}</small>}</li>;
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
 * W3 (4 Kas): metinler yeniden; her alt adım tek cümle ve ne göreceğin, "Devir listede yoksa" notu, açıklamalı seçim.
 * agent verilirse rutin o agent için kurulur: zamanlanmış rutinin istemi ve API tetiğinin adı agent'ın adını taşır.
 *
 * AI yapsın kurulumu (0.29.1): iki adım, her kullanıcı bir kez. 1) Claude'u Devir'e bağla (MCP). 2) Claude'da zamanlanmış bir rutin kur;
 * iki yol, seçimi kullanıcı yapar: belirli saatlerde (jetonsuz; rutin Devir'e uğrar, hazır işlerini alır) ya da iş hazır olunca hemen (API tetiği).
 * Rutin kişinin kendi Claude hesabında yaşar; Devir onu kendisi kuramaz, bu yüzden adımlar burada tek tek anlatılır.
 */
export function RutinKur({ mcpAdres, mcpBagli, agent = null, kapat }: { mcpAdres: string; mcpBagli: boolean; agent?: string | null; kapat: () => void }) {
  const tk = useQuery({ queryKey: ['tetikler', agent], queryFn: () => api.get<any>(`/tetikler${agent ? `?agent=${encodeURIComponent(agent)}` : ''}`), refetchInterval: 10_000, retry: false });
  const L: any[] = tk.data?.tetikler || [];
  const zamanli = L.find((t) => t.tur === 'zamanli');
  const apiTetik = L.filter((t) => t.tur !== 'zamanli');
  const rutinVar = !!(zamanli?.son_tetik_at || apiTetik.length);
  const [yol, setYol] = useState<'zamanli' | 'api'>('zamanli');
  const [ad, setAd] = useState(agent || '');
  const [url, setUrl] = useState('');
  const [jeton, setJeton] = useState('');
  const m = useMutation({ mutationFn: () => api.post<any>('/tetikler', { ad: ad.trim(), url: url.trim(), jeton: jeton.trim() }), onSuccess: () => { for (const k of [['tetikler'], ['agentlar-ai']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); } });
  const son = zamanli?.son_tetik_at ? Date.parse(zamanli.son_tetik_at) : null;
  const rutinAdi = agent || 'Devir AI yapsın';
  return (
    <AltSayfa acik kapat={kapat} baslik="AI yapsın kurulumu" yukseklik={60} duraklar={['yuksek']}>
      <div className="rutin-kur">
        <h2>AI yapsın kurulumu{agent ? ` · ${agent}` : ''}</h2>
        <p className="rk-giris">Bir kez kurulur. Sonra “AI yapsın” işaretlediğin {agent ? `${agent} işlerini` : 'agent işlerini'} Claude, sırası gelince senin hesabından yapar; çıktıyı sen onaylarsın.</p>
        <ol className="rk-adimlar">
          <Adim no={1} baslik="Claude’u Devir’e bağla" bitti={mcpBagli}>
            {mcpBagli ? <p>Claude bağlı; bu adım tamam.</p> : <>
              <ol className="rk-alt">
                <Is gor={<>bağlayıcı ekleme penceresi.</>}>Claude’da <b>Ayarlar › Bağlayıcılar</b>’ı açıp <b>Özel bağlayıcı ekle</b>’ye bas.</Is>
                <Is gor={<>adres alanı dolu, ad alanında “Devir”.</>}>Ad olarak <b>Devir</b> yaz, adres alanına bu adresi yapıştır. <Kopyala metin={mcpAdres} etiket="Adresi kopyala" /></Is>
                <Is gor={<>Devir’in izin sayfası; izin verince bağlayıcılar listesinde <b>Devir · Bağlı</b>.</>}><b>Bağlan</b>’a basıp açılan Devir sayfasında e-postanla izin ver.</Is>
              </ol>
              <a className="rk-git" href={CLAUDE_BAGLAYICI} target="_blank" rel="noopener noreferrer">Claude bağlayıcılarını aç</a>
            </>}
          </Adim>
          <Adim no={2} baslik="Claude’da rutini kur" bitti={rutinVar}>
            <p>Rutin ne zaman çalışsın? Birini seç; sonra ötekini de ekleyebilirsin.</p>
            <div className="rk-sec" role="radiogroup" aria-label="Rutin ne zaman çalışsın">
              <button type="button" role="radio" aria-checked={yol === 'zamanli'} className={yol === 'zamanli' ? 'secili' : ''} onClick={() => setYol('zamanli')}>
                <b>Belirli saatlerde</b><span>Rutin seçtiğin saatlerde Devir’e uğrar, hazır işlerini alır. Jeton gerekmez, telefondan da kurulur. İş en geç bir sonraki saatte başlar.</span>
              </button>
              <button type="button" role="radio" aria-checked={yol === 'api'} className={yol === 'api' ? 'secili' : ''} onClick={() => setYol('api')}>
                <b>İş hazır olunca hemen</b><span>Devir, iş hazır olduğu an rutini başlatır; beklemez. Bilgisayardan kurulur, rutinin adresini ve jetonunu buraya yazarsın.</span>
              </button>
            </div>
            {yol === 'zamanli' ? <>
              <ol className="rk-alt">
                <Is gor={<>boş bir rutin formu.</>}>Claude rutinleri sayfasını açıp <b>Yeni rutin</b>’e bas.</Is>
                <Is gor={<>rutin listende bu ad; adı yalnız sen görürsün.</>}>Ad olarak <b>{rutinAdi}</b> yaz.</Is>
                <Is gor={<>istem alanında Devir’in metni{agent ? `; metin ${agent} adını taşır, Devir işleri ona göre verir` : ''}.</>}>İstem alanına bu metni yapıştır. <Kopyala metin={tk.data?.zamanli_metni || ''} etiket="Rutin istemini kopyala" /></Is>
                <Is gor={<>bağlayıcılar arasında <b>Devir</b> açık.</>}>Bağlayıcılarda <b>Devir</b>’i aç.</Is>
                <Is gor={<>seçtiğin saatler; iş günlerinde 09:00, 13:00, 17:00 çoğu kişiye yeter, Claude planının günlük rutin sınırını aşma.</>}>Tetik olarak <b>Zamanlama</b>’yı seçip saatleri gir.</Is>
                <Is gor={<>birkaç dakika içinde aşağıdaki 3. adım yeşil olur.</>}><b>Kaydet</b>’e, sonra bir kez <b>Şimdi çalıştır</b>’a bas.</Is>
              </ol>
              <a className="rk-git" href={CLAUDE_RUTINLER} target="_blank" rel="noopener noreferrer">Claude rutinlerini aç</a>
            </> : m.data ? <p className="rk-tamam">{m.data.not}</p> : <form className="rk-api" onSubmit={(e) => { e.preventDefault(); if (ad.trim() && url.trim() && jeton.trim()) m.mutate(); }}>
              <ol className="rk-alt">
                <Is gor={<>boş bir rutin formu; API tetiği yalnız web’de eklenir.</>}>Bilgisayardan Claude rutinleri sayfasını açıp <b>Yeni rutin</b>’e bas.</Is>
                <Is gor={<>istem alanında Devir’in metni.</>}>İstem alanına bu metni yapıştır. <Kopyala metin={tk.data?.rutin_metni || ''} etiket="Rutin istemini kopyala" /></Is>
                <Is gor={<>bağlayıcılar arasında <b>Devir</b> açık, rutin kayıtlı.</>}>Bağlayıcılarda <b>Devir</b>’i açıp kaydet.</Is>
                <Is gor={<>bir adres ve <b>yalnız bir kez gösterilen</b> jeton.</>}>Rutinin <b>Tetikler</b> bölümünde <b>API</b> ekle.</Is>
                <Is gor={<>aşağıda “tetiği eklendi” yazısı.</>}>Adresi ve jetonu aşağıya yapıştırıp <b>Bağla</b>’ya bas.</Is>
              </ol>
              <a className="rk-git" href={CLAUDE_RUTINLER} target="_blank" rel="noopener noreferrer">Claude rutinlerini aç</a>
              <label><span className="alan-etiket">Agent adı (görevlerde sahip olarak geçen ad)</span><input className="alan" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Ör. Berkin’in Claude’u" /></label>
              <label><span className="alan-etiket">Tetik adresi</span><input className="alan" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.anthropic.com/v1/claude_code/routines/…/fire" inputMode="url" /></label>
              <label><span className="alan-etiket">Jeton</span><input className="alan" type="password" autoComplete="off" value={jeton} onChange={(e) => setJeton(e.target.value)} placeholder="Yalnız bir kez gösterilen jeton" /></label>
              <p className="rk-not">Jeton şifreli saklanır, bir daha gösterilmez.</p>
              <Dugme type="submit" fs={16} disabled={!ad.trim() || !url.trim() || !jeton.trim()} mesgul={m.isPending}>Bağla</Dugme>
              {m.isError && <p className="rk-hata" role="alert">{(m.error as Error).message}</p>}
            </form>}
            <p className="rk-not rk-yoksa"><b>Devir listede yoksa:</b> bağlayıcılar arasında Devir görünmüyorsa 1. adım bitmemiştir; Claude’da <b>Ayarlar › Bağlayıcılar</b>’da Devir’in “Bağlı” yazdığını gör, sonra rutin sayfasını yenile.</p>
          </Adim>
          <Adim no={3} baslik="Çalıştığını gör" bitti={!!son || apiTetik.length > 0}>
            <p role="status" className={son || apiTetik.length ? 'rk-durum yesil' : 'rk-durum'}>
              {son ? `Rutin bağlı · Devir’e son uğradığı an ${gunAy(son)} ${saat(son)}`
                : apiTetik.length ? `API tetiği bağlı: ${apiTetik.map((t) => t.ad).join(', ')}`
                  : 'Rutin henüz Devir’e uğramadı. “Şimdi çalıştır”dan birkaç dakika sonra burası yeşil olur.'}
            </p>
          </Adim>
        </ol>
        <p className="rk-not">Rutin senin Claude aboneliğinden çalışır. İşi olmayan çalışma hemen biter. Karar, ödeme ve dışarıya gönderme işlerini AI yapsın yapmaz.</p>

        <Dugme type="button" tur="ikincil" ton="lila" fs={15} yukseklik={48} onClick={kapat}>Kapat</Dugme>
      </div>
    </AltSayfa>
  );
}
