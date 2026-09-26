/// <reference path="../pb_data/types.d.ts" />

// Bildens riktiga position från Immich på NAS:en.
//
// Android tar bort GPS ur bilder som laddas upp från webben, men Immichs
// mobilapp säkerhetskopierar originalen med platsen kvar. Servern letar upp
// samma bild i uppladdarens Immich (tagen på samma sekund, samma storlek) och
// tar platsen därifrån. Det går före Doris spår.
//
//   IMMICH_URL        t.ex. http://100.114.28.40:2283
//   IMMICH_API_KEYS   e-post:nyckel per person, kommaseparerat. Nyckeln skapas
//                     i Immich (Kontoinställningar → API-nycklar) och behöver
//                     bara behörigheten asset.read.

const WINDOW_MS = 2000; // kamerans tid har sekunder, Immich ibland millisekunder
// Hittades inte: nya bilder försöks snart igen (mobilen säkerhetskopierar när
// den hinner), äldre var sjätte timme.
const MISS_TTL_NEW_MS = 20 * 60 * 1000;
const MISS_TTL_OLD_MS = 6 * 60 * 60 * 1000;
const NEW_MS = 2 * 24 * 60 * 60 * 1000;

function config() {
	const url = ($os.getenv('IMMICH_URL') || '').trim().replace(/\/+$/, '');
	const keys = {};
	for (const pair of ($os.getenv('IMMICH_API_KEYS') || '').split(',')) {
		const i = pair.lastIndexOf(':');
		if (i > 0) keys[pair.slice(0, i).trim().toLowerCase()] = pair.slice(i + 1).trim();
	}
	return { url, keys };
}

/** Uppladdarens Immich-nyckel, eller tomt. */
function keyFor(app, cfg, userId) {
	try {
		return cfg.keys[app.findRecordById('users', userId).getString('email').toLowerCase()] || '';
	} catch (_) {
		return '';
	}
}

/** Bilden ska slås upp: har tid, och platsen kommer inte redan från bilden själv. */
function wanted(photo) {
	const source = photo.getString('location_source');
	return source !== 'exif' && source !== 'immich' && !!photo.getString('taken_at');
}

/** Platsen för samma bild i Immich, eller null. Kastar om Immich inte svarar. */
function lookup(cfg, key, photo) {
	const t = Date.parse(photo.getString('taken_at').replace(' ', 'T'));
	if (isNaN(t)) return null;
	const res = $http.send({
		url: `${cfg.url}/api/search/metadata`,
		method: 'POST',
		headers: { 'x-api-key': key, 'content-type': 'application/json', accept: 'application/json' },
		body: JSON.stringify({
			takenAfter: new Date(t - WINDOW_MS).toISOString(),
			takenBefore: new Date(t + WINDOW_MS).toISOString(),
			type: 'IMAGE',
			withExif: true,
			size: 20
		}),
		timeout: 15
	});
	if (res.statusCode !== 200) throw new Error(`Immich svarade ${res.statusCode}`);
	const items = (res.json && res.json.assets && res.json.assets.items) || [];
	const w = photo.getInt('width');
	const h = photo.getInt('height');
	let best = null;
	for (const asset of items) {
		const exif = asset.exifInfo || {};
		const lat = Number(exif.latitude);
		const lon = Number(exif.longitude);
		if (!isFinite(lat) || !isFinite(lon) || exif.latitude === null || (lat === 0 && lon === 0)) continue;
		// Samma storlek (i någon riktning) går före en bild som bara har samma tid.
		const sizes = [
			[exif.exifImageWidth, exif.exifImageHeight],
			[asset.width, asset.height]
		];
		const sameSize = sizes.some(([a, b]) => (a === w && b === h) || (a === h && b === w));
		const dt = Math.abs(Date.parse(exif.dateTimeOriginal || asset.fileCreatedAt) - t);
		const score = (sameSize ? 0 : 10000) + (isNaN(dt) ? 5000 : dt);
		if (!best || score < best.score) best = { score, lat, lon };
	}
	return best ? { lat: Math.round(best.lat * 1e6) / 1e6, lon: Math.round(best.lon * 1e6) / 1e6 } : null;
}

/**
 * Inläggets position från dess första bild med riktig plats, om inläggets
 * position bara kom från Doris spår (eller saknas). Satta positioner rörs inte.
 */
function refreshPost(app, postId) {
	if (!postId) return;
	const post = app.findRecordById('posts', postId);
	const source = post.getString('location_source');
	const loc = post.get('location');
	const empty = !loc || (loc.lat === 0 && loc.lon === 0);
	if (source !== 'track' && !(empty && source !== 'manual')) return;
	const photos = app.findRecordsByFilter(
		'photos',
		"post = {:post} && (location_source = 'immich' || location_source = 'exif')",
		'taken_at',
		1,
		0,
		{ post: postId }
	);
	if (!photos.length) return;
	post.set('location', photos[0].get('location'));
	post.set('location_source', 'photo');
	app.unsafeWithoutHooks().save(post);
	try {
		require(`${__hooks}/weather.js`).update(app, post);
	} catch (err) {
		app.logger().warn('Väder kunde inte hämtas', 'post', post.id, 'error', String(err));
	}
}

/**
 * Slår upp bilden i Immich och sätter platsen. Sant om den hittades.
 * Kastar vid fel mot Immich (anroparen loggar och försöker senare).
 */
function fill(app, photo) {
	const cfg = config();
	if (!cfg.url || !wanted(photo)) return false;
	const key = keyFor(app, cfg, photo.getString('author'));
	if (!key) return false;
	const missKey = `immich-miss-${photo.id}`;
	const missed = app.store().get(missKey);
	const created = Date.parse(photo.getString('created').replace(' ', 'T'));
	const ttl = Date.now() - created < NEW_MS ? MISS_TTL_NEW_MS : MISS_TTL_OLD_MS;
	if (missed && Date.now() - missed < ttl) return false;
	const at = lookup(cfg, key, photo);
	if (!at) {
		app.store().set(missKey, Date.now());
		return false;
	}
	photo.set('location', at);
	photo.set('location_source', 'immich');
	app.unsafeWithoutHooks().save(photo);
	refreshPost(app, photo.getString('post'));
	return true;
}

/** Timjobb: bilder som ännu inte hittats (mobilen kanske inte säkerhetskopierat än). */
function backfill(app, limit) {
	if (!config().url) return 0;
	const photos = app.findRecordsByFilter(
		'photos',
		"location_source != 'exif' && location_source != 'immich' && taken_at != ''",
		'-taken_at',
		limit,
		0
	);
	let n = 0;
	for (const photo of photos) {
		try {
			if (fill(app, photo)) n++;
		} catch (err) {
			app.logger().warn('Immich: kunde inte slå upp bilden', 'id', photo.id, 'error', String(err));
			break; // Immich svarar inte; försök nästa gång
		}
	}
	return n;
}

module.exports = { fill, backfill, lookup, config };
