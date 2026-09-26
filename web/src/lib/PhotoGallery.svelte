<script lang="ts">
	import Icon from './Icon.svelte';
	import { offline } from './offline.svelte';
	import type { Photo } from './pb';
	import { photoUrl, sortPhotos } from './photos';

	let { photos, postId }: { photos: Photo[]; postId: string } = $props();

	interface Shown {
		id: string;
		thumb: string;
		web: string;
		/** Tomt tills originalet laddats upp. */
		original: string;
		taken: string;
		pending: boolean;
	}

	const all = $derived<Shown[]>([
		...sortPhotos(photos).map((p) => ({
			id: p.id,
			thumb: photoUrl(p, 'thumb'),
			web: photoUrl(p, 'web'),
			original: p.original ? photoUrl(p, 'original') : '',
			taken: p.taken,
			pending: false
		})),
		...offline.photos
			.filter((p) => p.post === postId && !photos.some((x) => x.id === p.id))
			.map((p) => ({ id: p.id, thumb: p.thumbUrl, web: p.thumbUrl, original: '', taken: '', pending: true }))
	]);

	let open = $state<number | null>(null);
	const current = $derived(open === null ? null : all[open]);

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
	<ul class="grid gap-1.5 {all.length === 1 ? 'grid-cols-1' : all.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}">
		{#each all as p, i (p.id)}
			<li class="relative overflow-hidden rounded-2xl bg-field {all.length === 1 ? 'aspect-[4/3]' : 'aspect-square'}">
				<button type="button" onclick={() => (open = i)} class="block h-full w-full" aria-label="Visa bild {i + 1} av {all.length}">
					<img src={all.length === 1 ? p.web : p.thumb} alt="" loading="lazy" class="h-full w-full object-cover" />
				</button>
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
