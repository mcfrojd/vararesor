/// <reference path="../pb_data/types.d.ts" />

// Position för bilder (Immich, se immich.js, annars Doris spår) och för inlägg
// utan position (Doris spår, se tracks.js).
// Fel stoppar aldrig sparandet; timjobbet försöker igen.

function fillFromTrack(e) {
	e.next();
	// Bilder: först den riktiga platsen från Immich, annars Doris spår.
	if (e.record.collection().name === 'photos') {
		try {
			if (require(`${__hooks}/immich.js`).fill(e.app, e.record)) return;
		} catch (err) {
			e.app.logger().warn('Immich: kunde inte slå upp bilden', 'id', e.record.id, 'error', String(err));
		}
	}
	try {
		require(`${__hooks}/tracks.js`).fill(e.app, e.record);
	} catch (err) {
		e.app.logger().warn('Position från spåret misslyckades', 'id', e.record.id, 'error', String(err));
	}
}

onRecordAfterCreateSuccess(fillFromTrack, 'photos', 'posts');
onRecordAfterUpdateSuccess(fillFromTrack, 'photos', 'posts');

// Varje timme: spåren för gårdagen kommer på morgonen, så poster från de
// senaste dagarna får sin position när spåret finns. Högst 50 per körning.
cronAdd('tracks', '23 * * * *', () => {
	const n = require(`${__hooks}/tracks.js`).backfill($app, 50);
	if (n > 0) $app.logger().info('Positioner från Doris spår', 'antal', n);
});

// Var 15:e minut: bilder som ännu inte finns i Immich (mobilen säkerhetskopierar
// när den hinner). Bilder som inte hittas försöks igen efter 6 timmar.
cronAdd('immich', '*/15 * * * *', () => {
	const n = require(`${__hooks}/immich.js`).backfill($app, 200);
	if (n > 0) $app.logger().info('Positioner från Immich', 'antal', n);
});
