<script lang="ts">
	import Icon from './Icon.svelte';

	/** Rund mörkgrön plusknapp nere till höger, ovanför flikraden (som i Jorial). */
	let { href, label }: { href: string; label: string } = $props();
</script>

<div
	class="pointer-events-none fixed inset-x-0 z-20 mx-auto flex max-w-3xl justify-end px-4"
	style="bottom: calc(max(0.75rem, env(safe-area-inset-bottom)) + 5.25rem)"
>
	<a
		{href}
		aria-label={label}
		title={label}
		class="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#243a2f] text-white shadow-card transition hover:scale-105 dark:bg-accent dark:text-paper"
	>
		<Icon name="plus" class="h-6 w-6" />
	</a>
</div>
