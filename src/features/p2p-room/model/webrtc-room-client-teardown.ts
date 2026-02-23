import { stopStreamTracks } from './webrtc-room-client-media';

type TTeardownEventType = 'endCall' | 'peerLeft' | null;

type TTeardownCallSessionParams = {
	notifyRemote: boolean;
	eventType: TTeardownEventType;
	preserveLocalMedia: boolean;
	logIntervalMs: number | undefined;
	webSocket: WebSocket | null;
	peerConnection: RTCPeerConnection | null;
	localStream: MediaStream | undefined;
	localOutgoingStream: MediaStream | undefined;
	remoteStream: MediaStream | undefined;
	audioContext: AudioContext | null;
	outgoingGainNode: GainNode | null;
	dispatchClientEvent: (eventType: Exclude<TTeardownEventType, null>) => void;
};

type TTeardownCallSessionResult = {
	peerConnection: RTCPeerConnection | null;
	localStream: MediaStream | undefined;
	localOutgoingStream: MediaStream | undefined;
	remoteStream: MediaStream | undefined;
	audioContext: AudioContext | null;
	outgoingGainNode: GainNode | null;
};

export const teardownCallSessionResources = ({
	notifyRemote,
	eventType,
	preserveLocalMedia,
	logIntervalMs,
	webSocket,
	peerConnection,
	localStream,
	localOutgoingStream,
	remoteStream,
	audioContext,
	outgoingGainNode,
	dispatchClientEvent,
}: TTeardownCallSessionParams): TTeardownCallSessionResult => {
	if (typeof window !== 'undefined') {
		window.clearInterval(logIntervalMs);
	}

	const stoppedTrackIds = new Set<string>();
	let nextAudioContext = audioContext;
	let nextLocalStream = localStream;
	let nextLocalOutgoingStream = localOutgoingStream;

	if (!preserveLocalMedia) {
		stopStreamTracks(localOutgoingStream, stoppedTrackIds);
		stopStreamTracks(localStream, stoppedTrackIds);

		if (nextAudioContext) {
			void nextAudioContext.close();
			nextAudioContext = null;
		}

		nextLocalStream = undefined;
		nextLocalOutgoingStream = undefined;
	}

	stopStreamTracks(remoteStream, stoppedTrackIds);

	if (peerConnection) {
		peerConnection.ontrack = null;
		peerConnection.onicecandidate = null;
		peerConnection.close();
	}

	if (notifyRemote && webSocket?.readyState === WebSocket.OPEN) {
		webSocket.send(JSON.stringify({ type: 'hangup' }));
	}

	if (eventType) {
		dispatchClientEvent(eventType);
	}

	return {
		peerConnection: null,
		localStream: nextLocalStream,
		localOutgoingStream: nextLocalOutgoingStream,
		remoteStream: undefined,
		audioContext: nextAudioContext,
		outgoingGainNode: preserveLocalMedia ? outgoingGainNode : null,
	};
};

export type { TTeardownEventType };
