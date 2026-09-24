import { daysBefore, today, toDateInput } from './format';
import type { Post, PostKind } from './pb';

export type RangePreset = 'all' | '3' | '7' | '30' | 'custom';

export interface MapFilter {
	kinds: PostKind[];
	tracks: boolean;
	range: RangePreset;
	/** Bara för range = 'custom'. ÅÅÅÅ-MM-DD, tomt = öppet. */
	from: string;
	to: string;
}

export const rangePresets: { value: RangePreset; label: string }[] = [
	{ value: 'all', label: 'Allt' },
	{ value: '3', label: '3 dagar' },
	{ value: '7', label: 'Vecka' },
	{ value: '30', label: 'Månad' },
	{ value: 'custom', label: 'Datum…' }
];

export function defaultFilter(): MapFilter {
	return { kinds: ['overnight', 'food', 'sight', 'note'], tracks: true, range: 'all', from: '', to: '' };
}

/** Filtrets datumintervall. "3 dagar" = i dag och de två dagarna före. */
export function filterRange(f: MapFilter): { from: string; to: string } {
	if (f.range === 'all') return { from: '', to: '' };
	if (f.range === 'custom') return { from: f.from, to: f.to };
	return { from: daysBefore(today(), Number(f.range) - 1), to: today() };
}

export function inRange(day: string, r: { from: string; to: string }): boolean {
	const d = toDateInput(day);
	return (!r.from || d >= r.from) && (!r.to || d <= r.to);
}

export function filterPosts<T extends Post>(posts: T[], f: MapFilter): T[] {
	const r = filterRange(f);
	return posts.filter((p) => f.kinds.includes(p.kind) && inRange(p.day, r));
}

/** Antal inlägg per typ inom datumintervallet (för siffrorna på knapparna). */
export function countByKind(posts: Post[], f: MapFilter): Record<PostKind, number> {
	const r = filterRange(f);
	const counts: Record<PostKind, number> = { overnight: 0, food: 0, sight: 0, note: 0 };
	for (const p of posts) if (inRange(p.day, r)) counts[p.kind]++;
	return counts;
}

/** Läser sparat filter (per enhet). Tål att lagringen saknas eller är trasig. */
export function loadFilter(key: string): MapFilter {
	try {
		const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
		if (saved) return { ...defaultFilter(), ...saved };
	} catch {
		// privat läge eller blockerad lagring: använd standard
	}
	return defaultFilter();
}

export function saveFilter(key: string, f: MapFilter) {
	try {
		localStorage.setItem(key, JSON.stringify(f));
	} catch {
		// ignoreras
	}
}
