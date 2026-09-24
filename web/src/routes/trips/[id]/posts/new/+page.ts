import { error } from '@sveltejs/kit';
import { pb, type Trip } from '$lib/pb';

export async function load({ params }) {
	try {
		// Samma anrop som resans sida, så att svaret finns i offline-cachen.
		return {
			trip: await pb.collection('trips').getOne<Trip>(params.id, { expand: 'owner,participants' })
		};
	} catch {
		error(404, 'Resan finns inte, eller så har du inte tillgång till den.');
	}
}
