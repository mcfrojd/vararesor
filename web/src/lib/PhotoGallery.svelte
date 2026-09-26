<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { offline, type PendingPhoto } from './offline.svelte';
	import type { Photo } from './pb';
	import { photoUrl, sortPhotos } from './photos';
	import { hasLocation } from './posts';

	let {
		photos,
		pending,
		compact = false,
		actions,
		corner,
		selecting = false,
		selectable = () => true,
		selected = $bindable([])
	}: {
		photos: Photo[];
		/** Små miniatyrer i rader om fyra (t.ex. i dagsöversikten), i stället för stora bilder. */
		compact?: boolean;
		/** Vilka bilder i kön som hör hit (t.ex. samma inlägg, eller dagen). */
		pending: (p: PendingPhoto) => boolean;
		/** Knappar i visningen för den uppladdade bild som visas (t.ex. "Använd som omslag"). */
		actions?: Snippet<[Photo]>;
		/** Något litet i hörnet på varje miniatyr (t.ex. vem som laddat upp bilden). */
		corner?: Snippet<[Photo]>;
		/** Välj-läge: ett tryck markerar bilden i stället för att visa den. */
		selecting?: boolean;
		/** Vilka bilder som går att välja (t.ex. bara de man får ta bort). */
		selectable?: (p: Photo) => boolean;
		/** Id för valda bilder. */
		selected?: string[];
	} = $props();

	interface Shown {
		id: string;
		thumb: string;
		web: string;
		/** Tomt tills originalet laddats upp. */
		original: string;
		taken: string;
		pending: boolean;
		canSelect?: boolean;
		/** Google Maps för bildens egen position (GPS eller Doris spår), annars tomt. */
		maps: string;
		photo?: Photo;
	}

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
	}

	const all = $derived<Shown[]>([
		...sortPhotos(photos).map((p) => ({
			id: p.id,
			canSelect: selectable(p),
			maps: hasLocation(p.location)
				? `https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lon}`
				: '',
			photo: p,
			thumb: photoUrl(p, 'thumb'),
			web: photoUrl(p, 'web'),
			original: p.original ? photoUrl(p, 'original') : '',
			taken: p.taken,
			pending: false
		})),
		...offline.photos
			.filter((p) => pending(p) && !photos.some((x) => x.id === p.id))
			.map((p) => ({ id: p.id, thumb: p.thumbUrl, web: p.thumbUrl, original: '', taken: '', pending: true, maps: '' }))
	]);

	let open = $state<number | null>(null);
	const current = $derived(open === null ? null : all[open]);
	// Bilden försvann (t.ex. flyttad till en resa): visa den före, eller stäng.
	$effect(() => {
		if (open !== null && open >= all.length) open = all.length ? all.length - 1 : null;
	});

	function step(delta: number) {
		if (open === null || all.length === 0) return;
		open = (open + delta + all.length) % all.length;
	}

	function onkey(e: KeyboardEvent) {
		if (open === null) return;
		if (e.key === 'Escape') open = null;
		else if (e.key === 'ArrowRight') step(1);
		else if (e.key === 'ArrowLeft') step(-1);
	}

	// Svep i sidled för nästa/föregående bild.
	let startX = 0;
	function swipeStart(e: PointerEvent) {
		startX = e.clientX;
	}
	function swipeEnd(e: PointerEvent) {
		const dx = e.clientX - startX;
		if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
	}

	// Stäng visningen med telefonens tillbaka-knapp i stället för att lämna sidan.
	// Beror bara på öppen/stängd, inte på vilken bild som visas.
	const isOpen = $derived(open !== null);
	$effect(() => {
		if (!isOpen) return;
		history.pushState({ photo: true }, '');
		const onpop = () => (open = null);
		window.addEventListener('popstate', onpop);
		document.body.style.overflow = 'hidden';
		return () => {
			window.removeEventListener('popstate', onpop);
			document.body.style.overflow = '';
			if (history.state?.photo) history.back();
		};
	});

	const round = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20';
