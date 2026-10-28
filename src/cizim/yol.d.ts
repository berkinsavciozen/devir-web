// yol.js için tür bildirimleri (çizim parçaları SVG dizgesi döner).
import type { Galaksi } from '../geometri/galaksi-geometri';
type O = Record<string, any>;
export interface Model { F: { kod: string; baslik: string; kapandi: number | null; steps: { no: number; ad: string; sahip: string; tip?: string; durum: string; dep: number[]; karar: boolean }[] }; AK: any; sahip?: string; detay: any }
export interface YolSonuc { svg: string; G: Galaksi; P: Record<number, [number, number]>; radOf: (no: number) => number; stOf: (no: number) => string; clusters?: number[][]; secim?: string; RENK: Record<string, string>; gemiler?: { ad: string; tip: string; x: number; y: number; sc: number }[]; ikonlar?: { tur: 'bayrak' | 'bulut'; no: number; x: number; y: number }[]; uydular?: { no: number; ust: number; x: number; y: number; r: number }[] }
export const GUN: number;
export function tl(ms: number): Date;
export function gunAy(ms: number): string;
export function gunAyHafta(ms: number): string;
export function saat(ms: number): string;
export function sans(x: number, y: number, t: string, o?: O): string;
export function kart(x: number, y: number, w: number, h: number, o?: O): string;
export function akisModeli(detay: any, o?: { sahip?: string; haric?: number[] }): Model;
export function uyeRenkleri(G: Galaksi, sahip?: string, ajanSahibi?: Record<string, string>): Record<string, string>;
export function ajanSahipleri(steps: { sahip: string; tip?: string; agentSahibi?: string | null }[]): Record<string, string>;
export function kisaAd(ad: string): string;
export function tac(x: number, y: number, r: number, k: number): string;
export function elmas(x: number, y: number, s?: number): string;
export function belge(x: number, y: number, s?: number): string;
export function uyduSistemi(x: number, y: number, r: number, ks: { ad: string; durum: string; t?: number; kalem?: boolean; no?: number }[], ps?: number, o?: { yakin?: boolean; adlar?: boolean; ini?: boolean; bosluk?: number; yerler?: { no: number; ust: number; x: number; y: number; r: number }[]; ust?: number; hedef?: boolean }): string;
export const UYE_PALET: string[];
export const TAKIM_RENGI: string;
export function yolD(pts: number[][]): string;
export function clusterBadge(x: number, y: number, members: number[], radOf: (no: number) => number, stOf: (no: number) => [string, O], ps?: number): string;
export function uydular(x: number, y: number, r: number, kalemler: { ad: string; durum: string }[], ps?: number, o?: O): string;
export function yolCiz(M: Model, o?: O): YolSonuc;
export function zamanCubugu(x: number, y: number, w: number, G: Galaksi, X: number, o?: O): { svg: string; xOf: (t: number) => number; tOf: (px: number) => number; x0: number; x1: number; t0: number; t1: number };
