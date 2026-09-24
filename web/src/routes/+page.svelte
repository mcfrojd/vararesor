<script lang="ts">
	import { dayNumber, formatDateRange, today, tripStatus, tripTypes, type TripStatus } from '$lib/format';
	import { pb, type Trip } from '$lib/pb';
	import Fab from '$lib/Fab.svelte';
	import Icon from '$lib/Icon.svelte';
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

	// Plusknappen: nytt inlägg på den pågående resan, annars en ny resa.
	const fab = $derived(
		groups.ongoing.length === 1
			? { href: `/trips/${groups.ongoing[0].id}/posts/new`, label: 'Nytt inlägg' }
			: { href: '/trips/new', label: 'Ny resa' }
	);
</script>

<div class="mb-6 flex items-end justify-between gap-3">
	<h1 class="title text-4xl">Resor</h1>
	<a href="/trips/new" class="btn-small"><Icon name="plus" class="h-4 w-4" />Ny resa</a>
</div>

{#if loading}
	<p class="text-muted">Hämtar…</p>
{:else if error}
	<p class="text-red-600">{error}</p>
{:else if trips.length === 0}
	<div class="card px-6 py-12 text-center">
		<p class="title text-2xl">Inga resor än</p>
		<p class="mt-1 text-muted">Här hamnar era resor när ni lagt till dem.</p>
		<a href="/trips/new" class="btn-primary mt-6">Skapa den första</a>
	</div>
{:else}
	{#if groups.ongoing.length > 0}
		<section class="mb-10 space-y-4">
			<h2 class="label">Pågår nu</h2>
			{#each groups.ongoing as trip (trip.id)}
				<article class="card overflow-hidden">
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
					<div class="flex items-end justify-between gap-3 p-5">
						<a href="/trips/{trip.id}" class="min-w-0">
							<p class="eyebrow">{dayLabel(trip)}</p>
							<h3 class="title mt-1 line-clamp-2 text-2xl leading-tight sm:text-3xl">{trip.title}</h3>
							<p class="mt-0.5 text-sm text-muted">{formatDateRange(trip.start_date, trip.end_date)}</p>
						</a>
						<a href="/trips/{trip.id}/posts/new" class="btn-primary shrink-0 px-4 py-2.5 text-sm">
							<Icon name="plus" class="h-4 w-4" />Inlägg
						</a>
					</div>
				</article>
			{/each}
		</section>
	{/if}

	{#each [{ key: 'upcoming', label: 'Kommande' }, { key: 'past', label: 'Tidigare' }] as const as section (section.key)}
		{#if groups[section.key].length > 0}
			<section class="mb-10">
				<h2 class="label mb-3">{section.label}</h2>
				<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{#each groups[section.key] as trip (trip.id)}
						<li><TripCard {trip} /></li>
					{/each}
				</ul>
			</section>
		{/if}
	{/each}
{/if}

<Fab href={fab.href} label={fab.label} />
