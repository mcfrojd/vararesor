// See https://svelte.dev/docs/kit/types#app.d.ts
/// <reference types="vite-plugin-pwa/client" />
declare global {
	namespace App {}
	/** Versionen appen byggdes från (JSON från deploy.sh), eller tomt. */
	const __APP_VERSION__: string;
}

export {};
