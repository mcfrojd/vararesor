import { error } from '@sveltejs/kit';
import { pb, type Photo, type Trip } from '$lib/pb';

/** Ett album: en resas bilder, eller de okategoriserade (id "okategoriserat"). */
export async function load({ params }) {
	try {
		if (params.id === 'okategoriserat') {
			const [trips, photos] = await Promise.all([
				pb.collection('trips').getFullList<Trip>({ sort: '-start_date' }),
				pb.collection('photos').getFullList<Photo>({ filter: 'trip = ""', sort: 'day,taken,created' })
			]);
			return { trip: null, trips, photos };
		}
		const [trip, photos] = await Promise.all([
			pb.collection('trips').getOne<Trip>(params.id),
			pb.collection('photos').getFullList<Photo>({
				filter: pb.filter('trip = {:trip}', { trip: params.id }),
				sort: 'day,taken,created'
			})
		]);
		return { trip, trips: [] as Trip[], photos };
	} catch {
		error(404, 'Albumet finns inte, eller så har du inte tillgång till det.');
	}
}
