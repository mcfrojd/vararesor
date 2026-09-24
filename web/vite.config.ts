import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			manifest: {
				name: 'Våra resor',
				short_name: 'Våra resor',
				description: 'Familjens resedagbok',
				lang: 'sv',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#faf8f5',
				theme_color: '#2f5d50',
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
				navigateFallback: '/',
				// PocketBase API och admin ska aldrig besvaras från cachen.
				navigateFallbackDenylist: [/^\/api\//, /^\/_\//]
			}
		})
	],
	server: {
		// Under utveckling körs PocketBase separat på port 8090.
		proxy: {
			'/api': 'http://127.0.0.1:8090',
			'/_': 'http://127.0.0.1:8090'
		}
	}
});
