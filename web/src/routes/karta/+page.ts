import { pb, type Post, type Trip } from '$lib/pb';

export async function load() {
	const posts = await pb.collection('posts').getFullList<Post & { expand?: { trip?: Trip } }>({
		filter: 'location.lat != 0 || location.lon != 0',
		sort: 'day,created',
		expand: 'trip'
	});
	return { posts };
}
