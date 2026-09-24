<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="rounded-2xl border border-dashed border-line p-10 text-center">
	<p class="text-4xl">🧭</p>
	<p class="mt-2 font-medium">{page.status === 404 ? 'Hittade inte sidan' : 'Något gick fel'}</p>
	<p class="text-sm text-muted">{page.error?.message}</p>
	<a href="/" class="mt-4 inline-block text-sm text-accent hover:underline">Till alla resor</a>
</div>
