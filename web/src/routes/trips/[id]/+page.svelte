<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import { dayNumber, formatDateRange, formatDay, today, tripDays, tripTypes } from '$lib/format';
	import { offline, removeQueued } from '$lib/offline.svelte';
	import { pb, type Post } from '$lib/pb';
	import PostCard from '$lib/PostCard.svelte';
	import MapFilter from '$lib/MapFilter.svelte';
	import {
		countByKind,
		defaultFilter,
		filterPosts,
		filterRange,
		inRange,
		photosInRange
	} from '$lib/mapFilter';
	import {
		hasLocation,
		isStay,
		mapPoints,
		nights,
		photoLocation,
		photoPoints,
		sortPosts
	} from '$lib/posts';
	import { loadDorisTracks, type Line } from '$lib/tracks';
	import TripMap from '$lib/TripMap.svelte';
	import { dayWeather, tempRange, weatherInfo } from '$lib/weather';
	import BackLink from '$lib/BackLink.svelte';
	import Fab from '$lib/Fab.svelte';
	import Icon from '$lib/Icon.svelte';
	import PhotoGallery from '$lib/PhotoGallery.svelte';

	let { data } = $props();

	const trip = $derived(data.trip);
	const isOwner = $derived(trip.owner === auth.user?.id);
	const people = $derived([
		...(trip.expand?.owner ? [trip.expand.owner] : []),
		...(trip.expand?.participants ?? [])
	]);

	// Köade inlägg (skapade utan nät) visas med de riktiga tills de skickats.
	const queued = $derived(
		offline.queue.filter((q) => q.data.trip === trip.id && !data.posts.some((p) => p.id === q.id))
	);
	const queuedById = $derived(Object.fromEntries(queued.map((q) => [q.id, q])));
	const allPosts = $derived(
		sortPosts([
			...data.posts,
			...queued.map((q) => ({
				...q.data,
				collectionId: '',
				collectionName: 'posts',
				created: q.queuedAt.replace('T', ' '),
				expand: (auth.user ? { author: auth.user } : undefined) as Post['expand']
			}))
		])
	);

	function removePending(id: string) {
		if (confirm('Ta bort inlägget? Det har inte skickats och finns bara på den här enheten.'))
			void removeQueued(id);
	}

	const postsByDay = $derived(
		allPosts.reduce<Record<string, Post[]>>((acc, post) => {
			(acc[post.day.slice(0, 10)] ??= []).push(post);
			return acc;
		}, {})
	);
	// Bilder som bara hör till dagen (uppladdade och i kön).
	const dayPhotosByDay = $derived(
		data.dayPhotos.reduce<Record<string, typeof data.dayPhotos>>((acc, ph) => {
			(acc[ph.day.slice(0, 10)] ??= []).push(ph);
			return acc;
		}, {})
	);
	const pendingDays = $derived(
		offline.photos.filter((p) => p.trip === trip.id && !p.post).map((p) => p.day)
	);
	const hasDayPhotos = (day: string) => !!dayPhotosByDay[day] || pendingDays.includes(day);
	const days = $derived(
		tripDays(trip.start_date, trip.end_date, [
			...Object.keys(postsByDay),
			...Object.keys(dayPhotosByDay),
			...pendingDays
		])
	);
	const todayDay = today();

	// Boenden över flera nätter visas även på dagarna efter incheckningen.
	const stays = $derived(allPosts.filter((p) => isStay(p) && p.details?.until));
	const staysOn = (day: string) =>
		stays.filter((p) => p.day.slice(0, 10) < day && day <= (p.details?.until ?? ''));

	// Kartan: filter för typ, period och spår. Sparas inte; varje resa börjar med allt.
	let filter = $state(defaultFilter());
	const located = $derived(allPosts.filter((p) => hasLocation(p.location)));
	const postById = $derived(Object.fromEntries(allPosts.map((p) => [p.id, p])));
	const locatedPhotos = $derived(
		[...allPosts.flatMap((p) => p.expand?.photos_via_post ?? []), ...data.dayPhotos]
			.filter((ph) => photoLocation(ph, postById[ph.post]))
	);
	const photosShown = $derived(photosInRange(locatedPhotos, filter));
	const points = $derived([
		...mapPoints(filterPosts(located, filter), trip.start_date),
		...(filter.photos ? photoPoints(photosShown, (ph) => postById[ph.post], () => trip) : [])
	]);
	const counts = $derived(countByKind(located, filter));

	// Husbilsresor: hämta Doris körda spår för alla dagar som varit, en gång.
	let tracksByDay = $state<Record<string, Line[]>>({});
	$effect(() => {
		tracksByDay = {};
		if (trip.type !== 'husbil') return;
		let cancelled = false;
		loadDorisTracks(days.filter((d) => d < todayDay)).then((t) => {
			if (!cancelled) tracksByDay = t;
		});
		return () => {
			cancelled = true;
		};
	});
	const hasTracks = $derived(Object.values(tracksByDay).some((l) => l.length > 0));
	const tracks = $derived.by(() => {
		if (!filter.tracks) return [];
		const r = filterRange(filter);
		return Object.entries(tracksByDay)
			.filter(([day]) => inRange(day, r))
			.flatMap(([, lines]) => lines);
	});
</script>

<svelte:head><title>{trip.title} · Våra resor</title></svelte:head>

<BackLink href="/" label="Alla resor" />

