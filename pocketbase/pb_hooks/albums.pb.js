/// <reference path="../pb_data/types.d.ts" />

// Okategoriserade bilder flyttas in i resor med rätt datum (se albums.js).
// Fel stoppar aldrig sparandet.

onRecordAfterCreateSuccess((e) => {
	e.next();
	try {
		require(`${__hooks}/albums.js`).placePhoto(e.app, e.record);
	} catch (err) {
		e.app.logger().warn('Kunde inte lägga bilden i en resa', 'id', e.record.id, 'error', String(err));
	}
}, 'photos');

function adoptPhotos(e) {
	e.next();
	try {
		const n = require(`${__hooks}/albums.js`).adopt(e.app, e.record);
		if (n > 0) e.app.logger().info('Okategoriserade bilder till resan', 'resa', e.record.id, 'antal', n);
	} catch (err) {
		e.app.logger().warn('Kunde inte hämta okategoriserade bilder', 'resa', e.record.id, 'error', String(err));
	}
}

onRecordAfterCreateSuccess(adoptPhotos, 'trips');
onRecordAfterUpdateSuccess(adoptPhotos, 'trips');
