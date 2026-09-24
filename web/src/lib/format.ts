import type { TripType } from './pb';

export const tripTypes: Record<TripType, { label: string; icon: string }> = {
	husbil: { label: 'Husbil', icon: '🚐' },
	semester: { label: 'Semester', icon: '🧳' },
	egen: { label: 'Egen resa', icon: '🎒' }
};

const dateFmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

export function formatDateRange(start: string, end: string): string {
	if (!start) return '';
	const s = dateFmt.format(new Date(start));
	if (!end) return s;
	return `${s} – ${dateFmt.format(new Date(end))}`;
}
