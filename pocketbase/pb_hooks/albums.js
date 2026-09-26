/// <reference path="../pb_data/types.d.ts" />

// Okategoriserade bilder (utan resa) läggs i en resa när datumet stämmer:
// bildens dag ligger inom resans datum, och den som laddat upp bilden är
// ägare eller deltagare. Bilden hamnar under dagen ("dagens bilder"), inte i
// ett inlägg. Sparas med hookar, så att positionen från Doris spår fylls i.

const day = (value) => String(value || '').slice(0, 10);

/** Resan som en okategoriserad bild hör till, eller null. */
function tripFor(app, photo) {
	const d = day(photo.getString('day'));
	if (!d) return null;
	const author = photo.getString('author');
	const found = app.findRecordsByFilter(
		'trips',
		'start_date != "" && end_date != "" && start_date <= {:end} && end_date >= {:start}' +
			' && (owner = {:author} || participants.id ?= {:author})',
		'start_date',
		1,
		0,
		{ start: `${d} 00:00:00.000Z`, end: `${d} 23:59:59.999Z`, author }
	);
	return found.length ? found[0] : null;
}

/** En nyss uppladdad bild utan resa: finns det redan en resa som passar? */
function placePhoto(app, photo) {
	if (photo.getString('trip')) return false;
	const trip = tripFor(app, photo);
	if (!trip) return false;
	photo.set('trip', trip.id);
	photo.set('post', '');
	app.save(photo);
	return true;
}

/** En resa skapad eller ändrad: hämta de okategoriserade bilder som passar. Ger antalet. */
function adopt(app, trip) {
	const start = day(trip.getString('start_date'));
	const end = day(trip.getString('end_date'));
	if (!start || !end) return 0;
	const people = [trip.getString('owner'), ...trip.getStringSlice('participants')];
	const photos = app.findRecordsByFilter(
		'photos',
		'trip = "" && day >= {:start} && day <= {:end}',
		'day',
		1000,
		0,
		{ start: `${start} 00:00:00.000Z`, end: `${end} 23:59:59.999Z` }
	);
	let n = 0;
	for (const photo of photos) {
		if (!people.includes(photo.getString('author'))) continue;
		photo.set('trip', trip.id);
		photo.set('post', '');
		app.save(photo);
		n++;
	}
	return n;
}

module.exports = { tripFor, placePhoto, adopt };
