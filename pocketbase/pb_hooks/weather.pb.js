/// <reference path="../pb_data/types.d.ts" />

// Hämtar väder när ett inlägg skapas eller får ny dag/plats (se weather.js).
// Fel stoppar aldrig sparandet; nattjobbet försöker igen.

onRecordAfterCreateSuccess((e) => {
	e.next();
	try {
		const weather = require(`${__hooks}/weather.js`);
		weather.update(e.app, e.record);
		weather.updateStay(e.app, e.record);
	} catch (err) {
		e.app.logger().warn('Väder kunde inte hämtas', 'post', e.record.id, 'error', String(err));
	}
}, 'posts');

onRecordAfterUpdateSuccess((e) => {
	e.next();
	try {
		const weather = require(`${__hooks}/weather.js`);
		weather.update(e.app, e.record);
		weather.updateStay(e.app, e.record);
	} catch (err) {
		e.app.logger().warn('Väder kunde inte hämtas', 'post', e.record.id, 'error', String(err));
	}
}, 'posts');

// Varje timme: väder som saknas (t.ex. när Open-Meteo inte svarade) och
// prognoser för dagar som nu är över. Högst 30 anrop per körning.
cronAdd('weather', '17 * * * *', () => {
	const n = require(`${__hooks}/weather.js`).backfill($app, 30);
	if (n > 0) $app.logger().info('Väder uppdaterat', 'posts', n);
});
