<script lang="ts">
	import { dayNumber, formatDateRange, today, tripStatus, tripTypes, type TripStatus } from '$lib/format';
	import { pb, type Trip } from '$lib/pb';
	import TripCard from '$lib/TripCard.svelte';

	let trips = $state<Trip[]>([]);
	let loading = $state(true);
	let error = $state('');

	$effect(() => {
		pb.collection('trips')
			.getFullList<Trip>({ sort: '-start_date' })
			.then((list) => (trips = list))
			.catch(() => (error = 'Kunde inte hämta resorna.'))
			.finally(() => (loading = false));
	});

	const groups = $derived.by(() => {
		const g: Record<TripStatus, Trip[]> = { ongoing: [], upcoming: [], past: [] };
		for (const trip of trips) g[tripStatus(trip.start_date, trip.end_date)].push(trip);
		// Kommande: närmast först, planer utan datum sist. Tidigare: senaste först.
		g.upcoming.sort((a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999'));
		return g;
	});

	function dayLabel(trip: Trip): string {
		const n = dayNumber(trip.start_date, today());
		const total = trip.end_date ? dayNumber(trip.start_date, trip.end_date) : 0;
		return total ? `Dag ${n} av ${total}` : `Dag ${n}`;
	}
</script>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-2xl font-semibold tracking-tight">Resor</h1>
	<a href="/trips/new" class="rounded-full border border-line px-4 py-1.5 text-sm font-medium hover:bg-accent-soft">
		+ Ny resa
	</a>
</div>

{#if loading}
	<p class="text-muted">Hämtar…</p>
{:else if error}
	<p class="text-red-600">{error}</p>
{:else if trips.length === 0}
	<div class="rounded-2xl border border-dashed border-line p-10 text-center">
		<p class="text-4xl">🗺️</p>
		<p class="mt-2 font-medium">Inga resor än</p>
		<p class="text-sm text-muted">Här hamnar era resor när ni lagt till dem.</p>
		<a href="/trips/new" class="mt-4 inline-block text-sm font-medium text-accent hover:underline">
			Skapa den första
		</a>
	</div>
{:else}
	{#if groups.ongoing.length > 0}
		<section class="mb-8 space-y-4">
			<h2 class="text-sm font-medium uppercase tracking-wide text-muted">Pågår nu</h2>
			{#each groups.ongoing as trip (trip.id)}
				<article class="overflow-hidden rounded-2xl border border-line bg-card">
					<a href="/trips/{trip.id}" class="block">
						{#if trip.cover}
							<img
								src={pb.files.getURL(trip, trip.cover)}
								alt=""
								class="aspect-[16/9] w-full object-cover sm:aspect-[21/9]"
							/>
						{:else}
							<div
								class="flex aspect-[16/9] w-full items-center justify-center text-7xl sm:aspect-[21/9] cover-{trip.type}"
							>
								{tripTypes[trip.type].icon}
							</div>
						{/if}
					</a>
					<div class="flex items-end justify-between gap-3 p-4">
						<a href="/trips/{trip.id}" class="min-w-0">
							<p class="text-xs font-medium uppercase tracking-wide text-accent">{dayLabel(trip)}</p>
							<h3 class="truncate text-xl font-semibold tracking-tight">{trip.title}</h3>
							<p class="text-sm text-muted">{formatDateRange(trip.start_date, trip.end_date)}</p>
						</a>
						<a
							href="/trips/{trip.id}/posts/new"
							class="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-medium text-paper"
						>
							+ Inlägg
						</a>
					</div>
				</article>
			{/each}
		</section>
	{/if}

	{#each [{ key: 'upcoming', label: 'Kommande' }, { key: 'past', label: 'Tidigare' }] as const as section (section.key)}
		{#if groups[section.key].length > 0}
			<section class="mb-8">
				<h2 class="mb-3 text-sm font-medium uppercase tracking-wide text-muted">{section.label}</h2>
				<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{#each groups[section.key] as trip (trip.id)}
						<li><TripCard {trip} /></li>
					{/each}
				</ul>
			</section>
		{/if}
	{/each}
{/if}
