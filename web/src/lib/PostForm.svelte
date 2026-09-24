<script lang="ts">
	import { auth } from './auth.svelte';
	import { nowTime, today, toDateInput } from './format';
	import { fieldErrors, pb, type Post, type PostDetails, type PostKind } from './pb';
	import {
		facilities,
		formatLocation,
		hasLocation,
		noiseLevels,
		parseLocation,
		postKinds
	} from './posts';
	import Stars from './Stars.svelte';

	let {
		tripId,
		post,
		kind: initialKind,
		day: initialDay,
		onsaved,
		oncancel
	}: {
		tripId: string;
		post?: Post;
		kind?: PostKind;
		day: string;
		onsaved: (post: Post) => void;
		oncancel: () => void;
	} = $props();

	// Formulärets startvärden tas en gång; sedan äger formuläret dem.
	// svelte-ignore state_referenced_locally
	const initial = post;

	// svelte-ignore state_referenced_locally
	let kind = $state<PostKind | undefined>(initial?.kind ?? initialKind);
	// svelte-ignore state_referenced_locally
	let day = $state(initial ? toDateInput(initial.day) : initialDay);
	// Nytt inlägg för i dag får klockslaget nu; andra dagar lämnas tiden tom.
	// svelte-ignore state_referenced_locally
	let time = $state(initial ? initial.time : initialDay === today() ? nowTime() : '');
	let title = $state(initial?.title ?? '');
	let category = $state(initial?.category ?? '');
	let body = $state(initial?.body ?? '');
	let rating = $state(initial?.rating ?? 0);
	let price = $state(initial?.price ?? '');
	let locationText = $state(hasLocation(initial?.location) ? formatLocation(initial.location) : '');
	let details = $state<PostDetails>({ facilities: [], ...(initial?.details ?? {}) });

	let locating = $state(false);
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);

	const config = $derived(kind ? postKinds[kind] : undefined);

	function toggleFacility(f: string) {
		const list = details.facilities ?? [];
		details.facilities = list.includes(f) ? list.filter((x) => x !== f) : [...list, f];
	}

	function useMyPosition() {
		if (!navigator.geolocation) {
			errors = { location: 'Enheten kan inte ge position.' };
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				locationText = formatLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
				locating = false;
			},
			() => {
				errors = { location: 'Kunde inte hämta position. Är platstjänster tillåtna?' };
				locating = false;
			},
			{ enableHighAccuracy: true, timeout: 15000 }
		);
	}

	/** Behåller bara fälten som hör till vald typ, så att inget gammalt skräp sparas. */
	function cleanDetails(k: PostKind): PostDetails {
		const d = $state.snapshot(details);
		if (k === 'overnight')
			return {
				payment: d.payment?.trim(),
				facilities: d.facilities ?? [],
				surface: d.surface?.trim(),
				view: d.view?.trim(),
				noise: d.noise
			};
		if (k === 'food') return { what: d.what?.trim() };
		if (k === 'sight') return { hours: d.hours?.trim() };
		return {};
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!kind || !config) return;
		errors = {};

		let location = { lat: 0, lon: 0 };
		if (locationText.trim()) {
			const parsed = parseLocation(locationText);
			if (!parsed) {
				errors = { location: 'Skriv position som "lat, lon", t.ex. 52.52, 13.405.' };
				return;
			}
			location = parsed;
		}
		if (!title.trim() && !body.trim()) {
			errors = { title: kind === 'note' ? 'Skriv något.' : 'Fyll i ett namn.' };
			return;
		}

		const data = {
			kind,
			day,
			time,
			title: title.trim(),
			category: config.categories.includes(category) ? category : '',
			body: body.trim(),
			rating: config.rated ? rating : 0,
			price: config.priceLabel ? price.trim() : '',
			location,
			details: cleanDetails(kind)
		};

		busy = true;
		try {
			const saved = initial
				? await pb.collection('posts').update<Post>(initial.id, data)
				: await pb
						.collection('posts')
						.create<Post>({ ...data, trip: tripId, author: auth.user?.id });
			onsaved(saved);
		} catch (err) {
			errors = fieldErrors(err);
			if (Object.keys(errors).length === 0) errors = { form: 'Kunde inte spara inlägget.' };
		} finally {
			busy = false;
		}
	}

	const input =
		'w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-accent';
	const chip = (on: boolean) =>
		`rounded-full border px-3 py-1.5 text-sm ${on ? 'border-accent bg-accent-soft font-medium' : 'border-line bg-card'}`;
</script>

