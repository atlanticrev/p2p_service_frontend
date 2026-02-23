import { useEffect } from 'react';

import type { WebrtcRoomClient } from '../model/webrtc-room-client';

type TP2pRoomClientEventHandlers = {
	onLocalStream: (event: Event) => void;
	onRemoteStream: (event: Event) => void;
	onConnectionStateChange: (event: Event) => void;
	onRoomState: (event: Event) => void;
	onRoomFull: (event: Event) => void;
	onError: (event: Event) => void;
	onPeerLeft: (event: Event) => void;
	onCallEnd: (event: Event) => void;
};

type TUseRoomClientLifecycleParams = {
	roomClient: WebrtcRoomClient;
	handlers: TP2pRoomClientEventHandlers;
};

export const useRoomClientLifecycle = ({
	roomClient,
	handlers,
}: TUseRoomClientLifecycleParams) => {
	const {
		onLocalStream,
		onRemoteStream,
		onConnectionStateChange,
		onRoomState,
		onRoomFull,
		onError,
		onPeerLeft,
		onCallEnd,
	} = handlers;

	useEffect(() => {
		roomClient.addEventListener('localStream', onLocalStream);
		roomClient.addEventListener('remoteStream', onRemoteStream);
		roomClient.addEventListener('connectionState', onConnectionStateChange);
		roomClient.addEventListener('roomState', onRoomState);
		roomClient.addEventListener('roomFull', onRoomFull);
		roomClient.addEventListener('error', onError);
		roomClient.addEventListener('peerLeft', onPeerLeft);
		roomClient.addEventListener('endCall', onCallEnd);

		return () => {
			roomClient.removeEventListener('localStream', onLocalStream);
			roomClient.removeEventListener('remoteStream', onRemoteStream);
			roomClient.removeEventListener('connectionState', onConnectionStateChange);
			roomClient.removeEventListener('roomState', onRoomState);
			roomClient.removeEventListener('roomFull', onRoomFull);
			roomClient.removeEventListener('error', onError);
			roomClient.removeEventListener('peerLeft', onPeerLeft);
			roomClient.removeEventListener('endCall', onCallEnd);
		};
	}, [
		onCallEnd,
		onConnectionStateChange,
		onError,
		onLocalStream,
		onPeerLeft,
		onRemoteStream,
		onRoomFull,
		onRoomState,
		roomClient,
	]);

	useEffect(() => {
		void roomClient.init().catch((error) => {
			console.warn('Failed to initialize signaling socket', error);
		});
	}, [roomClient]);

	useEffect(() => {
		const onBeforeUnload = () => {
			roomClient.cleanUp();
		};

		window.addEventListener('beforeunload', onBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload);
		};
	}, [roomClient]);

	useEffect(() => {
		return () => {
			roomClient.cleanUp();
		};
	}, [roomClient]);
};
