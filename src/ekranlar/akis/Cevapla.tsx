import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import { sorguIstemcisi } from '../../api/sorgular';
import { AltSayfa } from '../../bilesen/AltSayfa';
import { Baslik } from '../../bilesen/Baslik';
import { Dugme } from '../../bilesen/Dugme';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { akisModeli, yolCiz } from '../../cizim/yol.js';
import { akisAdi, doluSatir } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { useAkis } from './Galaksi';
import { acikDallar, dalHaric, soruKatmani } from './soru';

const GEO = { cx: 195, cy: 212, R: 120, ps: .7 };

/** E3 · Cevapla: açık soru, seçenek kartları (ya da tarih), "Cevapla", "Henüz bilmiyorum" (§5 E3). */
export function Cevapla({ kod, soru, ben }: { kod: string; soru: string; ben: string }) {
  const q = useAkis(kod), d = q.data;
  const NOW = simdi();
  const S = d?.acik_sorular?.find((x: any) => x.kod === soru);
  const dal = d ? acikDallar(d).find((x) => x.kod === soru) : undefined;
  const [sec, setSec] = useState<string | null>(null);
  const [tarih, setTarih] = useState('');
  const secili = sec ?? dal?.kollar[0]?.deger ?? null;
  const arka = useMemo(() => {
    if (!d) return '';
    const M = akisModeli(d, { sahip: ben, haric: dalHaric(d) });
    const Y = yolCiz(M, { ...GEO, now: NOW, kuleEtiket: false, labels: [] });
    const K = soruKatmani(d, M, Y, { ...GEO, now: NOW }, { sec: dal ? secili : undefined, hap: false });
    return `<g opacity=".55">${Y.svg}</g><rect width="390" height="844" fill="#07051A" opacity=".3"/>` + K.svg;
  }, [d, ben, NOW, secili, dal]);
  const geri = () => (history.length > 1 ? history.back() : git(`/akis/${encodeURIComponent(kod)}`));
  const cevap = useMutation({
    mutationFn: () => api.post<any>(`/akis/${encodeURIComponent(kod)}/cevap`, { soru, cevap: dal ? secili : tarih }),
    onSuccess: () => { for (const k of [['akis', kod], ['ozet']]) void sorguIstemcisi.invalidateQueries({ queryKey: k }); git(`/akis/${encodeURIComponent(kod)}`); },
  });
  if (!d) return <Sahne gok={{ tohum: 61, yildiz: 260 }} etiket="Açık soru" />;
  const ad = akisAdi(d.akis);
  const Y0 = 352 + 28, P = (y: number) => y - Y0;
  if (!S) {
    return (
      <Sahne gok={{ tohum: 61, yildiz: 260 }} cizim={arka} etiket={ad}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={geri} /></Kutu>
        <Metin y={420} fs={17} lh={22} serif renk="ink2" hiza="orta">Bu soru cevaplanmış.</Metin>
      </Sahne>
    );
  }
  const satirlar = doluSatir(S.soru, 330, '21px Caladea', 3);
  const alt = dal ? (dal.kollar.length === 2 ? 'Cevaba göre bir adım kalır, öbürü söner.' : 'Cevaba göre bir adım kalır, öbürleri söner.') : 'Tarih gelince adım takvimdeki yerine oturur.';
  const hazir = dal ? !!secili : /^\d{4}-\d{2}-\d{2}$/.test(tarih);
  const butonY = dal ? P(352 + 152) + dal.kollar.length * 76 + 8 : P(352 + 312);
  return (
    <>
      <Sahne gok={{ tohum: 61, yildiz: 260 }} cizim={arka} etiket={ad}>
        <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik={ad} geri={geri} /></Kutu>
      </Sahne>
      <AltSayfa acik kapat={geri} baslik="Açık soru" yukseklik={352} duraklar={['orta', 'yuksek']} perdesiz>
        <form className="karar-panel" style={{ height: butonY + 64 + 46 + 40 }} onSubmit={(e) => { e.preventDefault(); if (hazir) cevap.mutate(); }}>
          <Metin y={P(352 + 44)} fs={12} lh={16} agirlik={700} renk="ink3" style={{ letterSpacing: '.6px' }}>AÇIK SORU</Metin>
          <Metin y={P(352 + 74)} fs={21} lh={26} serif as="h2" style={{ whiteSpace: 'nowrap' }}>{satirlar.map((t, i) => <span key={i}>{i ? <br /> : null}{t}</span>)}</Metin>
          <Metin y={P(352 + 134)} fs={12.5} lh={16} renk="ink3" className="tek-satir">{alt}</Metin>
          {dal ? (
            <div role="radiogroup" aria-label={S.soru}>
              {dal.kollar.map((k, i) => (
                <button key={k.deger} type="button" role="radio" aria-checked={secili === k.deger} className={`secenek soru-secenek ${secili === k.deger ? 'secili' : ''}`} style={{ top: P(352 + 152) + i * 76 }} onClick={() => setSec(k.deger)}>
                  <span className="secenek-daire" aria-hidden />
                  <span className="secenek-metin"><b>{k.etiket}</b><small>{k.harf} · {k.sonuc}</small></span>
                </button>
              ))}
            </div>
          ) : (
            <label className="soru-tarih" style={{ top: P(352 + 160) }}>
              <span className="gorunmez">{S.soru}</span>
              <input className="alan" type="date" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </label>
          )}
          <Dugme type="submit" style={{ top: butonY }} mesgul={cevap.isPending} disabled={!hazir} fs={16}>Cevapla</Dugme>
          <Dugme type="button" tur="ikincil" ton="lila" yukseklik={46} fs={14.5} style={{ top: butonY + 64 }} onClick={geri}>Henüz bilmiyorum</Dugme>
          {cevap.isError && <p className="canli-hata" role="alert" style={{ top: butonY + 118 }}>{(cevap.error as Error).message}</p>}
        </form>
      </AltSayfa>
    </>
  );
}
