<script lang="ts">
	import { pb, type Trip } from '$lib/pb';
	import { formatDateRange, tripTypes } from '$lib/format';

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
</script>

<div class="mb-4 flex items-center justify-between">
	<h1 class="text-2xl font-semibold tracking-tight">Resor</h1>
	<a href="/trips/new" class="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-paper">
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
	<ul class="grid gap-3 sm:grid-cols-2">
		{#each trips as trip (trip.id)}
			<li>
				<a
					href="/trips/{trip.id}"
					class="block overflow-hidden rounded-2xl border border-line bg-card transition hover:border-accent"
				>
					{#if trip.cover}
						<img
							src={pb.files.getURL(trip, trip.cover, { thumb: '640x360' })}
							alt=""
							class="aspect-video w-full object-cover"
						/>
					{/if}
					<div class="p-4">
						<p class="text-xs font-medium uppercase tracking-wide text-accent">
							{tripTypes[trip.type].icon}
							{tripTypes[trip.type].label}
						</p>
						<h2 class="mt-1 text-lg font-semibold">{trip.title}</h2>
						<p class="text-sm text-muted">{formatDateRange(trip.start_date, trip.end_date)}</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
