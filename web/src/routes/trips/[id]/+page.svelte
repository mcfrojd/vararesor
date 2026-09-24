<script lang="ts">
	import { auth } from '$lib/auth.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import { dayNumber, formatDateRange, formatDay, today, tripDays, tripTypes } from '$lib/format';
	import { offline, removeQueued } from '$lib/offline.svelte';
	import { pb, type Post } from '$lib/pb';
	import PostCard from '$lib/PostCard.svelte';
	import MapFilter from '$lib/MapFilter.svelte';
	import { countByKind, defaultFilter, filterPosts, filterRange, inRange } from '$lib/mapFilter';
	import { hasLocation, mapPoints, sortPosts } from '$lib/posts';
	import { loadDorisTracks, type Line } from '$lib/tracks';
	import TripMap from '$lib/TripMap.svelte';

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
				expand: auth.user ? { author: auth.user } : undefined
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
	const days = $derived(tripDays(trip.start_date, trip.end_date, Object.keys(postsByDay)));
	const todayDay = today();

	// Kartan: filter för typ, period och spår. Sparas inte; varje resa börjar med allt.
	let filter = $state(defaultFilter());
	const located = $derived(allPosts.filter((p) => hasLocation(p.location)));
	const points = $derived(mapPoints(filterPosts(located, filter), trip.start_date));
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

<a href="/" class="mb-4 inline-block text-sm text-muted hover:text-ink">← Alla resor</a>

<article class="overflow-hidden rounded-2xl border border-line bg-card">
	{#if trip.cover}
		<img src={pb.files.getURL(trip, trip.cover)} alt="" class="aspect-video w-full object-cover" />
	{/if}
	<div class="space-y-4 p-5">
		<div class="flex items-start justify-between gap-3">
			<div>
				<p class="text-xs font-medium uppercase tracking-wide text-accent">
					{tripTypes[trip.type].icon}
					{tripTypes[trip.type].label}
				</p>
				<h1 class="mt-1 text-2xl font-semibold tracking-tight">{trip.title}</h1>
				<p class="text-sm text-muted">{formatDateRange(trip.start_date, trip.end_date)}</p>
			</div>
			{#if isOwner}
				<a
					href="/trips/{trip.id}/edit"
					class="shrink-0 rounded-full border border-line px-3 py-1 text-sm hover:bg-accent-soft"
				>
					Redigera
				</a>
			{/if}
		</div>

		{#if trip.description}
			<p class="whitespace-pre-line">{trip.description}</p>
		{/if}

		{#if people.length > 0}
			<ul class="flex flex-wrap gap-2">
				{#each people as person (person.id)}
					<li class="flex items-center gap-2 rounded-full bg-paper py-1 pl-1 pr-3 text-sm">
						<Avatar user={person} size="h-7 w-7 text-[10px]" />
						{person.name || person.email}
						{#if person.id === trip.owner}<span class="text-muted">· ägare</span>{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</article>

{#if located.length > 0 || hasTracks}
	<section class="mt-8">
		<h2 class="mb-3 text-xl font-semibold tracking-tight">Karta</h2>
		<div class="mb-3">
			<MapFilter bind:filter {counts} tracksAvailable={hasTracks} />
		</div>
		<TripMap {points} {tracks} connect={tracks.length === 0} />
		{#if points.length === 0 && tracks.length === 0}
			<p class="mt-2 text-sm text-muted">Inget att visa med det här filtret.</p>
		{:else if tracks.length > 0}
			<p class="mt-2 text-xs text-muted">Heldragen linje: Doris körda spår.</p>
		{:else if points.length > 1}
			<p class="mt-2 text-xs text-muted">Streckad linje: ungefärlig rutt mellan inläggen.</p>
		{/if}
	</section>
{/if}

<section class="mt-8">
	<div class="mb-3 flex items-center justify-between">
		<h2 class="text-xl font-semibold tracking-tight">Dagar</h2>
		<a
			href="/trips/{trip.id}/posts/new"
			class="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-paper"
		>
			+ Nytt inlägg
		</a>
	</div>

	{#if days.length === 0}
		<div class="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
			Inga inlägg än. Lägg till ett, eller sätt datum på resan så visas dagarna här.
		</div>
	{:else}
		<ol class="space-y-6">
			{#each days as day (day)}
				{@const n = dayNumber(trip.start_date, day)}
				{@const posts = postsByDay[day] ?? []}
				<li id="dag-{day}" class="scroll-mt-20">
					<div class="mb-2 flex items-baseline justify-between gap-3">
						<h3 class="font-semibold">
							{n ? `Dag ${n}` : 'Före resan'}
							<span class="font-normal text-muted">· {formatDay(day)}</span>
							{#if day === todayDay}
								<span class="ml-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">i dag</span>
							{/if}
						</h3>
						<a href="/trips/{trip.id}/posts/new?day={day}" class="text-sm text-accent hover:underline">
							+ Lägg till
						</a>
					</div>
					{#if posts.length > 0}
						<ul class="space-y-2">
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
					{:else}
						<p class="border-l-2 border-line pl-3 text-sm text-muted">Inget än.</p>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>
