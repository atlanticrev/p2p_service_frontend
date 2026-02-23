export const buildWebSocketUrl = (url: string) => {
	try {
		const parsedUrl = new URL(url);

		if (parsedUrl.protocol === 'http:') {
			parsedUrl.protocol = 'ws:';
		}

		if (parsedUrl.protocol === 'https:') {
			parsedUrl.protocol = 'wss:';
		}

		return parsedUrl.toString();
	} catch {
		return url;
	}
};
