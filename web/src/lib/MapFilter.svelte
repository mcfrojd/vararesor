<script lang="ts">
	import { rangePresets, type MapFilter } from './mapFilter';
	import type { PostKind } from './pb';
	import { postKinds } from './posts';

	let {
		filter = $bindable(),
		counts,
		tracksAvailable = false
	}: {
		filter: MapFilter;
		counts: Record<PostKind, number>;
		/** Visa knappen för GPS-spår (bara när det finns spår att visa). */
		tracksAvailable?: boolean;
	} = $props();

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
