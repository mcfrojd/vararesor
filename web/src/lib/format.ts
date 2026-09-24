import type { TripType } from './pb';

export const tripTypes: Record<TripType, { label: string; icon: string }> = {
	husbil: { label: 'Husbil', icon: '🚐' },
	semester: { label: 'Semester', icon: '🧳' },
	egen: { label: 'Egen resa', icon: '🎒' }
};

const dateFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * PocketBase sparar datum som "2026-08-28 00:00:00.000Z". Vi bryr oss bara om
 * själva dagen, så den läses som lokal dag (annars kan tidszonen flytta den).
 */
function parseDay(value: string): Date {
	const [y, m, d] = value.slice(0, 10).split('-').map(Number);
	return new Date(y, m - 1, d);
}

/** Datum från PocketBase som värde till <input type="date"> (ÅÅÅÅ-MM-DD). */
export function toDateInput(value: string): string {
	return value ? value.slice(0, 10) : '';
}

const dayFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });

/** Dagens datum som ÅÅÅÅ-MM-DD i lokal tid. */
export function today(): string {
	return isoDay(new Date());
}

function isoDay(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Datumet `n` dagar före (negativt: efter) ett ÅÅÅÅ-MM-DD. */
export function daysBefore(value: string, n: number): string {
	const d = parseDay(value);
	d.setDate(d.getDate() - n);
	return isoDay(d);
}

/** "mån 24 aug" */
export function formatDay(value: string): string {
	return dayFmt.format(parseDay(value));
}

/** Resans dagnummer (1 = första dagen), eller 0 om dagen ligger före start. */
export function dayNumber(tripStart: string, day: string): number {
	if (!tripStart) return 0;
	const diff = Math.round((parseDay(day).getTime() - parseDay(tripStart).getTime()) / 86_400_000);
	return diff >= 0 ? diff + 1 : 0;
}

/**
 * Resans dagar (ÅÅÅÅ-MM-DD) i ordning: alla dagar mellan start och slut, plus
 * dagar som har inlägg men ligger utanför. En resa utan slutdatum räknas fram
 * till i dag.
 */
export function tripDays(start: string, end: string, postDays: string[]): string[] {
	const days = new Set(postDays.map(toDateInput));
	if (start) {
		const last = end ? toDateInput(end) : today();
		const d = parseDay(start);
		for (let i = 0; i < 366 && isoDay(d) <= last; i++) {
			days.add(isoDay(d));
			d.setDate(d.getDate() + 1);
		}
	}
	return [...days].sort();
}

/** Förvald dag för ett nytt inlägg: i dag om resan pågår, annars första dagen. */
export function defaultDay(start: string, end: string): string {
	const t = today();
	if (!start) return t;
	const s = toDateInput(start);
	const e = end ? toDateInput(end) : '';
	if (t >= s && (!e || t <= e)) return t;
	return s;
}

export function formatDateRange(start: string, end: string): string {
	if (!start) return '';
	const s = dateFmt.format(parseDay(start));
	if (!end || end.slice(0, 10) === start.slice(0, 10)) return s;
	return `${s} – ${dateFmt.format(parseDay(end))}`;
}
