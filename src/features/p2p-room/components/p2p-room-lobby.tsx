'use client';

import { PhoneCall } from 'lucide-react';

import { sharedTexts } from '@/src/shared/texts';
import type { TRoomState } from '@/src/shared/types/p2p-room';

import styles from './p2p-room-lobby.module.scss';

type TP2pRoomLobbyProps = {
	roomState: TRoomState;
	isJoining: boolean;
	remoteParticipantInRoom: boolean;
	statusLabel: string;
	errorMessage: string | null;
	onJoinRoom: () => Promise<void>;
};

const roomTexts = sharedTexts.p2pRoom;

export const P2pRoomLobby = ({
	roomState,
	isJoining,
	remoteParticipantInRoom,
	statusLabel,
	errorMessage,
	onJoinRoom,
}: TP2pRoomLobbyProps) => {
	const joinButtonLabel = isJoining ? roomTexts.joiningButton : roomTexts.joinButton;
	const youStateLabel = isJoining ? roomTexts.youConnecting : roomTexts.youDisconnected;
	const peerStateLabel = remoteParticipantInRoom ? roomTexts.peerInRoom : roomTexts.peerRoomEmpty;

	const handleJoinRoomClick = () => {
		void onJoinRoom();
	};

	return (
		<section className={styles.card}>
			<div className={styles.header}>
				<p className={styles.roomLabel}>{roomTexts.roomLabel}</p>

				<h1 className={styles.roomTitle}>{roomTexts.roomTitle}</h1>
			</div>

			<p className={styles.roomHint}>
				{roomTexts.roomHintPrefix} {roomState.participants} / {roomState.capacity}
			</p>

			<div className={styles.peopleList}>
				<div className={styles.personCard}>
					<p className={styles.personName}>{roomTexts.youLabel}</p>

					<p className={styles.personState}>{youStateLabel}</p>
				</div>

				<div className={styles.personCard}>
					<p className={styles.personName}>{roomTexts.peerLabel}</p>

					<p className={styles.personState}>{peerStateLabel}</p>
				</div>
			</div>

			<div className={styles.controls}>
				<button
					type="button"
					onClick={handleJoinRoomClick}
					className={styles.startCallButton}
					disabled={isJoining}
				>
					<PhoneCall size={18} />
					{joinButtonLabel}
				</button>

				<p className={styles.status}>
					{roomTexts.statusPrefix} {statusLabel}
				</p>

				{errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
			</div>
		</section>
	);
};
