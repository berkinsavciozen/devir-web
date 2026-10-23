import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/istemci';
import { simdi } from '../../api/ortam';
import type { Ben } from '../../api/turler';
import { Baslik } from '../../bilesen/Baslik';
import { Kutu, Metin, Sahne } from '../../bilesen/Sahne';
import { gunAy } from '../../cizim/yol.js';
import { akisAdi } from '../../metin/turkce';
import { git } from '../../yonlendirme';
import { SatirKart } from '../hesap/Hesap';
import { kucukGalaksi, useDetaylar } from './Evren';
import { akisIlerlemesi, ilerlemeMetni } from '../../api/ilerleme';

const tarihMs = (t: string) => Date.parse(t.length === 10 ? t + 'T12:00:00+03:00' : t);

/** Arşiv: kapanan ve arşivlenen akışlar, en yeni önce (B2 "Arşiv", J1 "N kapandı"). Tasarımda ayrı ekranı yok; K satır kartıyla. */
export function Arsiv({ ben }: { ben: Ben }) {
  const q = useQuery({ queryKey: ['akislar', 'hepsi'], queryFn: () => api.get<any>('/akislar?durum=hepsi') });
  const NOW = simdi(), kisi = ben.kisi || '';
  const L: any[] = (q.data?.akislar || []).filter((k: any) => k.durum !== 'aktif')
    .sort((a: any, b: any) => Number(a.durum === 'arsiv') - Number(b.durum === 'arsiv') || tarihMs(b.kapandi_at || b.son_hareket) - tarihMs(a.kapandi_at || a.son_hareket));
  const detay = useDetaylar(L.slice(0, 12).map((k) => k.kod));
  const kap = L.filter((k) => k.durum === 'kapandi').length, ars = L.length - kap;
  const cumle = !q.data ? '' : L.length ? [kap ? `${kap} akış kapandı` : '', ars ? `${ars} akış arşivde` : ''].filter(Boolean).join('; ') + '.' : 'Henüz kapanan akış yok.';
  const geri = () => (history.length > 1 ? history.back() : git('/akislar'));
  return (
    <Sahne gok={{ tohum: 17, yildiz: 200 }} etiket="Arşiv" yukseklik={160 + L.length * 74 + 40}>
      <Kutu x={0} y={40} style={{ right: 0 }}><Baslik baslik="Arşiv" geri={geri} /></Kutu>
      {cumle && <Metin y={110} fs={17.5} lh={22} serif as="p" className="tek-satir">{cumle}</Metin>}
      <div role="list" aria-label="Kapanan akışlar">
        {L.map((k, i) => {
          const d = detay[k.kod];
          const n = ilerlemeMetni(akisIlerlemesi(k, d));
          const ne = k.durum === 'kapandi' ? `kapandı ${gunAy(tarihMs(k.kapandi_at || k.son_hareket))}` : 'arşivde';
          return <div role="listitem" key={k.kod}><SatirKart y={150 + i * 74} h={66} ikon={`<g opacity="${k.durum === 'kapandi' ? 1 : .55}">${kucukGalaksi(d, kisi, 26, 33, 17, 1.6, NOW)}</g>`} ust={akisAdi(k)} alt={`${ne} · ${n}`} onClick={() => git(`/akis/${encodeURIComponent(k.kod)}`)} /></div>;
        })}
      </div>
    </Sahne>
  );
}
