<script lang="ts">
	import { pb, type User } from './pb';

	let { user, size = 'h-8 w-8 text-xs' }: { user: User; size?: string } = $props();

	const initials = $derived(
		(user.name || user.email || '?')
			.split(/\s+/)
			.map((part) => part[0])
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
</script>

{#if user.avatar}
	<img
		src={pb.files.getURL(user, user.avatar)}
		alt={user.name}
		title={user.name}
		class="{size} shrink-0 rounded-full object-cover"
	/>
{:else}
	<span
		title={user.name}
		class="{size} inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent"
	>
		{initials}
	</span>
{/if}
