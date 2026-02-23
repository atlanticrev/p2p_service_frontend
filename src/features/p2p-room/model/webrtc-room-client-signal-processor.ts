import { logIceCandidate } from './webrtc-room-client-ice-debug';
import type { TSignalMessage } from './webrtc-room-client-signal';

type TProcessSignalMessageContext = {
	ensurePeerConnection: () => RTCPeerConnection;
	getPeerConnection: () => RTCPeerConnection | null;
	hasLocalStream: () => boolean;
	createLocalStream: () => Promise<void>;
	attachExistingLocalTracks: () => void;
	onPeerHangup: () => void;
	onStartOffer: () => Promise<void>;
	sendSignalMessage: (message: unknown) => void;
	emitRoomState: (roomState: { participants: number; capacity: number }) => void;
	emitRoomFull: (message: string) => void;
	emitStatus: (message: string) => void;
	emitSignalingError: (message: string) => void;
};

export const processSignalMessage = async (
	data: TSignalMessage,
	context: TProcessSignalMessageContext,
) => {
	if (data.type === 'roomState') {
		context.emitRoomState({
			participants: data.participants,
			capacity: data.capacity,
		});
		return;
	}

	if (data.type === 'roomFull') {
		context.emitRoomFull(data.message ?? 'Room is full');
		return;
	}

	if (data.type === 'status') {
		context.emitStatus(data.message);
		return;
	}

	if (data.type === 'error') {
		context.emitSignalingError(data.message ?? 'Signaling server error');
		return;
	}

	if (data.type === 'hangup') {
		context.onPeerHangup();
		return;
	}

	if (data.type === 'startOffer') {
		await context.onStartOffer();
		return;
	}

	if (data.type === 'offer') {
		const peerConnection = context.ensurePeerConnection();

		if (!context.hasLocalStream()) {
			await context.createLocalStream();
		}

		context.attachExistingLocalTracks();
		await peerConnection.setRemoteDescription(data.offer);

		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);

		console.log('ANSWER SDP:', peerConnection.localDescription?.sdp);
		context.sendSignalMessage({
			type: 'answer',
			answer,
		});
		return;
	}

	if (data.type === 'answer') {
		await context.getPeerConnection()?.setRemoteDescription(data.answer);
		return;
	}

	if (data.type === 'candidate') {
		logIceCandidate('remote', data.candidate);
		await context.getPeerConnection()?.addIceCandidate(data.candidate);
	}
};

export type { TProcessSignalMessageContext };
