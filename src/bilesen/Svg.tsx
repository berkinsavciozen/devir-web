import { memo, type SVGProps } from 'react';
import { defs } from '../cizim/ortak.js';

/** Çizim parçasının ürettiği SVG dizgesini bir <g> içine koyar. */
export const Cizim = memo(function Cizim({ html, ...p }: { html: string } & SVGProps<SVGGElement>) {
  return <g {...p} dangerouslySetInnerHTML={{ __html: html }} />;
});

/** Bütün degrade ve filtre tanımları belgede bir kez durur; her SVG url(#…) ile kullanır. */
export const SvgTanimlar = memo(function SvgTanimlar() {
  return <svg aria-hidden width="0" height="0" style={{ position: 'absolute' }} dangerouslySetInnerHTML={{ __html: defs() }} />;
});

/** Merkezi 0,0 olan küçük çizimi (ikon) satır içi SVG olarak koyar. */
export const Ikon = memo(function Ikon({ svg, w = 24, h = w }: { svg: string; w?: number; h?: number }) {
  return <svg aria-hidden width={w} height={h} viewBox={`${-w / 2} ${-h / 2} ${w} ${h}`} style={{ overflow: 'visible', display: 'block' }} dangerouslySetInnerHTML={{ __html: svg }} />;
});
