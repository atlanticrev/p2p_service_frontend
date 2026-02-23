export type TRoomState = {
	participants: number;
	capacity: number;
};

export type TP2pRoomStatus =
	| RTCPeerConnectionState
	| 'disconnected'
	| 'connecting'
	| 'room-full'
	| 'waiting-for-peer';

export type TP2pRoomUiState = {
	status: TP2pRoomStatus;
	isJoining: boolean;
	isRoomJoined: boolean;
	hasRemoteParticipant: boolean;
	isLocalMediaReady: boolean;
	isMicrophoneEnabled: boolean;
	isCameraEnabled: boolean;
	roomState: TRoomState;
	errorMessage: string | null;
};
