import type { GeoPoint, PostKind } from './pb';

export interface KindConfig {
	label: string;
	icon: string;
	/** Rubrik för namnfältet, t.ex. "Namn på ställplatsen". */
	titleLabel: string;
	categories: string[];
	priceLabel?: string;
	rated: boolean;
	located: boolean;
	bodyLabel: string;
}

export const postKinds: Record<PostKind, KindConfig> = {
	overnight: {
		label: 'Övernattning',
		icon: '🏕️',
		titleLabel: 'Namn',
		categories: ['Ställplats', 'Camping', 'Fricamping'],
		priceLabel: 'Pris per natt',
		rated: true,
		located: true,
		bodyLabel: 'Anteckning'
	},
	food: {
		label: 'Mat och dryck',
		icon: '🍽️',
		titleLabel: 'Namn på stället',
		categories: ['Restaurang', 'Café', 'Bar', 'Bryggeri', 'Vingård', 'Glass', 'Annat'],
		priceLabel: 'Ungefärligt pris',
		rated: true,
		located: true,
		bodyLabel: 'Anteckning'
	},
	sight: {
		label: 'Sevärdhet och nöje',
		icon: '🏛️',
		titleLabel: 'Namn',
		categories: ['Natur', 'Museum', 'Stad', 'Aktivitet', 'Annat'],
		priceLabel: 'Entré/pris',
		rated: true,
		located: true,
		bodyLabel: 'Anteckning'
	},
	note: {
		label: 'Anteckning',
		icon: '📝',
		titleLabel: 'Rubrik',
		categories: [],
		rated: false,
		located: true,
		bodyLabel: 'Text'
	}
};

export const facilities = ['El', 'Vatten', 'Gråvattentömning', 'Toatömning', 'Toalett', 'Dusch', 'WiFi'];
export const noiseLevels = ['Lugnt', 'Visst ljud', 'Högljutt'];

/** PocketBase lagrar en tom position som 0,0. */
export function hasLocation(p: GeoPoint | null | undefined): p is GeoPoint {
	return !!p && (p.lat !== 0 || p.lon !== 0);
}

export function formatLocation(p: GeoPoint): string {
	return `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
}

/** Läser "52.52, 13.405" (t.ex. kopierat från en kartapp). */
export function parseLocation(text: string): GeoPoint | null {
	const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
	if (!m) return null;
	const lat = Number(m[1]);
	const lon = Number(m[2]);
	if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
	return { lat, lon };
}

export function mapUrl(p: GeoPoint): string {
	return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=16/${p.lat}/${p.lon}`;
}
