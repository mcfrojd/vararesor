<script lang="ts">
	import { daysUntil, formatDateRange, tripTypes } from './format';
	import { pb, type Trip } from './pb';

	let { trip, note = '' }: { trip: Trip; note?: string } = $props();

	const t = $derived(tripTypes[trip.type]);
	const soon = $derived.by(() => {
		if (note || !trip.start_date) return note;
		const n = daysUntil(trip.start_date);
		if (n === 1) return 'I morgon';
		if (n > 1 && n <= 60) return `Om ${n} dagar`;
		return '';
	});
</script>

<a
	href="/trips/{trip.id}"
	class="block overflow-hidden rounded-2xl border border-line bg-card transition hover:border-accent"
>
	{#if trip.cover}
		<img
			src={pb.files.getURL(trip, trip.cover, { thumb: '640x360' })}
			alt=""
			loading="lazy"
			class="aspect-video w-full object-cover"
		/>
	{:else}
		<!-- Utan omslagsbild: färgad yta med resetypens ikon, så att rutnätet blir jämnt. -->
		<div class="flex aspect-video w-full items-center justify-center text-4xl cover-{trip.type}">
			{t.icon}
		</div>
	{/if}
	<div class="p-3">
		<p class="text-[11px] font-medium uppercase tracking-wide text-accent">{t.icon} {t.label}</p>
		<h3 class="mt-0.5 font-semibold leading-snug">{trip.title}</h3>
		<p class="text-xs text-muted">
			{formatDateRange(trip.start_date, trip.end_date) || 'Inget datum än'}
			{#if soon}<span class="text-accent"> · {soon}</span>{/if}
		</p>
	</div>
</a>
