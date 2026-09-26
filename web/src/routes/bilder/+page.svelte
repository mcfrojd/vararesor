<script lang="ts">
	import { formatDateRange, tripTypes } from '$lib/format';
	import Icon from '$lib/Icon.svelte';
	import { offline } from '$lib/offline.svelte';
	import { pb, type Photo, type Trip } from '$lib/pb';
	import { photoUrl } from '$lib/photos';
	import type { PhotoSummary } from './+page';

	let { data } = $props();

	interface Album {
		id: string;
		title: string;
		sub: string;
		cover: string;
		count: number;
		trip?: Trip;
	}

	// Ett album per resa med bilder (nyast först) och sist de okategoriserade.
	const albums = $derived.by(() => {
		const byTrip = new Map<string, PhotoSummary[]>();
		for (const p of data.photos) byTrip.set(p.trip, [...(byTrip.get(p.trip) ?? []), p]);
		const queued = (trip: string) => offline.photos.filter((p) => p.trip === trip && !data.photos.some((x) => x.id === p.id));
		const list: Album[] = [];
		for (const trip of data.trips) {
			const photos = byTrip.get(trip.id) ?? [];
			const waiting = queued(trip.id);
			if (photos.length + waiting.length === 0) continue;
			list.push({
				id: trip.id,
				title: trip.title,
				sub: formatDateRange(trip.start_date, trip.end_date) || tripTypes[trip.type].label,
				cover: trip.cover
					? pb.files.getURL(trip, trip.cover, { thumb: '640x360' })
					: photos[0]
						? photoUrl(photos[0] as Photo, 'thumb')
						: waiting[0].thumbUrl,
				count: photos.length + waiting.length,
				trip
			});
		}
		const loose = byTrip.get('') ?? [];
		const looseWaiting = queued('');
		if (loose.length + looseWaiting.length > 0)
			list.push({
				id: 'okategoriserat',
				title: 'Okategoriserat',
				sub: 'Passar ingen resa än',
				cover: loose[0] ? photoUrl(loose[0] as Photo, 'thumb') : looseWaiting[0].thumbUrl,
				count: loose.length + looseWaiting.length
			});
		return list;
	});
</script>

<svelte:head><title>Bilder · Våra resor</title></svelte:head>

<div class="mb-6 flex items-end justify-between gap-3">
	<h1 class="title text-4xl">Bilder</h1>
	<a href="/bilder/ladda-upp" class="btn-small"><Icon name="plus" class="h-4 w-4" />Ladda upp</a>
</div>

{#if albums.length === 0}
	<div class="card px-6 py-12 text-center">
		<p class="title text-2xl">Inga bilder än</p>
		<p class="mt-1 text-muted">Bilderna sorteras till rätt resa efter när de togs.</p>
		<a href="/bilder/ladda-upp" class="btn-primary mt-6">Ladda upp bilder</a>
	</div>
{:else}
	<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
		{#each albums as a (a.id)}
			<li>
				<a
					href="/bilder/{a.id}"
					class="card block h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card"
				>
					<div class="relative">
						<img src={a.cover} alt="" loading="lazy" class="aspect-square w-full object-cover" />
						<span
							class="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white"
						>
							<Icon name="image" class="h-3.5 w-3.5" />{a.count}
						</span>
					</div>
					<div class="p-3">
						<h2 class="title truncate text-lg leading-tight">{a.title}</h2>
						<p class="truncate text-xs text-muted">{a.sub}</p>
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
