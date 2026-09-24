<script lang="ts">
	import Avatar from './Avatar.svelte';
	import type { Post } from './pb';
	import { postKinds } from './posts';
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
</script>

<svelte:element
	this={pending ? 'div' : 'a'}
	href={pending ? undefined : `/trips/${post.trip}/posts/${post.id}`}
	class="flex gap-3 rounded-xl border bg-card p-3 transition {pending
		? 'border-dashed border-line opacity-80'
		: 'border-line hover:border-accent'}"
>
	<span class="text-2xl leading-none">{k.icon}</span>
	<div class="min-w-0 flex-1">
		<div class="flex items-start justify-between gap-2">
			<p class="truncate font-medium">
				{#if post.time}<span class="mr-1 text-sm font-normal text-muted">{post.time}</span>{/if}
				{post.title || k.label}
			</p>
			{#if post.expand?.author}<Avatar user={post.expand.author} size="h-6 w-6 text-[9px]" />{/if}
		</div>
		<p class="text-sm text-muted">
			{[post.category, post.price].filter(Boolean).join(' · ')}
			<Stars value={post.rating} />
		</p>
		{#if post.body}
			<p class="mt-1 line-clamp-2 text-sm">{post.body}</p>
		{/if}
		{#if pending}
			<p class="mt-1 flex items-center justify-between gap-2 text-xs">
				{#if error}
					<span class="text-red-600">Kunde inte skickas: {error}</span>
				{:else}
					<span class="text-muted">⏳ Väntar på nät</span>
				{/if}
				{#if onremove}
					<button type="button" onclick={onremove} class="text-muted underline hover:text-ink">
						Ta bort
					</button>
				{/if}
			</p>
		{/if}
	</div>
</svelte:element>
