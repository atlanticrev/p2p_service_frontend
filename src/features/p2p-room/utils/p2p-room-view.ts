import { sharedTexts } from '@/src/shared/texts';
import type { TP2pRoomUiState } from '@/src/shared/types/p2p-room';

type TP2pRoomViewState = {
	statusLabel: string;
	remoteParticipantInRoom: boolean;
	remoteParticipantInCall: boolean;
	isAloneInRoom: boolean;
	waitingOverlayLabel: string;
	exitRoomButtonLabel: string;
	callStateLabel: string;
};

const roomTexts = sharedTexts.p2pRoom;

const getStatusLabel = (uiState: TP2pRoomUiState) => {
	if (uiState.status === 'room-full') {
		return roomTexts.roomBusy;
	}

	if (!uiState.isRoomJoined && uiState.status === 'disconnected') {
		return roomTexts.notInRoom;
	}

	if (uiState.status === 'waiting-for-peer' || uiState.status === 'connecting') {
		return roomTexts.callWaiting;
	}

	if (uiState.status === 'connected') {
		return roomTexts.callConnected;
	}

	return uiState.status;
};

export const buildP2pRoomView = (uiState: TP2pRoomUiState): TP2pRoomViewState => {
	const remoteParticipantInRoom = uiState.isRoomJoined
		? uiState.roomState.participants > 1
		: uiState.roomState.participants > 0;
	
	const remoteParticipantInCall = uiState.hasRemoteParticipant || uiState.status === 'connected';
	
	const isAloneInRoom = uiState.isRoomJoined && uiState.roomState.participants <= 1;
	
	const waitingOverlayLabel =
		uiState.roomState.participants <= 1 ? roomTexts.callWaitingAlone : roomTexts.callWaitingPeerJoin;
	
	const exitRoomButtonLabel = isAloneInRoom ? roomTexts.exitRoomButton : roomTexts.exitCallButton;

	let callStateLabel = roomTexts.callStateWaiting;
	if (remoteParticipantInCall) {
		callStateLabel = roomTexts.callStateConnected;
	} else if (isAloneInRoom) {
		callStateLabel = roomTexts.callStateAlone;
	}

	return {
		statusLabel: getStatusLabel(uiState),
		remoteParticipantInRoom,
		remoteParticipantInCall,
		isAloneInRoom,
		waitingOverlayLabel,
		exitRoomButtonLabel,
		callStateLabel,
	};
};

export type { TP2pRoomViewState };
