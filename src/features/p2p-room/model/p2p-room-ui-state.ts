import type { TP2pRoomUiState, TRoomState } from '@/src/shared/types/p2p-room';

export const DEFAULT_ROOM_STATE: TRoomState = {
	participants: 0,
	capacity: 2,
};

export const INITIAL_P2P_ROOM_UI_STATE: TP2pRoomUiState = {
	status: 'disconnected',
	isJoining: false,
	isRoomJoined: false,
	hasRemoteParticipant: false,
	isLocalMediaReady: false,
	isMicrophoneEnabled: true,
	isCameraEnabled: false,
	roomState: DEFAULT_ROOM_STATE,
	errorMessage: null,
};

export const mergeUiState = <TState extends object>(
	previousState: TState,
	patch: Partial<TState>,
): TState => {
	return {
		...previousState,
		...patch,
	};
};
