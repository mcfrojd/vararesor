import PocketBase from 'pocketbase';

/** Appen serveras av PocketBase, så API:t ligger på samma adress. */
export const pb = new PocketBase('/');

export type TripType = 'husbil' | 'semester' | 'egen';

export interface Trip {
	id: string;
	title: string;
	type: TripType;
	start_date: string;
	end_date: string;
	description: string;
	cover: string;
	owner: string;
	participants: string[];
}

export interface User {
	id: string;
	email: string;
	name: string;
}
