import { pb, type Photo, type Post, type Trip } from '$lib/pb';
import { sortPosts } from '$lib/posts';

export async function load() {
	const [posts, trips, photos] = await Promise.all([
		pb.collection('posts').getFullList<Post & { expand?: { trip?: Trip } }>({
			filter: 'location.lat != 0 || location.lon != 0',
			sort: 'day,created',
			expand: 'trip'
		}),
		pb.collection('trips').getFullList<Trip>({ filter: 'type = "husbil" && start_date != ""' }),
		// Bilder med egen position, eller vars inlägg har en.
		pb.collection('photos').getFullList<Photo & { expand?: { post?: Post; trip?: Trip } }>({
			filter:
				'location.lat != 0 || location.lon != 0 || post.location.lat != 0 || post.location.lon != 0',
			sort: 'day,taken',
			expand: 'post,trip'
		})
	]);
	return { posts: sortPosts(posts), husbilTrips: trips, photos };
}
