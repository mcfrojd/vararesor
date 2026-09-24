import { pb, type Post, type Trip } from '$lib/pb';
import { sortPosts } from '$lib/posts';

export async function load() {
	const [posts, trips] = await Promise.all([
		pb.collection('posts').getFullList<Post & { expand?: { trip?: Trip } }>({
			filter: 'location.lat != 0 || location.lon != 0',
			sort: 'day,created',
			expand: 'trip'
		}),
		pb.collection('trips').getFullList<Trip>({ filter: 'type = "husbil" && start_date != ""' })
	]);
	return { posts: sortPosts(posts), husbilTrips: trips };
}
