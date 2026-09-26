<script lang="ts">
	import Icon from './Icon.svelte';
	import { offline, removeQueuedPhoto } from './offline.svelte';
	import type { GeoPoint, Photo } from './pb';
	import { preparePhoto, photoUrl, sortPhotos, type PreparedPhoto } from './photos';

	let {
		existing = [],
		postId = '',
		added = $bindable([]),
		removed = $bindable([]),
		busy = $bindable(false),
		onlocation
	}: {
		/** Bilder som redan finns på inlägget (vid redigering). */
		existing?: Photo[];
		/** Inläggets id, för att visa bilder som ligger i kön. */
		postId?: string;
		/** Nya bilder, färdiga att laddas upp när inlägget sparas. */
		added?: PreparedPhoto[];
		/** Id för befintliga bilder som ska tas bort när inlägget sparas. */
		removed?: string[];
		/** Sant medan bilder skalas om. */
		busy?: boolean;
		/** Första bilden med GPS-position, så att formuläret kan föreslå den. */
		onlocation?: (p: GeoPoint) => void;
	} = $props();

	interface Item {
		key: number;
		name: string;
		url?: string;
		prepared?: PreparedPhoto;
		error?: string;
	}
	// raw: bilderna ska sparas i IndexedDB, och Svelte-proxys går inte att spara där.
	let items = $state.raw<Item[]>([]);
	let nextKey = 0;

	const shown = $derived(sortPhotos(existing).filter((p) => !removed.includes(p.id)));
	const queued = $derived(
		postId ? offline.photos.filter((p) => p.post === postId && !existing.some((e) => e.id === p.id)) : []
	);

	async function pick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		const fresh = files.map((f) => ({ key: nextKey++, name: f.name }));
		items = [...items, ...fresh];
		busy = true;
		// En i taget: stora bilder tar mycket minne i mobilen.
		for (const [i, file] of files.entries()) {
			const key = fresh[i].key;
			const update = (patch: Partial<Item>) =>
				(items = items.map((it) => (it.key === key ? { ...it, ...patch } : it)));
			try {
				const prepared = await preparePhoto(file);
				if (!items.some((it) => it.key === key)) continue; // borttagen medan den skalades
				update({ prepared, url: URL.createObjectURL(prepared.thumb) });
				if (prepared.location) onlocation?.(prepared.location);
			} catch (err) {
				update({ error: err instanceof Error ? err.message : 'Kunde inte läsa bilden.' });
			}
		}
		busy = false;
	}

	function drop(key: number) {
		const item = items.find((it) => it.key === key);
		if (item?.url) URL.revokeObjectURL(item.url);
		items = items.filter((it) => it.key !== key);
	}

	$effect(() => {
		added = items.flatMap((it) => (it.prepared ? [it.prepared] : []));
	});

	$effect(() => () => items.forEach((it) => it.url && URL.revokeObjectURL(it.url)));

	const tile = 'relative aspect-square overflow-hidden rounded-2xl bg-field';
	const x =
		'absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur transition hover:bg-ink';
</script>

<div class="space-y-2">
	<span class="label">Bilder</span>
	<ul class="grid grid-cols-3 gap-2 sm:grid-cols-4">
		{#each shown as photo (photo.id)}
			<li class={tile}>
				<img src={photoUrl(photo, 'thumb')} alt="" class="h-full w-full object-cover" />
				<button type="button" class={x} aria-label="Ta bort bilden" onclick={() => (removed = [...removed, photo.id])}>
					<Icon name="x" class="h-4 w-4" />
				</button>
			</li>
		{/each}
		{#each queued as photo (photo.id)}
			<li class={tile}>
				<img src={photo.thumbUrl} alt="" class="h-full w-full object-cover opacity-80" />
				<span class="absolute bottom-1 left-1 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-semibold text-paper">
					{photo.error ? 'Fel' : 'Väntar'}
				</span>
				<button type="button" class={x} aria-label="Ta bort bilden" onclick={() => removeQueuedPhoto(photo.id)}>
					<Icon name="x" class="h-4 w-4" />
				</button>
			</li>
		{/each}
		{#each items as item (item.key)}
			<li class={tile}>
				{#if item.url}
					<img src={item.url} alt="" class="h-full w-full object-cover" />
				{:else if item.error}
					<p class="flex h-full items-center p-2 text-center text-[11px] leading-tight text-red-600">{item.error}</p>
				{:else}
					<p class="flex h-full items-center justify-center text-xs text-muted">
						<span class="animate-pulse">Förbereder…</span>
					</p>
				{/if}
				<button type="button" class={x} aria-label="Ta bort bilden" onclick={() => drop(item.key)}>
					<Icon name="x" class="h-4 w-4" />
				</button>
			</li>
		{/each}
		<li>
			<label
				class="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-rust/40 bg-field text-rust transition hover:border-rust"
			>
				<Icon name="camera" class="h-6 w-6" />
				<span class="text-xs font-semibold">Lägg till</span>
				<input type="file" accept="image/*" multiple onchange={pick} class="sr-only" />
			</label>
		</li>
	</ul>
</div>
