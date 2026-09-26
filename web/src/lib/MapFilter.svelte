<script lang="ts">
	import { rangePresets, type MapFilter } from './mapFilter';
	import type { PostKind, Trip } from './pb';
	import { postKinds } from './posts';

	let {
		filter = $bindable(),
		counts,
		photoCount = 0,
		tracksAvailable = false,
		trips = []
	}: {
		filter: MapFilter;
		counts: Record<PostKind, number>;
		/** Bilder med position inom perioden. Knappen visas bara om det finns några. */
		photoCount?: number;
		/** Visa knappen för GPS-spår (bara när det finns spår att visa). */
		tracksAvailable?: boolean;
		/** Resor att välja bland (de som har något att visa). Knapparna visas vid fler än en. */
		trips?: Pick<Trip, 'id' | 'title'>[];
	} = $props();

	function toggleTrip(id: string) {
		filter.hiddenTrips = filter.hiddenTrips.includes(id)
			? filter.hiddenTrips.filter((x) => x !== id)
			: [...filter.hiddenTrips, id];
	}
	const allTrips = $derived(trips.every((t) => !filter.hiddenTrips.includes(t.id)));
	const noTrips = $derived(trips.every((t) => filter.hiddenTrips.includes(t.id)));

	// Kortare namn på knapparna än i mallarna.
	const short: Record<PostKind, string> = {
		overnight: 'Övernattning',
		food: 'Mat',
		sight: 'Sevärt',
		note: 'Anteckningar'
	};

	function toggleKind(k: PostKind) {
		filter.kinds = filter.kinds.includes(k)
			? filter.kinds.filter((x) => x !== k)
			: [...filter.kinds, k];
	}

	const input = 'field py-2 text-sm';
</script>

<div class="space-y-3">
	<!-- En rad som går att svepa i sidled på mobilen, i stället för flera rader. -->
	<div
		class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
		role="group"
		aria-label="Visa på kartan"
	>
		{#each Object.keys(postKinds) as PostKind[] as k (k)}
			<button
				type="button"
				aria-pressed={filter.kinds.includes(k)}
				onclick={() => toggleKind(k)}
				class="chip"
			>
				{postKinds[k].icon}
				{short[k]}
				<span class="text-xs text-muted">{counts[k]}</span>
			</button>
		{/each}
		{#if photoCount > 0}
			<button
				type="button"
				aria-pressed={filter.photos}
				onclick={() => (filter.photos = !filter.photos)}
				class="chip"
			>
				📷 Bilder
				<span class="text-xs text-muted">{photoCount}</span>
			</button>
		{/if}
		{#if tracksAvailable}
			<button
				type="button"
				aria-pressed={filter.tracks}
				onclick={() => (filter.tracks = !filter.tracks)}
				class="chip"
			>
				🛣️ Spår
			</button>
		{/if}
	</div>

	{#if trips.length > 1}
		<!-- "Ingen" och sedan en resa: snabbaste sättet att se bara den. -->
		<div
			class="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
			role="group"
			aria-label="Resor"
		>
			<span class="label shrink-0">Resor</span>
			<button type="button" aria-pressed={allTrips} onclick={() => (filter.hiddenTrips = [])} class="chip">Alla</button>
			<button
				type="button"
				aria-pressed={noTrips}
				onclick={() => (filter.hiddenTrips = trips.map((t) => t.id))}
				class="chip"
			>
				Ingen
			</button>
			{#each trips as t (t.id)}
				<button
					type="button"
					aria-pressed={!filter.hiddenTrips.includes(t.id)}
					onclick={() => toggleTrip(t.id)}
					class="chip shrink-0 whitespace-nowrap"
				>
					{t.title}
				</button>
			{/each}
		</div>
	{/if}

	<div class="flex flex-wrap items-center gap-1" role="group" aria-label="Tidsperiod">
		{#each rangePresets as r (r.value)}
			<button
				type="button"
				aria-pressed={filter.range === r.value}
				onclick={() => (filter.range = r.value)}
				class="rounded-full px-3 py-1 text-sm font-medium transition {filter.range === r.value
					? 'bg-ink text-paper'
					: 'text-muted hover:text-ink'}"
			>
				{r.label}
			</button>
		{/each}
	</div>

	{#if filter.range === 'custom'}
		<div class="flex items-center gap-2">
			<input type="date" aria-label="Från" bind:value={filter.from} class="{input} min-w-0 flex-1" />
			<span class="text-muted">–</span>
			<input
				type="date"
				aria-label="Till"
				bind:value={filter.to}
				min={filter.from || undefined}
				class="{input} min-w-0 flex-1"
			/>
		</div>
	{/if}
</div>