<article class="card overflow-hidden">
	{#if trip.cover}
		<img src={pb.files.getURL(trip, trip.cover)} alt="" class="aspect-video w-full object-cover" />
	{/if}
	<div class="space-y-4 p-5 sm:p-6">
		<div>
			<div class="flex min-h-8 items-center justify-between gap-3">
				<p class="eyebrow">{tripTypes[trip.type].icon} {tripTypes[trip.type].label}</p>
				{#if isOwner}
					<a href="/trips/{trip.id}/edit" class="btn-small shrink-0">
						<Icon name="pencil" class="h-3.5 w-3.5" />Redigera
					</a>
				{/if}
			</div>
			<h1 class="title mt-1 text-4xl leading-tight">{trip.title}</h1>
			<p class="mt-1 text-sm text-muted">{formatDateRange(trip.start_date, trip.end_date)}</p>
		</div>

		{#if trip.description}
			<p class="whitespace-pre-line leading-relaxed">{trip.description}</p>
		{/if}

		{#if people.length > 0}
			<ul class="flex flex-wrap gap-2">
				{#each people as person (person.id)}
					<li class="flex items-center gap-2 rounded-full bg-field py-1 pl-1 pr-3 text-sm text-ink">
						<Avatar user={person} size="h-7 w-7 text-[10px]" />
						{person.name || person.email}
						{#if person.id === trip.owner}<span class="text-muted">· ägare</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</article>

{#if located.length > 0 || locatedPhotos.length > 0 || hasTracks}
	<section class="mt-10">
		<h2 class="title mb-3 text-3xl">Karta</h2>
		<div class="mb-3">
			<MapFilter
				bind:filter
				{counts}
				photoCount={photosShown.length}
				tracksAvailable={hasTracks}
				{days}
				tripStart={trip.start_date}
			/>
		</div>
		<TripMap {points} {tracks} connect={tracks.length === 0} />
		{#if points.length === 0 && tracks.length === 0}
			<p class="mt-2 text-sm text-muted">Inget att visa med det här filtret.</p>
		{:else if tracks.length > 0}
			<p class="mt-2 text-xs text-muted">Heldragen linje: Doris körda spår.</p>
		{:else if points.filter((p) => p.kind !== 'photo').length > 1}
			<p class="mt-2 text-xs text-muted">Streckad linje: ungefärlig rutt mellan inläggen.</p>
		{/if}
	</section>
{/if}

<section class="mt-10">
	<div class="mb-4 flex items-center justify-between gap-3">
		<h2 class="title text-3xl">Dagar</h2>
		<a href="/trips/{trip.id}/photos" class="btn-small shrink-0">
			<Icon name="image" class="h-4 w-4" />Lägg till bilder
		</a>
	</div>

	{#if days.length === 0}
		<div class="card px-6 py-10 text-center text-muted">
			Inga inlägg än. Tryck på plusknappen, eller sätt datum på resan så visas dagarna här.
		</div>
	{:else}
		<ol class="space-y-8">
			{#each days as day (day)}
				{@const n = dayNumber(trip.start_date, day)}
				{@const posts = postsByDay[day] ?? []}
				{@const w = dayWeather(posts)}
				<li id="dag-{day}" class="scroll-mt-24">
					<div class="mb-3 flex items-baseline justify-between gap-3">
						<h3 class="flex flex-wrap items-baseline gap-x-2">
							<span class="title text-2xl">{n ? `Dag ${n}` : 'Före resan'}</span>
							<span class="text-sm text-muted">{formatDay(day)}</span>
							{#if w}
								<span class="text-sm text-muted" title={weatherInfo(w.code).label}>
									· {weatherInfo(w.code).icon} {tempRange(w)}
								</span>
							{/if}
							{#if day === todayDay}
								<span class="rounded-full bg-rust-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rust">
									I dag
								</span>
							{/if}
						</h3>
						<a
							href="/trips/{trip.id}/posts/new?day={day}"
							class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-rust hover:underline"
						>
							<Icon name="plus" class="h-4 w-4" />Lägg till
						</a>
					</div>
					{#each staysOn(day) as s (s.id)}
						<a
							href="/trips/{trip.id}/posts/{s.id}"
							class="mb-3 flex items-center gap-2 rounded-2xl bg-field px-3.5 py-2 text-sm text-muted transition hover:text-ink"
						>
							<span aria-hidden="true">🏨</span>
							<span>
								{day === s.details?.until ? 'Utcheckning' : `Natt ${dayNumber(s.day, day)} av ${nights(s)}`} ·
								<span class="font-semibold text-ink">{s.title || 'Boende'}</span>
							</span>
						</a>
					{/each}
					{#if posts.length > 0}
						<ul class="space-y-3">
							{#each posts as post (post.id)}
								{@const q = queuedById[post.id]}
								<li>
									{#if q}
										<PostCard {post} pending error={q.error} onremove={() => removePending(post.id)} />
									{:else}
										<PostCard {post} />
									{/if}
								</li>
							{/each}
						</ul>
					{:else if !hasDayPhotos(day)}
						<p class="rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-muted">
							Inget än.
						</p>
					{/if}
					{#if hasDayPhotos(day)}
						<div class="card mt-3 p-3">
							<p class="label mb-2">📷 Dagens bilder</p>
							<PhotoGallery
								compact
								photos={dayPhotosByDay[day] ?? []}
								pending={(p) => p.trip === trip.id && !p.post && p.day === day}
							/>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<Fab href="/trips/{trip.id}/posts/new" label="Nytt inlägg" />
