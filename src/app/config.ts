export const SERVER_URL = 'https://p2p-service-backend.onrender.com';

export const STUN_SERVERS = {
	urls: ['stun:fr-turn7.xirsys.com'],
};

export const TURN_SERVERS = {
	username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME,
	credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL,
	urls: [
		'turn:fr-turn7.xirsys.com:80?transport=udp',
		'turn:fr-turn7.xirsys.com:3478?transport=udp',
		'turn:fr-turn7.xirsys.com:80?transport=tcp',
		'turn:fr-turn7.xirsys.com:3478?transport=tcp',
		'turns:fr-turn7.xirsys.com:443?transport=tcp',
		'turns:fr-turn7.xirsys.com:5349?transport=tcp',
	],
};

export const IS_TURN_SERVERS_USED = false;
