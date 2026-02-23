import { useCallback, useState, type RefObject } from 'react';
import { sharedTexts } from '@/src/shared/texts';
import type { TP2pRoomUiState } from '@/src/shared/types/p2p-room';
import { P2P_ROOM_SERVER_URL } from '../model/p2p-room-config';
import { INITIAL_P2P_ROOM_UI_STATE, mergeUiState } from '../model/p2p-room-ui-state';
import { WebrtcRoomClient } from '../model/webrtc-room-client';
import { useRoomClientLifecycle } from './use-room-client-lifecycle';
import { useVideoElements } from './use-video-elements';

type TP2pRoomController = {
	uiState: TP2pRoomUiState;
	localVideoRef: RefObject<HTMLVideoElement | null>;
	remoteVideoRef: RefObject<HTMLVideoElement | null>;
	joinRoom: () => Promise<void>;
	leaveRoom: () => void;
	toggleMicrophone: () => void;
	toggleCamera: () => void;
};

const roomTexts = sharedTexts.p2pRoom;

export const useP2pRoom = (): TP2pRoomController => {
	const [uiState, setUiState] = useState(INITIAL_P2P_ROOM_UI_STATE);
	const [roomClient] = useState(() => new WebrtcRoomClient(P2P_ROOM_SERVER_URL));

	const {
		localVideoRef,
		remoteVideoRef,
		attachLocalStream,
		attachRemoteStream,
		clearRemoteVideoElement,
		clearVideoElements,
		hasLocalVideoSource,
	} = useVideoElements();

	const patchUiState = useCallback((patch: Partial<TP2pRoomUiState>) => {
		setUiState((previousState) => mergeUiState(previousState, patch));
	}, []);

	const onLocalStream = useCallback(
		(event: Event) => {
			const stream = (event as CustomEvent<MediaStream>).detail;
			attachLocalStream(stream);
			patchUiState({
				isLocalMediaReady: true,
				isMicrophoneEnabled: roomClient.isMicrophoneEnabled() ?? true,
				isCameraEnabled: roomClient.isCameraEnabled() ?? true,
			});
		},
		[attachLocalStream, patchUiState, roomClient],
	);

	const onRemoteStream = useCallback(
		(event: Event) => {
			attachRemoteStream((event as CustomEvent<MediaStream>).detail);
			patchUiState({ hasRemoteParticipant: true });
		},
		[attachRemoteStream, patchUiState],
	);

	const onConnectionStateChange = useCallback(
		(event: Event) => {
			const connectionState = (event as CustomEvent<RTCPeerConnectionState | undefined>).detail;
			if (!connectionState) {
				return;
			}

			patchUiState({
				status: connectionState,
				hasRemoteParticipant: connectionState === 'connected',
			});
		},
		[patchUiState],
	);

	const onRoomState = useCallback(
		(event: Event) => {
			const nextRoomState = (event as CustomEvent<TP2pRoomUiState['roomState']>).detail;
			setUiState((previousState) =>
				mergeUiState(previousState, {
					roomState: nextRoomState,
					hasRemoteParticipant:
						nextRoomState.participants < 2 ? false : previousState.hasRemoteParticipant,
				}),
			);
		},
		[],
	);

	const onRoomFull = useCallback(
		(event: Event) => {
			const reason = (event as CustomEvent<string>).detail ?? roomTexts.genericRoomFullReason;
			patchUiState({
				isJoining: false,
				isRoomJoined: false,
				status: 'room-full',
				errorMessage: `${roomTexts.joinFailedReasonPrefix} ${reason}`,
			});
		},
		[patchUiState],
	);

	const onError = useCallback((_: Event) => {
		patchUiState({ errorMessage: roomTexts.webrtcErrorMessage });
	}, [patchUiState]);

	const onPeerLeft = useCallback(
		(_: Event) => {
			clearRemoteVideoElement();
			patchUiState({
				status: 'waiting-for-peer',
				isJoining: false,
				isRoomJoined: true,
				hasRemoteParticipant: false,
				isLocalMediaReady: hasLocalVideoSource(),
				isMicrophoneEnabled: roomClient.isMicrophoneEnabled() ?? true,
				isCameraEnabled: roomClient.isCameraEnabled() ?? false,
				errorMessage: null,
			});
		},
		[clearRemoteVideoElement, hasLocalVideoSource, patchUiState, roomClient],
	);

	const onCallEnd = useCallback(
		(_: Event) => {
			clearVideoElements();
			setUiState(INITIAL_P2P_ROOM_UI_STATE);
		},
		[clearVideoElements],
	);

	const joinRoom = useCallback(async () => {
		patchUiState({ errorMessage: null, isJoining: true, status: 'connecting' });

		try {
			await roomClient.startCall();
			patchUiState({ isRoomJoined: true, status: 'waiting-for-peer' });
		} catch (error) {
			console.error('Failed to start call', error);
			patchUiState({
				status: 'disconnected',
				errorMessage: roomTexts.joinFailedMessage,
			});
		} finally {
			patchUiState({ isJoining: false });
		}
	}, [patchUiState, roomClient]);

	const leaveRoom = useCallback(() => {
		patchUiState({
			status: 'disconnected',
			errorMessage: null,
			isRoomJoined: false,
			hasRemoteParticipant: false,
			isLocalMediaReady: false,
			isMicrophoneEnabled: true,
			isCameraEnabled: false,
		});
		roomClient.leaveRoom();
	}, [patchUiState, roomClient]);

	const toggleMicrophone = useCallback(() => {
		const nextState = roomClient.toggleMicrophone();
		if (typeof nextState === 'boolean') {
			patchUiState({ isMicrophoneEnabled: nextState });
		}
	}, [patchUiState, roomClient]);

	const toggleCamera = useCallback(() => {
		const nextState = roomClient.toggleCamera();
		if (typeof nextState === 'boolean') {
			patchUiState({ isCameraEnabled: nextState });
		}
	}, [patchUiState, roomClient]);

	useRoomClientLifecycle({
		roomClient,
		handlers: {
			onLocalStream,
			onRemoteStream,
			onConnectionStateChange,
			onRoomState,
			onRoomFull,
			onError,
			onPeerLeft,
			onCallEnd,
		},
	});
	return {
		uiState,
		localVideoRef,
		remoteVideoRef,
		joinRoom,
		leaveRoom,
		toggleMicrophone,
		toggleCamera,
	};
};
