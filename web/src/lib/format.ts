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

export function formatDateRange(start: string, end: string): string {
	if (!start) return '';
	const s = dateFmt.format(parseDay(start));
	if (!end || end.slice(0, 10) === start.slice(0, 10)) return s;
	return `${s} – ${dateFmt.format(parseDay(end))}`;
}
