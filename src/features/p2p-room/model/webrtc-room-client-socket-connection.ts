import type { TSignalMessage } from './webrtc-room-client-signal';

type TCreateSignalingSocketConnectionParams = {
	webSocketUrl: string;
	onSignalMessage: (message: TSignalMessage) => Promise<void>;
	onSocketClose: () => void;
};

type TSignalingSocketConnection = {
	socket: WebSocket;
	ready: Promise<void>;
};

export const createSignalingSocketConnection = ({
	webSocketUrl,
	onSignalMessage,
	onSocketClose,
}: TCreateSignalingSocketConnectionParams): TSignalingSocketConnection => {
	const socket = new WebSocket(webSocketUrl);

	const ready = new Promise<void>((resolve, reject) => {
		socket.addEventListener('message', async (event) => {
			const data = JSON.parse(event.data) as TSignalMessage;
			await onSignalMessage(data);
		});

		const onOpen = () => {
			resolve();
		};

		const onError = (event: Event) => {
			reject(event);
		};

		socket.addEventListener('open', onOpen, { once: true });
		socket.addEventListener('error', onError, { once: true });
		socket.addEventListener('close', onSocketClose);
	});

	return {
		socket,
		ready,
	};
};
