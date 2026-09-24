<script lang="ts">
	import { auth } from './auth.svelte';
	import { nowTime, today, toDateInput } from './format';
	import { enqueue, isNetworkError, newId, timeout } from './offline.svelte';
	import { fieldErrors, pb, type Post, type PostDetails, type PostKind } from './pb';
	import {
		facilities,
		formatLocation,
		hasLocation,
		noiseLevels,
		parseLocation,
		postKinds
	} from './posts';
	import Icon from './Icon.svelte';
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
		/** `queued` = sparat på enheten, skickas när nätet är tillbaka. */
		onsaved: (post: Pick<Post, 'id' | 'day'>, queued?: boolean) => void;
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
			if (initial) {
				onsaved(await pb.collection('posts').update<Post>(initial.id, data, { signal: timeout() }));
				return;
			}
			// Nytt inlägg: id:t sätts här, så att det kan köas och skickas om utan dubbletter.
			const record = { ...data, id: newId(), trip: tripId, author: auth.user?.id ?? '' };
			if (!navigator.onLine) {
				await enqueue(record);
				onsaved(record, true);
				return;
			}
			try {
				onsaved(await pb.collection('posts').create<Post>(record, { signal: timeout() }));
			} catch (err) {
				if (!isNetworkError(err)) throw err;
				await enqueue(record);
				onsaved(record, true);
			}
		} catch (err) {
			errors = fieldErrors(err);
			if (Object.keys(errors).length === 0)
				errors = {
					form: isNetworkError(err)
						? 'Ingen kontakt med servern. Ändringar av befintliga inlägg kan inte sparas utan nät.'
						: 'Kunde inte spara inlägget.'
				};
		} finally {
			busy = false;
		}
	}

	const input = 'field';
</script>

