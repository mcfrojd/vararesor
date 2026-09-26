import PocketBase from 'pocketbase';
import type { Weather } from './weather';

/** Appen serveras av PocketBase, så API:t ligger på samma adress. */
export const pb = new PocketBase('/');

export type TripType = 'husbil' | 'semester' | 'egen';

export interface Trip {
	id: string;
	collectionId: string;
	collectionName: string;
	title: string;
	type: TripType;
	start_date: string;
	end_date: string;
	description: string;
	cover: string;
	owner: string;
	participants: string[];
	expand?: {
		owner?: User;
		participants?: User[];
	};
}

export type PostKind = 'overnight' | 'food' | 'sight' | 'note';

export interface GeoPoint {
	lat: number;
	lon: number;
}

/** Mallspecifika fält. Vilka som används beror på inläggets typ. */
export interface PostDetails {
	payment?: string;
	facilities?: string[];
	surface?: string;
	view?: string;
	noise?: string;
	what?: string;
	hours?: string;
}

export interface Post {
	id: string;
	collectionId: string;
	collectionName: string;
	trip: string;
	author: string;
	kind: PostKind;
	day: string;
	/** Valfri tid "TT:MM". */
	time: string;
	title: string;
	category: string;
	body: string;
	rating: number;
	price: string;
	location: GeoPoint;
	/** Var positionen kommer ifrån: '' okänt, 'manual' satt av oss, 'photo' från en bild, 'track' från Doris spår. */
	location_source?: '' | 'manual' | 'photo' | 'track';
	details: PostDetails | null;
	/** Väder för dagen och platsen, satt av servern. */
	weather?: Weather | null;
	created: string;
	expand?: {
		author?: User;
		/** Inläggets bilder (bakåtrelation), när de hämtats med expand. */
		photos_via_post?: Photo[];
	};
}

export interface Photo {
	id: string;
	collectionId: string;
	collectionName: string;
	trip: string;
	post: string;
	author: string;
	day: string;
	/** När bilden togs, "ÅÅÅÅ-MM-DD TT:MM", om kameran sparat det. */
	taken: string;
	/** Exakt tidpunkt (UTC) enligt kameran, om den kunde räknas ut. */
	taken_at: string;
	/** Från bildens GPS-data ('exif') eller Doris spår ('track'); 0,0 om den saknas. */
	location: GeoPoint;
	location_source: '' | 'exif' | 'track';
	width: number;
	height: number;
	/** Tomt tills originalet laddats upp. */
	original: string;
	web: string;
	thumb: string;
	created: string;
	expand?: {
		/** Den som laddat upp bilden, när den hämtats med expand. */
		author?: User;
	};
}

export interface User {
	id: string;
	collectionId: string;
	collectionName: string;
	email: string;
	name: string;
	avatar: string;
}

/** Plockar ut fältfelen från ett PocketBase-fel, t.ex. { title: 'Cannot be blank.' }. */
export function fieldErrors(err: unknown): Record<string, string> {
	const data = (err as { response?: { data?: Record<string, { message: string }> } })?.response?.data;
	if (!data) return {};
	return Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.message]));
}
