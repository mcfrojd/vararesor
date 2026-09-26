<script lang="ts">
	import { auth, logout } from '$lib/auth.svelte';
	import Avatar from '$lib/Avatar.svelte';
	import Icon from '$lib/Icon.svelte';
	import { clearOfflineData, isNetworkError, offline, timeout, waitingLabel } from '$lib/offline.svelte';
	import { pb, type User } from '$lib/pb';
	import { prepareAvatar } from '$lib/photos';
	import { dayNumber, today, tripStatus, tripTypes } from '$lib/format';

	let { data } = $props();

	const stats = $derived.by(() => {
		const s = data.stats;
		if (!s) return null;
		const t = today();
		const started = s.trips.filter((trip) => trip.start_date && tripStatus(trip.start_date, trip.end_date) !== 'upcoming');
		// Dagar på resor som gjorts eller pågår, fram till i dag.
		const days = started.reduce((sum, trip) => {
			const end = trip.end_date && trip.end_date.slice(0, 10) < t ? trip.end_date : t;
			return sum + dayNumber(trip.start_date, end);
		}, 0);
		const byType = Object.entries(tripTypes)
			.map(([type, info]) => {
				const n = started.filter((trip) => trip.type === type).length;
				const word = { husbil: ['husbilsresa', 'husbilsresor'], semester: ['semester', 'semestrar'], egen: ['egen resa', 'egna resor'] }[type]!;
				return { icon: info.icon, n, label: word[n === 1 ? 0 : 1] };
			})
			.filter((x) => x.n > 0);
		return {
			tiles: [
				{ icon: '📷', n: s.photos, label: s.photos === 1 ? 'uppladdad bild' : 'uppladdade bilder' },
				{ icon: '✍️', n: s.posts, label: 'inlägg' },
				{ icon: '🗺️', n: s.trips.filter((trip) => trip.owner === s.me).length, label: 'upplagda resor' },
				{ icon: '✅', n: s.trips.filter((trip) => tripStatus(trip.start_date, trip.end_date) === 'past' && trip.start_date).length, label: 'gjorda resor' },
				{ icon: '📅', n: days, label: days === 1 ? 'resdag' : 'resdagar' },
				{ icon: '🛏️', n: s.overnights, label: s.overnights === 1 ? 'övernattning' : 'övernattningar' }
			],
			byType,
			upcoming: s.trips.filter((trip) => tripStatus(trip.start_date, trip.end_date) === 'upcoming').length
		};
	});

	const waiting = $derived(waitingLabel());

	let avatarBusy = $state(false);
	let avatarError = $state('');

	/** Sparar ändringen på kontot och uppdaterar inloggningen, så att bilden syns överallt direkt. */
	async function saveAvatar(avatar: File | null) {
		if (!auth.user) return;
		avatarBusy = true;
		avatarError = '';
		try {
			const form = new FormData();
			if (avatar) form.append('avatar', avatar);
			else form.append('avatar', '');
			const user = await pb.collection('users').update<User>(auth.user.id, form, { signal: timeout() });
			pb.authStore.save(pb.authStore.token, user as never);
		} catch (err) {
			avatarError = isNetworkError(err)
				? 'Ingen kontakt med servern. Profilbilden kan bara bytas med nät.'
				: 'Kunde inte spara profilbilden.';
		} finally {
			avatarBusy = false;
		}
	}

	async function pickAvatar(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		try {
			avatarBusy = true;
			const blob = await prepareAvatar(file);
			await saveAvatar(new File([blob], 'avatar.webp', { type: 'image/webp' }));
		} catch (err) {
			avatarError = err instanceof Error ? err.message : 'Kunde inte läsa bilden.';
			avatarBusy = false;
		}
	}

	function removeAvatar() {
		if (confirm('Ta bort profilbilden?')) void saveAvatar(null);
	}

	async function signOut() {
		if (
			waiting &&
			!confirm(`${waiting} har inte skickats än och försvinner om du loggar ut. Logga ut ändå?`)
		)
			return;
		await clearOfflineData();
		logout();
	}
</script>

<svelte:head><title>Profil · Våra resor</title></svelte:head>

<h1 class="title mb-6 text-4xl">Profil</h1>

{#if auth.user}
	<section class="card p-5">
		<div class="flex items-center gap-4">
			<!-- Tryck på bilden för att byta. -->
			<label class="relative shrink-0 cursor-pointer rounded-full" aria-label="Byt profilbild">
				<Avatar user={auth.user} size="h-20 w-20 text-xl" />
				<span
					class="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-accent text-paper shadow-md"
				>
					<Icon name="camera" class="h-4 w-4" />
				</span>
				{#if avatarBusy}
					<span class="absolute inset-0 flex items-center justify-center rounded-full bg-ink/50 text-xs font-semibold text-paper">
						Sparar…
					</span>
				{/if}
				<input type="file" accept="image/*" onchange={pickAvatar} disabled={avatarBusy} class="sr-only" />
			</label>
			<div class="min-w-0">
				<p class="title truncate text-2xl">{auth.user.name || 'Utan namn'}</p>
				<p class="truncate text-sm text-muted">{auth.user.email}</p>
				{#if auth.user.avatar && !avatarBusy}
					<button type="button" onclick={removeAvatar} class="mt-1 text-xs font-medium text-muted underline hover:text-ink">
						Ta bort profilbild
					</button>
				{/if}
			</div>
		</div>
		{#if avatarError}<p class="mt-3 text-sm text-red-600" role="alert">{avatarError}</p>{/if}
	</section>

	{#if stats}
		<section class="mt-4" aria-labelledby="stats-rubrik">
			<h2 id="stats-rubrik" class="label mb-2">I siffror</h2>
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each stats.tiles as tile (tile.label)}
					<li class="card p-4">
						<p class="text-2xl" aria-hidden="true">{tile.icon}</p>
						<p class="title mt-1 text-3xl leading-none">{tile.n.toLocaleString('sv-SE')}</p>
						<p class="mt-1 text-sm text-muted">{tile.label}</p>
					</li>
				{/each}
			</ul>
			{#if stats.byType.length > 0 || stats.upcoming > 0}
				<p class="mt-3 text-sm text-muted">
					{stats.byType.map((x) => `${x.icon} ${x.n} ${x.label}`).join(' · ')}
					{#if stats.upcoming > 0}{stats.byType.length ? ' · ' : ''}{stats.upcoming} på gång{/if}
				</p>
			{/if}
			<p class="mt-1 text-xs text-muted">
				Bilder och inlägg är dina egna. Resor, dagar och övernattningar gäller alla resor du är med på.
			</p>
		</section>
	{/if}

	<section class="card mt-4 space-y-1 p-5">
		<p class="label">Synk</p>
		<p class="flex items-center gap-2 text-ink">
			<span
				class="h-2.5 w-2.5 rounded-full {offline.online ? 'bg-accent' : 'bg-rust'}"
				aria-hidden="true"
			></span>
			{offline.online ? 'Uppkopplad' : 'Ingen uppkoppling'}
		</p>
		<p class="text-sm text-muted">
			{waiting ? `${waiting} väntar på att skickas från den här enheten.` : 'Allt är skickat.'}
		</p>
	</section>

	<button type="button" onclick={signOut} class="btn-ghost mt-6 w-full text-rust">
		<Icon name="logout" class="h-5 w-5" />
		Logga ut
	</button>
{/if}