{#if !kind || !config}
	<p class="title mb-4 text-2xl">Vad vill du lägga till?</p>
	<div class="grid grid-cols-2 gap-3">
		{#each Object.entries(postKinds) as [value, k] (value)}
			<button
				type="button"
				onclick={() => (kind = value as PostKind)}
				class="card flex flex-col items-center gap-2 px-3 py-7 transition hover:-translate-y-0.5 hover:shadow-card"
			>
				<span class="text-4xl">{k.icon}</span>
				<span class="font-semibold text-ink">{k.label}</span>
			</button>
		{/each}
	</div>
	<button type="button" onclick={oncancel} class="mt-5 text-sm text-muted hover:text-ink">
		Avbryt
	</button>
{:else}
	<form onsubmit={submit} class="space-y-4">
		<div class="flex items-center justify-between gap-3">
			<p
				class="inline-flex items-center gap-2 rounded-full bg-rust-soft px-4 py-2 text-sm font-bold uppercase tracking-wider text-rust"
			>
				{config.icon} {config.label}
			</p>
			{#if !initial}
				<button
					type="button"
					onclick={() => (kind = undefined)}
					class="text-sm font-medium text-muted hover:text-ink"
				>
					Byt typ
				</button>
			{/if}
		</div>

		<div class="card space-y-5 p-5">
			<div class="grid grid-cols-[3fr_2fr] gap-3">
				<label class="block space-y-1.5">
					<span class="label">Dag</span>
					<input type="date" required bind:value={day} class="{input} min-w-0" />
				</label>
				<label class="block space-y-1.5">
					<span class="label">Tid</span>
					<input type="time" bind:value={time} class="{input} min-w-0" />
				</label>
			</div>

			<label class="block space-y-1.5">
				<span class="label">{config.titleLabel}</span>
				<input
					maxlength="200"
					bind:value={title}
					placeholder={kind === 'note' ? 'Lägg till rubrik?' : 'Vad heter stället?'}
					class={input}
				/>
				{#if errors.title}<span class="text-sm text-red-600">{errors.title}</span>{/if}
			</label>

			{#if config.categories.length > 0}
				<fieldset>
					<legend class="label mb-2">Typ</legend>
					<div class="flex flex-wrap gap-2">
						{#each config.categories as c (c)}
							<button
								type="button"
								aria-pressed={category === c}
								onclick={() => (category = category === c ? '' : c)}
								class="chip"
							>
								{c}
							</button>
						{/each}
					</div>
				</fieldset>
			{/if}

			{#if config.rated}
				<div>
					<span class="label mb-1">Betyg</span>
					<Stars bind:value={rating} editable />
				</div>
			{/if}

			{#if kind === 'food'}
				<label class="block space-y-1.5">
					<span class="label">Vad vi åt och drack</span>
					<input bind:value={details.what} placeholder="Vad blev det?" class={input} />
				</label>
			{/if}

			{#if config.priceLabel}
				<div class="grid gap-3 {kind === 'overnight' ? 'grid-cols-2' : ''}">
					<label class="block space-y-1.5">
						<span class="label">{config.priceLabel}</span>
						<input maxlength="100" bind:value={price} placeholder="t.ex. 15 €" class={input} />
					</label>
					{#if kind === 'overnight'}
						<label class="block space-y-1.5">
							<span class="label">Betalsätt</span>
							<input bind:value={details.payment} placeholder="Kort, kontant, app…" class={input} />
						</label>
					{/if}
				</div>
			{/if}

			{#if kind === 'sight'}
				<label class="block space-y-1.5">
					<span class="label">Öppettider</span>
					<input bind:value={details.hours} placeholder="t.ex. 10–17" class={input} />
				</label>
			{/if}

			{#if kind === 'overnight'}
				<fieldset>
					<legend class="label mb-2">Faciliteter</legend>
					<div class="flex flex-wrap gap-2">
						{#each facilities as f (f)}
							{@const on = details.facilities?.includes(f) ?? false}
							<button
								type="button"
								aria-pressed={on}
								onclick={() => toggleFacility(f)}
								class="chip"
							>
								{f}
							</button>
						{/each}
					</div>
				</fieldset>

				<div class="grid grid-cols-2 gap-3">
					<label class="block space-y-1.5">
						<span class="label">Underlag</span>
						<input bind:value={details.surface} placeholder="Asfalt, grus, gräs…" class={input} />
					</label>
					<label class="block space-y-1.5">
						<span class="label">Utsikt</span>
						<input bind:value={details.view} class={input} />
					</label>
				</div>

				<fieldset>
					<legend class="label mb-2">Ljudnivå</legend>
					<div class="flex flex-wrap gap-2">
						{#each noiseLevels as n (n)}
							<button
								type="button"
								aria-pressed={details.noise === n}
								onclick={() => (details.noise = details.noise === n ? '' : n)}
								class="chip"
							>
								{n}
							</button>
						{/each}
					</div>
				</fieldset>
			{/if}

			{#if config.located}
				<div class="space-y-1.5">
					<span class="label">Position</span>
					<div class="flex gap-2">
						<input
							bind:value={locationText}
							inputmode="decimal"
							placeholder="Lägg till plats? (lat, lon)"
							aria-label="Position"
							class="{input} min-w-0"
						/>
						<button
							type="button"
							onclick={useMyPosition}
							disabled={locating}
							class="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-line bg-field px-3.5 text-sm font-semibold text-rust transition hover:border-rust/40 disabled:opacity-60"
						>
							<Icon name="locate" class="h-4 w-4" />
							{locating ? 'Söker…' : 'Här'}
						</button>
					</div>
					{#if errors.location}<span class="text-sm text-red-600">{errors.location}</span>{/if}
				</div>
			{/if}

			<label class="block space-y-1.5">
				<span class="label">{config.bodyLabel}</span>
				<textarea
					rows={kind === 'note' ? 8 : 4}
					maxlength="20000"
					bind:value={body}
					placeholder={kind === 'note' ? 'Vad hände i dag?' : 'Hur var det?'}
					class={input}
				></textarea>
			</label>
		</div>

		{#if errors.form}
			<p class="text-sm text-red-600" role="alert">{errors.form}</p>
		{/if}

		<div class="flex gap-3">
			<button type="submit" disabled={busy} class="btn-primary flex-1">
				{busy ? 'Sparar…' : 'Spara'}
			</button>
			<button type="button" onclick={oncancel} class="btn-ghost">Avbryt</button>
		</div>
	</form>
{/if}
