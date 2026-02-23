import { logIceCandidate, logIceSelectedPairSnapshot } from './webrtc-room-client-ice-debug';

type TbindPeerConnectionEventsParams = {
	peerConnection: RTCPeerConnection;
	sendCandidate: (candidate: RTCIceCandidate) => void;
	onRemoteStream: (stream: MediaStream) => void;
	onConnectionStateChange: (state: RTCPeerConnectionState | undefined) => void;
	onPeerConnected: (peerConnection: RTCPeerConnection) => void;
};

export const bindPeerConnectionEvents = ({
	peerConnection,
	sendCandidate,
	onRemoteStream,
	onConnectionStateChange,
	onPeerConnected,
}: TbindPeerConnectionEventsParams) => {
	peerConnection.addEventListener('track', (event) => {
		console.log('Incoming Remote track:', event.track.kind, event.track.readyState);
		console.log('Incoming streams:', event.streams);

		const remoteStream = event.streams[0];

		remoteStream.getTracks().forEach((track) => {
			track.enabled = true;
		});

		onRemoteStream(remoteStream);
	});

	peerConnection.addEventListener('icecandidate', (event) => {
		if (event.candidate) {
			logIceCandidate('local', event.candidate);
			sendCandidate(event.candidate);
			return;
		}

		console.log('ICE candidate gathering completed');
	});

	peerConnection.addEventListener('icecandidateerror', (event) => {
		console.warn('ICE candidate error', {
			address: event.address,
			port: event.port,
			url: event.url,
			errorCode: event.errorCode,
			errorText: event.errorText,
		});
	});

	peerConnection.addEventListener('icegatheringstatechange', () => {
		console.log('ICE gathering state:', peerConnection.iceGatheringState);
	});

	peerConnection.addEventListener('iceconnectionstatechange', () => {
		console.log('ICE connection state:', peerConnection.iceConnectionState);

		const state = peerConnection.iceConnectionState;
		if (
			state === 'connected' ||
			state === 'completed' ||
			state === 'failed' ||
			state === 'disconnected'
		) {
			void logIceSelectedPairSnapshot(peerConnection, state);
		}
	});

	peerConnection.addEventListener('connectionstatechange', () => {
		console.log('🔗 Connection state:', peerConnection.connectionState);
		console.log('🔗 ICE Connection state:', peerConnection.iceConnectionState);

		onConnectionStateChange(peerConnection.connectionState);

		if (peerConnection.connectionState === 'connected') {
			onPeerConnected(peerConnection);
		}
	});
};
