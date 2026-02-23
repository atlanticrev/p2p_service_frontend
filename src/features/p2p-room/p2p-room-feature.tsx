'use client';

import { clsx } from '@/src/lib/clsx';

import { P2pRoomCall } from './components/p2p-room-call';
import { P2pRoomLobby } from './components/p2p-room-lobby';
import { useP2pRoom } from './hooks/use-p2p-room';
import styles from './p2p-room-feature.module.scss';
import { buildP2pRoomView } from './utils/p2p-room-view';

export const P2pRoomFeature = () => {
	const { uiState, localVideoRef, remoteVideoRef, joinRoom, leaveRoom, toggleMicrophone, toggleCamera } =
		useP2pRoom();

	const viewState = buildP2pRoomView(uiState);

	const pageClassName = clsx(styles.page, uiState.isRoomJoined ? styles.pageCall : styles.pageLobby);

	if (uiState.isRoomJoined) {
		return (
			<main className={pageClassName}>
				<P2pRoomCall
					localVideoRef={localVideoRef}
					remoteVideoRef={remoteVideoRef}
					remoteParticipantInCall={viewState.remoteParticipantInCall}
					waitingOverlayLabel={viewState.waitingOverlayLabel}
					callStateLabel={viewState.callStateLabel}
					isLocalMediaReady={uiState.isLocalMediaReady}
					isMicrophoneEnabled={uiState.isMicrophoneEnabled}
					isCameraEnabled={uiState.isCameraEnabled}
					exitRoomButtonLabel={viewState.exitRoomButtonLabel}
					onToggleMicrophone={toggleMicrophone}
					onToggleCamera={toggleCamera}
					onLeaveRoom={leaveRoom}
				/>
			</main>
		);
	}

	return (
		<main className={pageClassName}>
			<P2pRoomLobby
				roomState={uiState.roomState}
				isJoining={uiState.isJoining}
				remoteParticipantInRoom={viewState.remoteParticipantInRoom}
				statusLabel={viewState.statusLabel}
				errorMessage={uiState.errorMessage}
				onJoinRoom={joinRoom}
			/>
		</main>
	);
};