</script>

<svelte:window onkeydown={onkey} />

{#if all.length > 0}
	{@const big = !compact && all.length === 1}
	<ul
		class="grid gap-1.5 {compact
			? 'grid-cols-4 sm:grid-cols-6'
			: all.length === 1
				? 'grid-cols-1'
				: all.length === 2
					? 'grid-cols-2'
					: 'grid-cols-3'}"
	>
		{#each all as p, i (p.id)}
			<li class="relative overflow-hidden bg-field {compact ? 'rounded-xl' : 'rounded-2xl'} {big ? 'aspect-[4/3]' : 'aspect-square'}">
				{#if selecting}
					{@const on = selected.includes(p.id)}
					<button
						type="button"
						disabled={!p.canSelect}
						aria-pressed={on}
						onclick={() => toggle(p.id)}
						class="block h-full w-full disabled:opacity-40"
						aria-label="Välj bild {i + 1} av {all.length}"
					>
						<img src={big ? p.web : p.thumb} alt="" loading="lazy" class="h-full w-full object-cover transition {on ? 'scale-90 rounded-xl' : ''}" />
						{#if p.canSelect}
							<span
								class="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow {on
									? 'bg-rust'
									: 'bg-black/30'}">{on ? '✓' : ''}</span
							>
						{/if}
					</button>
				{:else}
					<button type="button" onclick={() => (open = i)} class="block h-full w-full" aria-label="Visa bild {i + 1} av {all.length}">
						<img src={big ? p.web : p.thumb} alt="" loading="lazy" class="h-full w-full object-cover" />
					</button>
				{/if}
				{#if corner && p.photo && !selecting}
					<span class="pointer-events-none absolute bottom-1 left-1">{@render corner(p.photo)}</span>
				{/if}
				{#if p.pending}
					<span class="absolute bottom-1.5 left-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-semibold text-paper">
						Väntar på nät
					</span>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

{#if current && open !== null}
	<div class="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Bild {open + 1} av {all.length}">
		<div class="flex items-center justify-between gap-3 p-3 text-sm text-white/80">
			<span>{open + 1} / {all.length}{current.taken ? ` · ${current.taken.slice(11)}` : ''}</span>
			<div class="flex items-center gap-2">
				{#if actions && current.photo}{@render actions(current.photo)}{/if}
				{#if current.maps}
					<a href={current.maps} target="_blank" rel="noopener" class={round} aria-label="Visa platsen i Google Maps" title="Visa platsen i Google Maps">
						<Icon name="map" class="h-5 w-5" />
					</a>
				{/if}
				{#if current.original}
					<a href={current.original} target="_blank" rel="noopener" class={round} aria-label="Öppna originalet">
						<Icon name="download" class="h-5 w-5" />
					</a>
				{/if}
				<button type="button" onclick={() => (open = null)} class={round} aria-label="Stäng">
					<Icon name="x" class="h-5 w-5" />
				</button>
			</div>
		</div>
		<div
			class="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center select-none"
			onpointerdown={swipeStart}
			onpointerup={swipeEnd}
			role="presentation"
		>
			{#key current.id}
				<img src={current.web} alt="" class="max-h-full max-w-full object-contain" draggable="false" />
			{/key}
			{#if all.length > 1}
				<button type="button" onclick={() => step(-1)} class="{round} absolute left-3 hidden sm:flex" aria-label="Föregående">
					<Icon name="back" class="h-6 w-6" />
				</button>
				<button type="button" onclick={() => step(1)} class="{round} absolute right-3 hidden sm:flex" aria-label="Nästa">
					<Icon name="forward" class="h-6 w-6" />
				</button>
			{/if}
		</div>
		<div class="h-[max(1rem,env(safe-area-inset-bottom))]"></div>
	</div>
{/if}
