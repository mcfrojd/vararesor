import type { GeoPoint } from './pb';

/**
 * Pluskoder (Open Location Code), som Google Maps visar för platser utan
 * gatuadress, t.ex. "8G6XX3V9+H4" eller kort "X3V9+H4 Paralimni, Cypern".
 * Specifikation: https://github.com/google/open-location-code (Apache 2.0).
 * En hel kod avkodas direkt; en kort kod behöver en ort i närheten som
 * referens (slås upp av servern, se lookupPlace).
 */

const ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;
const PAIR_RESOLUTIONS = [20, 1, 0.05, 0.0025, 0.000125];
const GRID_COLUMNS = 4;
const GRID_ROWS = 5;

/** En pluskod i texten: själva koden och resten (t.ex. orten). */
export interface PlusCode {
	code: string;
	/** Orten efter en kort kod, t.ex. "Paralimni, Cypern". Tom för hela koder. */
	place: string;
	full: boolean;
}

const CODE = /^\s*([23456789CFGHJMPQRVWX0]{2,8}\+[23456789CFGHJMPQRVWX]*)\s*,?\s*(.*)$/i;

/** Hittar en pluskod först i texten, eller null. */
export function parsePlusCode(text: string): PlusCode | null {
	const m = text.match(CODE);
	if (!m) return null;
	const code = m[1].toUpperCase();
	if (!isValid(code)) return null;
	return { code, place: m[2].trim(), full: code.indexOf(SEPARATOR) === SEPARATOR_POSITION };
}

function isValid(code: string): boolean {
	const sep = code.indexOf(SEPARATOR);
	if (sep < 0 || sep !== code.lastIndexOf(SEPARATOR) || sep > SEPARATOR_POSITION || sep % 2 === 1) return false;
	if (code.length - sep - 1 === 1) return false; // en ensam siffra efter + är inte giltig
	const pad = code.indexOf('0');
	if (pad >= 0) {
		if (sep < SEPARATOR_POSITION || pad === 0) return false;
		if (!/^[^0]*0+\+$/.test(code)) return false;
	}
	return [...code.replace(SEPARATOR, '').replace(/0+$/, '')].every((c) => ALPHABET.includes(c));
}

/** Mitten av en hel kod. */
export function decodeFull(code: string): GeoPoint {
	const digits = code.replace(SEPARATOR, '').replace(/0+$/, '');
	let lat = -90;
	let lon = -180;
	let latRes = 0;
	let lonRes = 0;
	const pairs = Math.min(digits.length, 10);
	for (let i = 0; i < pairs; i += 2) {
		latRes = lonRes = PAIR_RESOLUTIONS[i / 2];
		lat += ALPHABET.indexOf(digits[i]) * latRes;
		if (i + 1 < pairs) lon += ALPHABET.indexOf(digits[i + 1]) * lonRes;
	}
	for (let i = 10; i < digits.length; i++) {
		latRes /= GRID_ROWS;
		lonRes /= GRID_COLUMNS;
		const v = ALPHABET.indexOf(digits[i]);
		lat += Math.floor(v / GRID_COLUMNS) * latRes;
		lon += (v % GRID_COLUMNS) * lonRes;
	}
	return { lat: round(lat + latRes / 2), lon: round(lon + lonRes / 2) };
}

/** De första `length` tecknen (hela par) av koden för en plats. */
function encodePairs(point: GeoPoint, length: number): string {
	let lat = Math.min(Math.max(point.lat, -90), 90) + 90;
	let lon = ((((point.lon + 180) % 360) + 360) % 360);
	if (lat >= 180) lat = 180 - PAIR_RESOLUTIONS[4] / 2;
	let out = '';
	for (let i = 0; i < length / 2; i++) {
		const res = PAIR_RESOLUTIONS[i];
		const dLat = Math.floor(lat / res);
		const dLon = Math.floor(lon / res);
		lat -= dLat * res;
		lon -= dLon * res;
		out += ALPHABET[dLat] + ALPHABET[dLon];
	}
	return out;
}

/** En kort kod gjord hel med hjälp av en plats i närheten (samma regel som Googles recoverNearest). */
export function recoverNearest(short: string, reference: GeoPoint): GeoPoint {
	const padding = SEPARATOR_POSITION - short.indexOf(SEPARATOR);
	const resolution = Math.pow(20, 2 - padding / 2);
	const half = resolution / 2;
	const area = decodeFull(encodePairs(reference, padding) + short);
	let { lat, lon } = area;
	if (reference.lat + half < lat && lat - resolution >= -90) lat -= resolution;
	else if (reference.lat - half > lat && lat + resolution <= 90) lat += resolution;
	if (reference.lon + half < lon) lon -= resolution;
	else if (reference.lon - half > lon) lon += resolution;
	return { lat: round(lat), lon: round(lon) };
}

function round(n: number): number {
	return Math.round(n * 1e6) / 1e6;
}
