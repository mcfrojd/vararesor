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
	/** Från bildens GPS-data, eller null (Android tar bort den; servern hämtar den från Immich). */
	location: GeoPoint | null;
}

/** Läser in bilden rättvänd (EXIF-orientering) och skalar den till webp i två storlekar. */
export async function preparePhoto(picked: File): Promise<PreparedPhoto> {
	let file = picked;
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		// Går inte att läsa direkt: kopia i minnet och ett nytt försök (se readable).
		file = await readable(picked);
		bitmap = await decode(file);
	}
	const meta = await readExif(file);
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

/**
 * Bilden som en kopia i minnet. Androids bildväljare lämnar ibland ut en fil
 * som inte går att läsa direkt (storleken i väljaren stämmer inte med filen);
 * kopian används då även när originalet laddas upp. Görs bara vid fel, så att
 * många bilder på en gång inte fyller mobilens minne.
 */
async function readable(file: File): Promise<File> {
	try {
		const bytes = await file.arrayBuffer();
		return new File([bytes], file.name, { type: file.type || 'image/jpeg', lastModified: file.lastModified });
	} catch {
		// Händer med rörliga bilder (Motion Photo) när man i bildväljaren valt att ta med platsen.
		throw new Error(
			`Mobilen lämnade inte ut ${file.name}. Är det en rörlig bild? Välj den igen och svara "Ta inte med" på frågan om plats; platsen hämtas ändå från Immich.`
		);
	}
}

async function decode(file: File): Promise<ImageBitmap> {
	try {
		return await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		// Reserv: via <img>, som klarar fler varianter i vissa webbläsare.
		const url = URL.createObjectURL(file);
		try {
			const img = new Image();
			img.src = url;
			await img.decode();
			return await createImageBitmap(img);
		} catch {
			throw new Error(`Kan inte läsa ${file.name}. Formatet stöds inte av webbläsaren.`);
		} finally {
			URL.revokeObjectURL(url);
		}
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
): Promise<Pick<PreparedPhoto, 'taken' | 'takenAt' | 'location'>> {
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
		const lat = Number(gps?.latitude);
		const lon = Number(gps?.longitude);
		const location = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
		return {
			...cameraTime(tags?.DateTimeOriginal ?? tags?.CreateDate, tags?.OffsetTimeOriginal ?? tags?.OffsetTime),
			location: hasLocation(location) ? location : null
		};
	} catch {
		return { taken: '', takenAt: '', location: null };
	}
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
