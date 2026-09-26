/// <reference path="../pb_data/types.d.ts" />

// Positioner från Doris GPS-spår för bilder och inlägg som saknar position.
//
// Spåren läggs ut varje morgon som husbilendoris.se/tracks/gpx/doris-ÅÅÅÅ-MM-DD.gpx,
// en fil per svensk kalenderdag, med tid (UTC) på varje punkt. För en bild
// används tidpunkten ur EXIF (taken_at); för ett inlägg dag + tid, tolkat som
// svensk tid. Bara resor av typen husbil, och bara när positionen saknas och
// inte tagits bort med flit (location_source = 'manual').
//
// Obs: spåret visar var Doris var, inte var vi var. Därför märks positionen
// med location_source = 'track' så att appen kan visa det.
//
// Delad modul, som weather.js: hookarna require():ar den.

const GPX_URL = 'https://husbilendoris.se/tracks/gpx/doris-';
const MINUTE = 60 * 1000;
/** Längsta lucka mellan två punkter som det går att räkna fram en position i. */
const MAX_GAP = 45 * MINUTE;
/** Hur långt från närmaste punkt en tidpunkt får ligga utanför spåret. */
const MAX_OUTSIDE = 20 * MINUTE;

function isoDay(ms) {
	return new Date(ms).toISOString().slice(0, 10);
}

/** Sista söndagen i månaden kl. 01:00 UTC (då sommartid börjar/slutar i EU). */
function lastSunday(year, month) {
	const d = new Date(Date.UTC(year, month + 1, 0, 1));
	d.setUTCDate(d.getUTCDate() - d.getUTCDay());
	return d.getTime();
}

/** Svensk tids skillnad mot UTC i timmar vid tidpunkten (1 vinter, 2 sommar). */
function stockholmOffset(ms) {
	const year = new Date(ms).getUTCFullYear();
	return ms >= lastSunday(year, 2) && ms < lastSunday(year, 9) ? 2 : 1;
}

/** Svensk kalenderdag för en tidpunkt, t.ex. för att välja rätt spårfil. */
function stockholmDay(ms) {
	return isoDay(ms + stockholmOffset(ms) * 60 * MINUTE);
}

/** "ÅÅÅÅ-MM-DD" + "TT:MM" i svensk tid → tidpunkt (ms). */
function fromStockholm(day, time) {
	const local = Date.parse(day + 'T' + time + ':00Z');
	if (isNaN(local)) return null;
	// Gissa med vintertid, rätta sedan med den offset som gällde då.
	return local - stockholmOffset(local - 60 * MINUTE) * 60 * MINUTE;
}

/** Läser punkterna i en GPX: [{ lat, lon, t }], sorterade på tid. */
function parseGpx(text) {
	const points = [];
	const re = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
	let m;
	while ((m = re.exec(text))) {
		const time = /<time>([^<]+)<\/time>/.exec(m[3]);
		const t = time ? Date.parse(time[1]) : NaN;
		const lat = parseFloat(m[1]);
		const lon = parseFloat(m[2]);
		if (!isNaN(t) && isFinite(lat) && isFinite(lon)) points.push({ lat: lat, lon: lon, t: t });
	}
	points.sort((a, b) => a.t - b.t);
	return points;
}

/**
 * Spårets punkter för en svensk kalenderdag, eller null om spåret inte finns
 * (än). Sparas en stund i minnet så att flera bilder från samma dag bara ger
 * ett anrop.
 */
function loadDay(app, day) {
	const key = 'doris-gpx:' + day;
	const cached = app.store().get(key);
	if (cached && Date.now() - cached.at < (cached.points ? 6 * 60 : 30) * MINUTE) return cached.points;
	let points = null;
	const res = $http.send({ url: GPX_URL + day + '.gpx', method: 'GET', timeout: 10 });
	// Saknas filen svarar sajten med sin 404-sida i HTML.
	const type = (res.headers && res.headers['Content-Type'] && res.headers['Content-Type'][0]) || '';
	if (res.statusCode === 200 && type.indexOf('gpx') >= 0) points = parseGpx(toString(res.body));
	app.store().set(key, { at: Date.now(), points: points });
	return points;
}

