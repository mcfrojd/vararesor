<script lang="ts">
	import Avatar from './Avatar.svelte';
	import Icon from './Icon.svelte';
	import type { Post } from './pb';
	import { formatLocation, hasLocation, postKinds } from './posts';
	import Stars from './Stars.svelte';

	let {
		post,
		pending = false,
		error = '',
		onremove
	}: {
		post: Post;
		/** Köat inlägg som inte skickats än (finns bara på enheten). */
		pending?: boolean;
		error?: string;
		onremove?: () => void;
	} = $props();

	const k = $derived(postKinds[post.kind]);
	const subtitle = $derived([post.category || k.label, post.price].filter(Boolean).join(' · '));
</script>

<!-- Inläggskort i stil med Jorials dagbok: fet rubrik, plats i terrakotta, text och betyg. -->
<svelte:element
	this={pending ? 'div' : 'a'}
	href={pending ? undefined : `/trips/${post.trip}/posts/${post.id}`}
	class="card block p-4 transition {pending
		? 'border-dashed opacity-80 shadow-none'
		: 'hover:-translate-y-0.5 hover:shadow-card'}"
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			<p class="text-[17px] font-bold leading-snug text-ink">
				{post.title || k.label}
			</p>
			<p class="mt-0.5 text-sm font-semibold text-rust">{k.icon} {subtitle}</p>
			{#if hasLocation(post.location)}
				<p class="mt-0.5 flex items-center gap-1 text-[11px] text-rust/70">
					<Icon name="pin" class="h-3 w-3" />{formatLocation(post.location)}
				</p>
			{/if}
		</div>
		<div class="flex shrink-0 flex-col items-end gap-1.5">
			{#if post.time}<span class="text-xs font-semibold text-muted">{post.time}</span>{/if}
			{#if post.expand?.author}<Avatar user={post.expand.author} size="h-6 w-6 text-[9px]" />{/if}
		</div>
	</div>
	{#if post.body}
		<p class="mt-3 line-clamp-3 text-sm leading-relaxed">{post.body}</p>
	{/if}
	{#if post.rating}
		<p class="mt-2"><Stars value={post.rating} /></p>
	{/if}
	{#if pending}
		<p class="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs">
			{#if error}
				<span class="text-red-600">Kunde inte skickas: {error}</span>
			{:else}
				<span class="font-semibold text-muted">⏳ Väntar på nät</span>
			{/if}
			{#if onremove}
				<button type="button" onclick={onremove} class="text-muted underline hover:text-ink">
					Ta bort
				</button>
			{/if}
		</p>
	{/if}
</svelte:element>
