/// <reference path="../pb_data/types.d.ts" />

// Position från Doris GPS-spår för bilder och inlägg utan position (se tracks.js).
// Fel stoppar aldrig sparandet; timjobbet försöker igen.

function fillFromTrack(e) {
	e.next();
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
