/// <reference path="../pb_data/types.d.ts" />

// Väder för inlägg från Open-Meteo (gratis, ingen API-nyckel). Hämtas av
// servern och sparas på inlägget i fältet `weather`, så att det bara hämtas en
// gång. Dagar som inte är över än får en prognos (final = false) som byts ut
// mot riktiga värden av nattjobbet i weather.pb.js.
//
// Delad modul: PocketBase kör varje hook isolerat, så hookarna måste
// require():a den här filen i stället för att dela funktioner direkt.

const DAILY = 'temperature_2m_min,temperature_2m_max,temperature_2m_mean,weather_code,precipitation_sum';

function isoDay(date) {
	return date.toISOString().slice(0, 10);
}

function addDays(day, n) {
	const d = new Date(day + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + n);
	return isoDay(d);
}

function round(n, digits) {
	const f = Math.pow(10, digits);
	return Math.round(n * f) / f;
}

/** Plats och dag för inlägget, eller null om det saknar position. */
function target(record) {
	const loc = record.get('location');
	const lat = loc ? loc.lat : 0;
	const lon = loc ? loc.lon : 0;
	if (!lat && !lon) return null;
	return { lat: round(lat, 4), lon: round(lon, 4), day: record.getString('day').slice(0, 10) };
}

function current(record) {
	try {
		return JSON.parse(record.getString('weather') || 'null');
	} catch (_) {
		return null;
	}
}

/** Behöver inlägget (nytt) väder? */
function needsWeather(record, today) {
	const t = target(record);
	if (!t) return false;
	// Open-Meteo har prognoser 16 dagar framåt; längre fram finns inget att hämta.
	if (t.day > addDays(today, 15)) return false;
	const w = current(record);
	if (!w) return true;
	if (w.day !== t.day || w.lat !== t.lat || w.lon !== t.lon) return true;
	return !w.final && t.day < today;
}

/** Hämtar dagens väder för platsen. Kastar vid fel. */
function fetchWeather(t, today) {
	// Prognos-API:t har ungefär 90 dagar bakåt; äldre dagar finns i arkivet.
	const base =
		t.day < addDays(today, -80)
			? 'https://archive-api.open-meteo.com/v1/archive'
			: 'https://api.open-meteo.com/v1/forecast';
	const url =
		base +
		'?latitude=' + t.lat +
		'&longitude=' + t.lon +
		'&daily=' + DAILY +
		'&start_date=' + t.day +
		'&end_date=' + t.day +
		'&timezone=auto';
	const res = $http.send({ url: url, method: 'GET', timeout: 8 });
	if (res.statusCode !== 200 || !res.json || !res.json.daily) {
		throw new Error('Open-Meteo svarade ' + res.statusCode);
	}
	const d = res.json.daily;
	const pick = (key) => (d[key] && d[key][0] !== null && d[key][0] !== undefined ? d[key][0] : null);
	if (pick('temperature_2m_max') === null) throw new Error('Inget väder för ' + t.day);
	return {
		min: pick('temperature_2m_min'),
		max: pick('temperature_2m_max'),
		mean: pick('temperature_2m_mean'),
		code: pick('weather_code'),
		precip: pick('precipitation_sum'),
		day: t.day,
		lat: t.lat,
		lon: t.lon,
		// Dagen är över (med marginal för tidszoner): värdena ändras inte mer.
		final: t.day < addDays(today, -1)
	};
}

/** Uppdaterar vädret på inlägget om det behövs. Sparar utan att trigga hookar igen. */
function update(app, record) {
	const today = isoDay(new Date());
	if (!needsWeather(record, today)) {
		// Positionen togs bort: ta bort gammalt väder också.
		if (!target(record) && current(record)) {
			record.set('weather', null);
			app.unsafeWithoutHooks().save(record);
		}
		return false;
	}
	record.set('weather', fetchWeather(target(record), today));
	app.unsafeWithoutHooks().save(record);
	return true;
}

// ---- Boenden över flera nätter: väder för dagarna efter incheckningen.

function jsonField(record, name) {
	try {
		return JSON.parse(record.getString(name) || 'null');
	} catch (_) {
		return null;
	}
}

/** Plats och dagar (dagen efter incheckning t.o.m. utcheckning) för ett boende, eller null. */
function stayTarget(record) {
	if (record.getString('kind') !== 'overnight') return null;
	const until = String((jsonField(record, 'details') || {}).until || '').slice(0, 10);
	const t = target(record);
	if (!t || !until || until <= t.day) return null;
	return { lat: t.lat, lon: t.lon, from: addDays(t.day, 1), to: until };
}

