import { error } from '@sveltejs/kit';
import { pb, type Trip } from '$lib/pb';

export async function load({ params }) {
	try {
		return { trip: await pb.collection('trips').getOne<Trip>(params.id) };
	} catch {
		error(404, 'Resan finns inte, eller så har du inte tillgång till den.');
	}
}
