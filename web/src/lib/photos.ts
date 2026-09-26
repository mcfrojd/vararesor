import type { GeoPoint, Photo } from './pb';
import { pb } from './pb';
import { hasLocation } from './posts';

/** Längsta sidan på bilderna som skapas i mobilen. */
export const WEB_SIZE = 1600;
export const THUMB_SIZE = 480;
const QUALITY = 0.82;

/** En bild som gjorts klar i mobilen men inte laddats upp än. */
export interface PreparedPhoto {
	web: Blob;
	thumb: Blob;
	original: File;
	width: number;
	height: number;
	/** "ÅÅÅÅ-MM-DD TT:MM" enligt kameran, eller tomt. */
	taken: string;
	/** Från bildens GPS-data, eller null. */
	location: GeoPoint | null;
}

/** Läser in bilden rättvänd (EXIF-orientering) och skalar den till webp i två storlekar. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
	const [bitmap, meta] = await Promise.all([decode(file), readExif(file)]);
	try {
		const web = scale(bitmap, WEB_SIZE);
		const thumb = scale(web, THUMB_SIZE);
		return {
			web: await toWebp(web),
			thumb: await toWebp(thumb),
			original: file,
			width: bitmap.width,
			height: bitmap.height,
			...meta
		};
	} finally {
		bitmap.close();
	}
}

async function decode(file: File): Promise<ImageBitmap> {
	try {
		return await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		throw new Error(`Kan inte läsa ${file.name}. Formatet stöds inte av webbläsaren.`);
	}
}

function scale(source: ImageBitmap | HTMLCanvasElement, max: number): HTMLCanvasElement {
	const ratio = Math.min(1, max / Math.max(source.width, source.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(source.width * ratio));
	canvas.height = Math.max(1, Math.round(source.height * ratio));
	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
	return canvas;
}

/**
 * Webp från webbläsaren om den kan (Chrome, Firefox). Safari kan inte skapa webp
 * och ger png i stället; då används en webp-kodare i WebAssembly.
 */
async function toWebp(canvas: HTMLCanvasElement): Promise<Blob> {
	const native = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, 'image/webp', QUALITY)
	);
	if (native?.type === 'image/webp' && !forceWasm()) return native;
	const { default: encode } = await import('@jsquash/webp/encode');
	const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
	const buffer = await encode(data, { quality: QUALITY * 100 });
	return new Blob([buffer], { type: 'image/webp' });
}

/** För test: `localStorage['vararesor:wasm-webp'] = '1'` tvingar fram WebAssembly-kodaren. */
function forceWasm(): boolean {
	try {
		return localStorage.getItem('vararesor:wasm-webp') === '1';
	} catch {
		return false;
	}
}

/** Tid och plats ur bildens EXIF. Många mobiler tar bort platsen vid uppladdning från webben. */
async function readExif(file: File): Promise<Pick<PreparedPhoto, 'taken' | 'location'>> {
	try {
		const { default: exifr } = await import('exifr');
		const [tags, gps] = await Promise.all([
			exifr.parse(file, ['DateTimeOriginal', 'CreateDate']).catch(() => null),
			exifr.gps(file).catch(() => null)
		]);
		const date: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate;
		const lat = Number(gps?.latitude);
		const lon = Number(gps?.longitude);
		const location = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
		return {
			taken: date instanceof Date && !isNaN(date.getTime()) ? localStamp(date) : '',
			location: hasLocation(location) ? location : null
		};
	} catch {
		return { taken: '', location: null };
	}
}

/** exifr tolkar kamerans klockslag som lokal tid, så det formateras tillbaka likadant. */
function localStamp(d: Date): string {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function photoUrl(photo: Photo, size: 'thumb' | 'web' | 'original' = 'web'): string {
	if (size === 'original' && photo.original)
		// download: sparas som fil, och service workern cachar inte de stora originalen.
		return pb.files.getURL(photo, photo.original, { download: true });
	return pb.files.getURL(photo, photo[size] || photo.web);
}

/** Bilderna i den ordning de togs (annars i uppladdningsordning). */
export function sortPhotos<T extends Pick<Photo, 'taken' | 'created'>>(photos: T[]): T[] {
	return [...photos].sort((a, b) =>
		(a.taken || a.created).localeCompare(b.taken || b.created)
	);
}
