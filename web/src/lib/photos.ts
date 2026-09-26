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
	/** Tidpunkten i UTC (ISO), eller tomt. */
	takenAt: string;
	/** Från bildens GPS-data, eller null. */
	location: GeoPoint | null;
	/**
	 * Bilden har haft en plats som tagits bort (GPS-fälten finns men är tomma).
	 * Android gör så med bilder som väljs med filväljaren; delas de från
	 * Google Foto följer platsen med.
	 */
	locationRemoved: boolean;
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

/**
 * Tid och plats ur bildens EXIF. Många mobiler tar bort platsen vid
 * uppladdning från webben; då kan servern ta den ur Doris spår i stället,
 * med hjälp av den exakta tidpunkten.
 */
async function readExif(
	file: File
): Promise<Pick<PreparedPhoto, 'taken' | 'takenAt' | 'location' | 'locationRemoved'>> {
	try {
		const { default: exifr } = await import('exifr');
		const [tags, gps] = await Promise.all([
			// Råa värden: klockslaget som text och tidszonen separat (t.ex. "+02:00").
			exifr
				.parse(file, {
					pick: ['DateTimeOriginal', 'CreateDate', 'OffsetTimeOriginal', 'OffsetTime'],
					reviveValues: false
				})
				.catch(() => null),
			exifr.gps(file).catch(() => null)
		]);
		const gpsBlock = hasGpsBlock(await exifr.parse(file, { gps: true, pick: ['GPSVersionID'] }).catch(() => null));
		const lat = Number(gps?.latitude);
		const lon = Number(gps?.longitude);
		const location = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
		return {
			...cameraTime(tags?.DateTimeOriginal ?? tags?.CreateDate, tags?.OffsetTimeOriginal ?? tags?.OffsetTime),
			location: hasLocation(location) ? location : null,
			locationRemoved: gpsBlock && !hasLocation(location)
		};
	} catch {
		return { taken: '', takenAt: '', location: null, locationRemoved: false };
	}
}

/** Om bilden har ett GPS-block (kameran sparade plats), oavsett om det är tömt. */
function hasGpsBlock(tags: Record<string, unknown> | null): boolean {
	return !!tags && tags.GPSVersionID !== undefined;
}

/**
 * Kamerans klockslag ("ÅÅÅÅ:MM:DD TT:MM:SS") och tidszon ("+02:00"). Utan
 * tidszon antas mobilens nuvarande tidszon.
 */
export function cameraTime(raw: unknown, offset: unknown): { taken: string; takenAt: string } {
	const m = typeof raw === 'string' && raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
	if (!m) return { taken: '', takenAt: '' };
	const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
	const taken = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
	const o = typeof offset === 'string' && offset.match(/^([+-])(\d{2}):?(\d{2})$/);
	const ms = o
		? Date.UTC(y, mo - 1, d, h, mi, s) - (o[1] === '-' ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3])) * 60_000
		: new Date(y, mo - 1, d, h, mi, s).getTime();
	return { taken, takenAt: isNaN(ms) ? '' : new Date(ms).toISOString() };
}

/** Profilbild: kvadrat, beskuren kring mitten, 512 px webp. */
export const AVATAR_SIZE = 512;

export async function prepareAvatar(file: File): Promise<Blob> {
	const bitmap = await decode(file);
	try {
		const side = Math.min(bitmap.width, bitmap.height);
		const size = Math.min(AVATAR_SIZE, side);
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = size;
		const ctx = canvas.getContext('2d')!;
		ctx.imageSmoothingQuality = 'high';
		ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
		return await toWebp(canvas);
	} finally {
		bitmap.close();
	}
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
