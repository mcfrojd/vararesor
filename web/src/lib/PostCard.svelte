<script lang="ts">
	import Avatar from './Avatar.svelte';
	import type { Post } from './pb';
	import { postKinds } from './posts';
	import Stars from './Stars.svelte';

	let { post }: { post: Post } = $props();

	const k = $derived(postKinds[post.kind]);
</script>

<a
	href="/trips/{post.trip}/posts/{post.id}"
	class="flex gap-3 rounded-xl border border-line bg-card p-3 transition hover:border-accent"
>
	<span class="text-2xl leading-none">{k.icon}</span>
	<div class="min-w-0 flex-1">
		<div class="flex items-start justify-between gap-2">
			<p class="truncate font-medium">{post.title || k.label}</p>
			{#if post.expand?.author}<Avatar user={post.expand.author} size="h-6 w-6 text-[9px]" />{/if}
		</div>
		<p class="text-sm text-muted">
			{[post.category, post.price].filter(Boolean).join(' · ')}
			<Stars value={post.rating} />
		</p>
		{#if post.body}
			<p class="mt-1 line-clamp-2 text-sm">{post.body}</p>
		{/if}
	</div>
</a>