{#if !kind || !config}
	<p class="mb-3 text-sm text-muted">Vad vill du lägga till?</p>
	<div class="grid grid-cols-2 gap-3">
		{#each Object.entries(postKinds) as [value, k] (value)}
			<button
				type="button"
				onclick={() => (kind = value as PostKind)}
				class="flex flex-col items-center gap-2 rounded-2xl border border-line bg-card px-3 py-6 hover:border-accent"
			>
				<span class="text-4xl">{k.icon}</span>
				<span class="font-medium">{k.label}</span>
			</button>
		{/each}
	</div>
	<button type="button" onclick={oncancel} class="mt-5 text-sm text-muted hover:text-ink">
		Avbryt
	</button>
{:else}
	<form onsubmit={submit} class="space-y-5">
		<div class="flex items-center justify-between gap-3">
			<p class="text-lg font-semibold">{config.icon} {config.label}</p>
			{#if !initial}
				<button
					type="button"
					onclick={() => (kind = undefined)}
					class="text-sm text-muted hover:text-ink"
				>
					Byt typ
				</button>
			{/if}
		</div>

		<div class="grid grid-cols-[3fr_2fr] gap-3">
			<label class="block space-y-1">
				<span class="text-sm font-medium">Dag</span>
				<input type="date" required bind:value={day} class={input} />
			</label>
			<label class="block space-y-1">
				<span class="text-sm font-medium">Tid</span>
				<input type="time" bind:value={time} class={input} />
			</label>
		</div>

		<label class="block space-y-1">
			<span class="text-sm font-medium">{config.titleLabel}</span>
			<input maxlength="200" bind:value={title} class={input} />
			{#if errors.title}<span class="text-sm text-red-600">{errors.title}</span>{/if}
		</label>

		{#if config.categories.length > 0}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">Typ</legend>
				<div class="flex flex-wrap gap-2">
					{#each config.categories as c (c)}
						<button
							type="button"
							aria-pressed={category === c}
							onclick={() => (category = category === c ? '' : c)}
							class={chip(category === c)}
						>
							{c}
						</button>
					{/each}
				</div>
			</fieldset>
		{/if}

		{#if config.rated}
			<div>
				<span class="mb-1 block text-sm font-medium">Betyg</span>
				<Stars bind:value={rating} editable />
			</div>
		{/if}

		{#if kind === 'food'}
			<label class="block space-y-1">
				<span class="text-sm font-medium">Vad vi åt och drack</span>
				<input bind:value={details.what} class={input} />
			</label>
		{/if}

		{#if config.priceLabel}
			<div class="grid gap-3 {kind === 'overnight' ? 'grid-cols-2' : ''}">
				<label class="block space-y-1">
					<span class="text-sm font-medium">{config.priceLabel}</span>
					<input maxlength="100" bind:value={price} placeholder="t.ex. 15 €" class={input} />
				</label>
				{#if kind === 'overnight'}
					<label class="block space-y-1">
						<span class="text-sm font-medium">Betalsätt</span>
						<input bind:value={details.payment} placeholder="Kort, kontant, app…" class={input} />
					</label>
				{/if}
			</div>
		{/if}

		{#if kind === 'sight'}
			<label class="block space-y-1">
				<span class="text-sm font-medium">Öppettider</span>
				<input bind:value={details.hours} class={input} />
			</label>
		{/if}

		{#if kind === 'overnight'}
			<fieldset>
				<legend class="mb-2 text-sm font-medium">Faciliteter</legend>
				<div class="flex flex-wrap gap-2">
					{#each facilities as f (f)}
						{@const on = details.facilities?.includes(f) ?? false}
						<button
							type="button"
							aria-pressed={on}
							onclick={() => toggleFacility(f)}
							class={chip(on)}
						>
							{f}
						</button>
					{/each}
				</div>
			</fieldset>

			<div class="grid grid-cols-2 gap-3">
				<label class="block space-y-1">
					<span class="text-sm font-medium">Underlag</span>
					<input bind:value={details.surface} placeholder="Asfalt, grus, gräs…" class={input} />
				</label>
				<label class="block space-y-1">
					<span class="text-sm font-medium">Utsikt</span>
					<input bind:value={details.view} class={input} />
				</label>
			</div>

			<fieldset>
				<legend class="mb-2 text-sm font-medium">Ljudnivå</legend>
				<div class="flex flex-wrap gap-2">
					{#each noiseLevels as n (n)}
						<button
							type="button"
							aria-pressed={details.noise === n}
							onclick={() => (details.noise = details.noise === n ? '' : n)}
							class={chip(details.noise === n)}
						>
							{n}
						</button>
					{/each}
				</div>
			</fieldset>
		{/if}

		{#if config.located}
			<div class="space-y-1">
				<span class="block text-sm font-medium">Position</span>
				<div class="flex gap-2">
					<input
						bind:value={locationText}
						inputmode="decimal"
						placeholder="lat, lon"
						aria-label="Position"
						class="{input} min-w-0"
					/>
					<button
						type="button"
						onclick={useMyPosition}
						disabled={locating}
						class="shrink-0 rounded-xl border border-line px-3 text-sm hover:bg-accent-soft disabled:opacity-60"
					>
						{locating ? 'Söker…' : '📍 Här'}
					</button>
				</div>
				{#if errors.location}<span class="text-sm text-red-600">{errors.location}</span>{/if}
			</div>
		{/if}

		<label class="block space-y-1">
			<span class="text-sm font-medium">{config.bodyLabel}</span>
			<textarea rows={kind === 'note' ? 8 : 4} maxlength="20000" bind:value={body} class={input}
			></textarea>
		</label>

		{#if errors.form}
			<p class="text-sm text-red-600" role="alert">{errors.form}</p>
		{/if}

		<div class="flex gap-3">
			<button
				type="submit"
				disabled={busy}
				class="flex-1 rounded-xl bg-accent py-2.5 font-medium text-paper disabled:opacity-60"
			>
				{busy ? 'Sparar…' : 'Spara'}
			</button>
			<button
				type="button"
				onclick={oncancel}
				class="rounded-xl border border-line px-5 py-2.5 hover:bg-accent-soft"
			>
				Avbryt
			</button>
		</div>
	</form>
{/if}