/** Position vid tidpunkten ur punkterna, eller null om spåret inte räcker till. */
function positionAt(points, t) {
	if (!points || points.length === 0) return null;
	const first = points[0];
	const last = points[points.length - 1];
	if (t <= first.t) return first.t - t <= MAX_OUTSIDE ? { lat: first.lat, lon: first.lon } : null;
	if (t >= last.t) return t - last.t <= MAX_OUTSIDE ? { lat: last.lat, lon: last.lon } : null;
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i];
		const b = points[i + 1];
		if (t < a.t || t > b.t) continue;
		const gap = b.t - a.t;
		if (gap > MAX_GAP) {
			// Stor lucka (t.ex. ingen täckning): bara om vi är nära ena änden.
			if (t - a.t <= MAX_OUTSIDE) return { lat: a.lat, lon: a.lon };
			if (b.t - t <= MAX_OUTSIDE) return { lat: b.lat, lon: b.lon };
			return null;
		}
		const f = gap === 0 ? 0 : (t - a.t) / gap;
		return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
	}
	return null;
}

/** Var Doris var vid tidpunkten, eller null. Spår för dagar som inte är över finns inte än. */
function dorisAt(app, t) {
	const day = stockholmDay(t);
	if (day >= stockholmDay(Date.now())) return null;
	return positionAt(loadDay(app, day), t);
}

function hasLocation(record) {
	const loc = record.get('location');
	return !!loc && (loc.lat !== 0 || loc.lon !== 0);
}

function isHusbil(app, record) {
	try {
		return app.findRecordById('trips', record.getString('trip')).getString('type') === 'husbil';
	} catch (_) {
		return false;
	}
}

/** Tidpunkten som ska slås upp i spåret, eller null om posten inte ska fyllas i. */
function wantedTime(record) {
	if (hasLocation(record)) return null;
	const collection = record.collection().name;
	if (collection === 'photos') {
		if (record.getString('location_source')) return null;
		const at = Date.parse(record.getString('taken_at').replace(' ', 'T'));
		return isNaN(at) ? null : at;
	}
	if (collection === 'posts') {
		if (record.getString('location_source') === 'manual') return null;
		const time = record.getString('time');
		if (!time) return null;
		return fromStockholm(record.getString('day').slice(0, 10), time);
	}
	return null;
}

/** Sätter position från spåret om det går. Sant om posten ändrades. */
function fill(app, record) {
	const t = wantedTime(record);
	if (t === null || !isHusbil(app, record)) return false;
	const at = dorisAt(app, t);
	if (!at) return false;
	record.set('location', { lat: Math.round(at.lat * 1e6) / 1e6, lon: Math.round(at.lon * 1e6) / 1e6 });
	record.set('location_source', 'track');
	app.unsafeWithoutHooks().save(record);
	// Inlägg med ny position får väder.
	if (record.collection().name === 'posts') {
		try {
			require(`${__hooks}/weather.js`).update(app, record);
		} catch (err) {
			app.logger().warn('Väder kunde inte hämtas', 'post', record.id, 'error', String(err));
		}
	}
	return true;
}

/**
 * Timjobb: försök igen för bilder och inlägg från den senaste veckan som
 * saknar position (spåret kommer dagen efter). Äldre poster försöks när de
 * sparas, eftersom deras spår redan finns.
 */
function backfill(app, limit) {
	const since = isoDay(Date.now() - 8 * 24 * 60 * MINUTE);
	const lists = [
		app.findRecordsByFilter(
			'photos',
			"location.lat = 0 && location.lon = 0 && location_source = '' && taken_at != '' && day >= {:since}",
			'-day',
			500,
			0,
			{ since: since }
		),
		app.findRecordsByFilter(
			'posts',
			"location.lat = 0 && location.lon = 0 && location_source != 'manual' && time != '' && day >= {:since}",
			'-day',
			500,
			0,
			{ since: since }
		)
	];
	let done = 0;
	for (const records of lists) {
		for (const record of records) {
			if (done >= limit) return done;
			try {
				if (fill(app, record)) done++;
			} catch (err) {
				app.logger().warn('Position från spåret misslyckades', 'id', record.id, 'error', String(err));
			}
		}
	}
	return done;
}

module.exports = { fill, backfill, positionAt, parseGpx, fromStockholm, stockholmDay };
