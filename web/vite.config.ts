import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

/** Miljövariabel vid bygget (Node), utan att dra in Nodes typer. */
function buildEnv(name: string): string {
	const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
	return env?.[name] ?? '';
}

export default defineConfig({
	// Versionen (se deploy.sh) byggs in i appen och visas på profilsidan.
	define: { __APP_VERSION__: JSON.stringify(buildEnv('APP_VERSION')) },
	plugins: [
		tailwindcss(),
		sveltekit(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			// Fast sökväg, annars registreras ./sw.js relativt sidan och en djuplänk
			// som /trips/abc får HTML i stället för service workern.
			base: '/',
			scope: '/',
			// adapter-static skriver index.html efter att service workern byggts, så
			// den måste läggas till här. Annars startar appen inte utan nät.
			kit: { adapterFallback: 'index.html', spa: { fallbackMapping: '/' } },
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
				// "Dela" från mobilens galleri till appen (se static/share-target.js).
				share_target: {
					action: '/dela',
					method: 'POST',
					enctype: 'multipart/form-data',
					params: { files: [{ name: 'bilder', accept: ['image/*'] }] }
				},
				icons: [
					{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				// wasm = webp-kodaren som Safari behöver för att skala bilder, även utan nät.
				globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,wasm}'],
				// Tar emot bilder som delas till appen (POST /dela).
				importScripts: ['/share-target.js'],
				navigateFallback: '/',
				// PocketBase API och admin ska aldrig besvaras från cachen.
				navigateFallbackDenylist: [/^\/api\//, /^\/_\//],
				// Offline: svar från API:t och bilder sparas när de hämtas, så att resor
				// och inlägg man redan öppnat går att läsa utan nät. Nätet går först;
				// cachen används bara när det inte svarar. Namnen börjar med "api-" så
				// att utloggningen kan tömma dem.
				runtimeCaching: [
					{
						urlPattern: ({ url, request }) =>
							request.method === 'GET' && /^\/api\/collections\/[^/]+\/records/.test(url.pathname),
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-data',
							networkTimeoutSeconds: 6,
							expiration: { maxEntries: 300 }
						}
					},
					{
						// Original (hämtas med ?download=1) är stora och cachas inte.
						urlPattern: ({ url }) =>
							url.pathname.startsWith('/api/files/') && !url.searchParams.has('download'),
						handler: 'CacheFirst',
						options: {
							cacheName: 'api-files',
							expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 90 },
							cacheableResponse: { statuses: [200] }
						}
					}
				]
			}
		})
	],
	// Webp-kodaren laddar sin wasm-fil relativt sig själv; förpaketering bryter det.
	optimizeDeps: { exclude: ['@jsquash/webp'] },
	server: {
		// Under utveckling körs PocketBase separat på port 8090.
		proxy: {
			'/api': 'http://127.0.0.1:8090',
			'/_': 'http://127.0.0.1:8090'
		}
	}
});
