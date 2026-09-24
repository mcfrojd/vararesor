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
	class="card block h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card"
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
	<div class="p-3.5">
		<p class="text-[10px] font-bold uppercase tracking-wider text-accent">{t.label}</p>
		<h3 class="title mt-0.5 text-xl leading-tight">{trip.title}</h3>
		<p class="text-xs text-muted">
			{formatDateRange(trip.start_date, trip.end_date) || 'Inget datum än'}
			{#if soon}<span class="font-semibold text-rust"> · {soon}</span>{/if}
		</p>
	</div>
</a>