/** Dagarna som går att hämta nu (prognosen räcker 16 dagar framåt). */
function wantedDays(st, today) {
	const days = [];
	const last = addDays(today, 15);
	for (let d = st.from; d <= st.to && d <= last; d = addDays(d, 1)) days.push(d);
	return days;
}

function needsStayWeather(record, today) {
	const st = stayTarget(record);
	const cur = jsonField(record, 'stay_weather');
	if (!st) return !!cur;
	if (!cur || cur.lat !== st.lat || cur.lon !== st.lon || cur.from !== st.from || cur.to !== st.to) return true;
	return wantedDays(st, today).some((d) => {
		const w = (cur.days || {})[d];
		return !w || (!w.final && d < today);
	});
}

/** Hämtar väder för flera dagar; äldre dagar från arkivet, resten från prognos-API:t. */
function fetchDays(lat, lon, days, today) {
	const out = {};
	const cut = addDays(today, -80);
	const groups = [days.filter((d) => d < cut), days.filter((d) => d >= cut)];
	for (let i = 0; i < groups.length; i++) {
		const g = groups[i];
		if (!g.length) continue;
		const base = i === 0 ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
		const url =
			base + '?latitude=' + lat + '&longitude=' + lon + '&daily=' + DAILY +
			'&start_date=' + g[0] + '&end_date=' + g[g.length - 1] + '&timezone=auto';
		const res = $http.send({ url: url, method: 'GET', timeout: 10 });
		if (res.statusCode !== 200 || !res.json || !res.json.daily) throw new Error('Open-Meteo svarade ' + res.statusCode);
		const d = res.json.daily;
		(d.time || []).forEach((day, j) => {
			const v = (key) => (d[key] && d[key][j] !== null && d[key][j] !== undefined ? d[key][j] : null);
			if (v('temperature_2m_max') === null) return;
			out[day] = {
				min: v('temperature_2m_min'),
				max: v('temperature_2m_max'),
				mean: v('temperature_2m_mean'),
				code: v('weather_code'),
				precip: v('precipitation_sum'),
				final: day < addDays(today, -1)
			};
		});
	}
	return out;
}

/** Uppdaterar vädret för boendets nätter om det behövs. Sparar utan hookar. */
function updateStay(app, record) {
	const today = isoDay(new Date());
	if (!needsStayWeather(record, today)) return false;
	const st = stayTarget(record);
	if (!st) {
		record.set('stay_weather', null);
		app.unsafeWithoutHooks().save(record);
		return true;
	}
	const days = wantedDays(st, today);
	record.set('stay_weather', {
		lat: st.lat,
		lon: st.lon,
		from: st.from,
		to: st.to,
		days: days.length ? fetchDays(st.lat, st.lon, days, today) : {}
	});
	app.unsafeWithoutHooks().save(record);
	return true;
}

/** Nattjobb: fyll i väder som saknas och byt prognoser mot riktiga värden. */
function backfill(app, limit) {
	const today = isoDay(new Date());
	const records = app.findRecordsByFilter(
		'posts',
		'location.lat != 0 || location.lon != 0',
		'-day',
		1000,
		0
	);
	let done = 0;
	for (const record of records) {
		if (done >= limit) break;
		if (!needsWeather(record, today) && !needsStayWeather(record, today)) continue;
		try {
			update(app, record);
			updateStay(app, record);
			done++;
		} catch (err) {
			app.logger().warn('Väder kunde inte hämtas', 'post', record.id, 'error', String(err));
		}
	}
	return done;
}

/** Boenden som saknar väder för sina nätter (t.ex. direkt efter en uppdatering av appen). */
function backfillStays(app, limit) {
	const today = isoDay(new Date());
	const records = app.findRecordsByFilter(
		'posts',
		"kind = 'overnight' && (location.lat != 0 || location.lon != 0)",
		'-day',
		500,
		0
	);
	let done = 0;
	for (const record of records) {
		if (done >= limit) break;
		if (!needsStayWeather(record, today)) continue;
		try {
			updateStay(app, record);
			done++;
		} catch (err) {
			app.logger().warn('Väder kunde inte hämtas', 'post', record.id, 'error', String(err));
		}
	}
	return done;
}

module.exports = { update, updateStay, backfill, backfillStays, needsWeather };
