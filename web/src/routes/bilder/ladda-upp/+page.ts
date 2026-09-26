import { pb, type Photo, type Post, type Trip } from '$lib/pb';
import { sortPosts } from '$lib/posts';

export async function load() {
	const [trips, posts, photos] = await Promise.all([
		pb.collection('trips').getFullList<Trip>({ sort: '-start_date' }),
		pb.collection('posts').getFullList<Post>({ sort: 'day,created' }),
		// Bara det som behövs för att känna igen bilder som redan finns.
		pb.collection('photos').getFullList<Pick<Photo, 'id' | 'taken_at' | 'width' | 'height'>>({
			fields: 'id,taken_at,width,height'
		})
	]);
	return { trips, posts: sortPosts(posts), photos };
}
