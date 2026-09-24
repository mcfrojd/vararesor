import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Byggs till statiska filer som PocketBase serverar från pb_public/.
		// fallback gör att alla sökvägar laddar appen (SPA).
		adapter: adapter({ fallback: 'index.html' }),
		serviceWorker: { register: false }
	}
};

export default config;
