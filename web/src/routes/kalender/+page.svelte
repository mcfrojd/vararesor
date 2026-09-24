<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/Icon.svelte';
	import {
		addMonths,
		calendarDays,
		dayNumber,
		formatLongDay,
		formatMonth,
		today,
		toDateInput,
		tripDays,
		tripTypes
	} from '$lib/format';
	import type { Post, Trip } from '$lib/pb';
	import PostCard from '$lib/PostCard.svelte';
	import { postKinds } from '$lib/posts';
	import { dayWeather, weatherInfo } from '$lib/weather';
	import WeatherPill from '$lib/WeatherPill.svelte';

	let { data } = $props();

	const todayDay = today();
	const weekdays = ['mån', 'tis', 'ons', 'tor', 'fre', 'lör', 'sön'];

	// Vald dag och månad ligger i adressen (?d=…&m=…), så att Tillbaka fungerar.
	const selected = $derived(page.url.searchParams.get('d') || todayDay);
	const month = $derived(page.url.searchParams.get('m') || selected.slice(0, 7));
	const days = $derived(calendarDays(month));

	function show(d: string, m = d.slice(0, 7)) {
		const url = new URL(page.url);
		url.searchParams.set('d', d);
		url.searchParams.set('m', m);
		goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	const postsByDay = $derived(
		data.posts.reduce<Record<string, Post[]>>((acc, p) => {
			(acc[p.day.slice(0, 10)] ??= []).push(p);
			return acc;
		}, {})
	);

	// Vilka resor som pågår vilken dag.
	const tripsByDay = $derived.by(() => {
		const map: Record<string, Trip[]> = {};
		for (const trip of data.trips) {
			if (!trip.start_date) continue;
			const end = trip.end_date || (toDateInput(trip.start_date) > todayDay ? trip.start_date : todayDay);
			for (const d of tripDays(trip.start_date, end, [])) (map[d] ??= []).push(trip);
		}
		return map;
	});
	const tripById = $derived(Object.fromEntries(data.trips.map((t) => [t.id, t])));

	const selectedPosts = $derived(postsByDay[selected] ?? []);
	const selectedTrips = $derived(tripsByDay[selected] ?? []);
	const selectedWeather = $derived(dayWeather(selectedPosts));

	/** Små ikoner för dagens inlägg: en per typ, högst tre. */
	function kindIcons(posts: Post[]): string[] {
		return [...new Set(posts.map((p) => postKinds[p.kind].icon))].slice(0, 3);
	}
</script>

<svelte:head><title>Kalender · Våra resor</title></svelte:head>

<h1 class="title mb-5 text-4xl">Kalender</h1>

<section class="card p-3 sm:p-5">
	<div class="mb-3 flex items-center justify-between gap-2 px-1">
		<button
			type="button"
			onclick={() => show(selected, addMonths(month, -1))}
			aria-label="Föregående månad"
			class="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition hover:border-rust/30"
		>
			<Icon name="back" class="h-4 w-4" />
		</button>
		<h2 class="title text-2xl">{formatMonth(month)}</h2>
		<div class="flex items-center gap-2">
			{#if month !== todayDay.slice(0, 7) || selected !== todayDay}
				<button type="button" onclick={() => show(todayDay)} class="btn-small py-1 text-xs">
					I dag
				</button>
			{/if}
			<button
				type="button"
				onclick={() => show(selected, addMonths(month, 1))}
				aria-label="Nästa månad"
				class="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink transition hover:border-rust/30"
			>
				<Icon name="back" class="h-4 w-4 rotate-180" />
			</button>
		</div>
	</div>

	<div class="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={formatMonth(month)}>
		{#each weekdays as w (w)}
			<div class="pb-1 text-[10px] font-bold uppercase tracking-wider text-muted" role="columnheader">
				{w}
			</div>
		{/each}
		{#each days as d (d)}
			{@const posts = postsByDay[d] ?? []}
			{@const trips = tripsByDay[d] ?? []}
			{@const w = dayWeather(posts)}
			{@const inMonth = d.slice(0, 7) === month}
			{@const isSelected = d === selected}
			<button
				type="button"
				role="gridcell"
				aria-selected={isSelected}
				aria-label="{formatLongDay(d)}{posts.length ? `, ${posts.length} inlägg` : ''}"
				onclick={() => show(d, month)}
				class="relative flex h-14 flex-col items-center rounded-xl pt-1.5 transition sm:h-16
					{isSelected
					? 'bg-rust-soft text-rust'
					: trips.length
						? 'bg-accent-soft text-ink hover:brightness-95'
						: 'text-ink hover:bg-field'}
					{inMonth ? '' : 'opacity-35'}
					{d === todayDay && !isSelected ? 'ring-2 ring-rust/50 ring-inset' : ''}"
			>
				<span class="text-sm {posts.length || d === todayDay ? 'font-bold' : ''}">
					{Number(d.slice(8))}
				</span>
				{#if w}
					<span class="absolute right-1 top-0.5 text-[10px]" aria-hidden="true">
						{weatherInfo(w.code).icon}
					</span>
				{/if}
				{#if posts.length}
					<span class="mt-auto mb-1 text-[11px] leading-none tracking-tighter" aria-hidden="true">
						{kindIcons(posts).join('')}
					</span>
				{/if}
			</button>
		{/each}
	</div>
</section>

<section class="mt-8">
	<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
		<h2 class="title text-3xl">{formatLongDay(selected)}</h2>
		{#if selectedWeather}<WeatherPill weather={selectedWeather} />{/if}
	</div>

	{#if selectedTrips.length > 0}
		<ul class="mb-4 space-y-2">
			{#each selectedTrips as trip (trip.id)}
				{@const n = dayNumber(trip.start_date, selected)}
				<li class="flex items-center justify-between gap-3 rounded-2xl bg-field px-4 py-3">
					<a href="/trips/{trip.id}#dag-{selected}" class="min-w-0">
						<p class="eyebrow">{tripTypes[trip.type].icon} Dag {n}</p>
						<p class="truncate font-semibold text-ink">{trip.title}</p>
					</a>
					<a
						href="/trips/{trip.id}/posts/new?day={selected}"
						class="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-rust hover:underline"
					>
						<Icon name="plus" class="h-4 w-4" />Lägg till
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if selectedPosts.length > 0}
		<ul class="space-y-3">
			{#each selectedPosts as post (post.id)}
				<li>
					{#if !selectedTrips.some((t) => t.id === post.trip) && tripById[post.trip]}
						<p class="label mb-1.5">{tripById[post.trip].title}</p>
					{/if}
					<PostCard {post} />
				</li>
			{/each}
		</ul>
	{:else}
		<p class="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
			{selectedTrips.length ? 'Inga inlägg den här dagen än.' : 'Ingen resa den här dagen.'}
		</p>
	{/if}
</section>
