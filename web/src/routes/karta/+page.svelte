<script lang="ts">
	import { today, tripDays } from '$lib/format';
	import MapFilter from '$lib/MapFilter.svelte';
	import {
		countByKind,
		filterPosts,
		filterRange,
		inRange,
		loadFilter,
		photosInRange,
		saveFilter,
		tripShown
	} from '$lib/mapFilter';
	import { mapPoints, photoPoints } from '$lib/posts';
	import { loadDorisTracks, type Line } from '$lib/tracks';
	import TripMap from '$lib/TripMap.svelte';

	let { data } = $props();

	// Översiktskartans filter sparas på enheten till nästa gång.
	const STORAGE_KEY = 'vararesor:kartfilter';
	let filter = $state(loadFilter(STORAGE_KEY));
	$effect(() => saveFilter(STORAGE_KEY, $state.snapshot(filter)));

	const photosShown = $derived(photosInRange(data.photos, filter));
	const points = $derived([
		...filterPosts(data.posts, filter).flatMap((p) =>
			mapPoints([p], p.expand?.trip?.start_date ?? '', p.expand?.trip?.title ?? '')
		),
		...(filter.photos
			? photoPoints(
					photosShown,
					(ph) => ph.expand?.post,
					(ph) => ph.expand?.trip
				)
			: [])
	]);
	const counts = $derived(countByKind(data.posts, filter));

	// Resorna som har något att visa (inlägg, bilder eller spår), nyast först.
	const tripChoices = $derived(
		data.trips.filter(
			(t) =>
				data.posts.some((p) => p.trip === t.id) ||
				data.photos.some((p) => p.trip === t.id) ||
				data.husbilTrips.some((h) => h.id === t.id)
		)
	);

	// GPS-spår för husbilsresornas dagar inom perioden. Spåren kommer dagen
	// efter, så i dag hoppas över. Högst MAX_TRACK_DAYS dagar (de senaste).
	const MAX_TRACK_DAYS = 60;
	const trackDays = $derived.by(() => {
		const r = filterRange(filter);
		const t = today();
		const days = new Set(
			data.husbilTrips.filter((trip) => tripShown(filter, trip.id)).flatMap((trip) =>
				tripDays(trip.start_date, trip.end_date, []).filter((d) => d < t && inRange(d, r))
			)
		);
		return [...days].sort();
	});
	const tooManyTrackDays = $derived(trackDays.length > MAX_TRACK_DAYS);

	let tracks = $state<Line[]>([]);
	$effect(() => {
		const days = trackDays.slice(-MAX_TRACK_DAYS);
		if (!filter.tracks || days.length === 0) {
			tracks = [];
			return;
		}
		let cancelled = false;
		loadDorisTracks(days).then((byDay) => {
			if (!cancelled) tracks = Object.values(byDay).flat();
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<svelte:head><title>Karta · Våra resor</title></svelte:head>

<h1 class="title mb-5 text-4xl">Där vi varit</h1>

{#if data.posts.length === 0 && data.photos.length === 0 && data.husbilTrips.length === 0}
	<div class="card px-6 py-12 text-center">
		<p class="title text-2xl">Inga platser än</p>
		<p class="mt-1 text-muted">Inlägg med position hamnar här.</p>
	</div>
{:else}
	<div class="mb-4">
		<MapFilter bind:filter {counts} photoCount={photosShown.length} tracksAvailable={data.husbilTrips.length > 0}
			trips={tripChoices}
		/>
	</div>
	<TripMap {points} {tracks} class="h-[65dvh]" />
	{#if filter.tracks && tooManyTrackDays}
		<p class="mt-2 text-xs text-muted">
			GPS-spår visas för de senaste {MAX_TRACK_DAYS} dagarna i perioden. Välj en kortare period för
			att se äldre spår.
		</p>
	{/if}
	{#if points.length === 0 && tracks.length === 0}
		<p class="mt-2 text-sm text-muted">Inget att visa med det här filtret.</p>
	{/if}
{/if}
