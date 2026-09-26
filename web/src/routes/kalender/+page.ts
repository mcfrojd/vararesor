import { pb, type Photo, type Post, type Trip } from '$lib/pb';
import { sortPosts } from '$lib/posts';

export async function load() {
	const [trips, posts, dayPhotos] = await Promise.all([
		pb.collection('trips').getFullList<Trip>({ sort: 'start_date' }),
		pb.collection('posts').getFullList<Post>({ sort: 'day,created', expand: 'author,photos_via_post' }),
		pb.collection('photos').getFullList<Photo>({ filter: 'trip != "" && post = ""', sort: 'day,taken' })
	]);
	return { trips, posts: sortPosts(posts), dayPhotos };
}
