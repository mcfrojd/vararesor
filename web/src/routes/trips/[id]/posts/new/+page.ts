import { error } from '@sveltejs/kit';
import { pb, type Photo, type Trip } from '$lib/pb';

export async function load({ params }) {
	try {
		// Samma anrop som resans sida, så att svaren finns i offline-cachen.
		const [trip, dayPhotos] = await Promise.all([
			pb.collection('trips').getOne<Trip>(params.id, { expand: 'owner,participants' }),
			// Dagens bilder, att välja bland i det nya inlägget.
			pb.collection('photos').getFullList<Photo>({
				filter: pb.filter('trip = {:trip} && post = ""', { trip: params.id }),
				sort: 'day,taken'
			})
		]);
		return { trip, dayPhotos };
	} catch {
		error(404, 'Resan finns inte, eller så har du inte tillgång till den.');
	}
}
