'use client';

import type { RefObject } from 'react';
import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react';

import { clsx } from '@/src/lib/clsx';
import { sharedTexts } from '@/src/shared/texts';

import styles from './p2p-room-call.module.scss';

type TP2pRoomCallProps = {
	localVideoRef: RefObject<HTMLVideoElement | null>;
	remoteVideoRef: RefObject<HTMLVideoElement | null>;
	remoteParticipantInCall: boolean;
	waitingOverlayLabel: string;
	callStateLabel: string;
	isLocalMediaReady: boolean;
	isMicrophoneEnabled: boolean;
	isCameraEnabled: boolean;
	exitRoomButtonLabel: string;
	onToggleMicrophone: () => void;
	onToggleCamera: () => void;
	onLeaveRoom: () => void;
};

const roomTexts = sharedTexts.p2pRoom;

export const P2pRoomCall = ({
	localVideoRef,
	remoteVideoRef,
	remoteParticipantInCall,
	waitingOverlayLabel,
	callStateLabel,
	isLocalMediaReady,
	isMicrophoneEnabled,
	isCameraEnabled,
	exitRoomButtonLabel,
	onToggleMicrophone,
	onToggleCamera,
	onLeaveRoom,
}: TP2pRoomCallProps) => {
	const microphoneLabel = isMicrophoneEnabled
		? roomTexts.callControls.muteOn
		: roomTexts.callControls.muteOff;
	
	const cameraLabel = isCameraEnabled ? roomTexts.callControls.cameraOn : roomTexts.callControls.cameraOff;
	
	const micButtonClassName = clsx(styles.callControlButton, {
		[styles.callControlButtonOff]: !isMicrophoneEnabled,
	});
	
	const cameraButtonClassName = clsx(styles.callControlButton, {
		[styles.callControlButtonOff]: !isCameraEnabled,
	});

	return (
		<section className={styles.callScreen}>
			<section className={clsx(styles.videoStage, styles.callVideoStage)}>
				<video ref={remoteVideoRef} muted={false} playsInline autoPlay className={styles.remoteVideo} />

				{remoteParticipantInCall ? null : <div className={styles.waitingOverlay}>{waitingOverlayLabel}</div>}

				<div className={styles.callHud}>
					<div className={styles.callMeta}>
						<p className={styles.callRoom}>{roomTexts.roomTitle}</p>

						<p className={styles.callState}>{callStateLabel}</p>
					</div>
				</div>

				<video ref={localVideoRef} muted={true} playsInline autoPlay className={styles.localVideo} />

				<div className={styles.callActions}>
					<div className={styles.callActionGroup}>
						<button
							type="button"
							onClick={onToggleMicrophone}
							className={micButtonClassName}
							disabled={!isLocalMediaReady}
							aria-pressed={!isMicrophoneEnabled}
							aria-label={microphoneLabel}
							title={microphoneLabel}
						>
							{isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
						</button>

						<button
							type="button"
							onClick={onToggleCamera}
							className={cameraButtonClassName}
							disabled={!isLocalMediaReady}
							aria-pressed={!isCameraEnabled}
							aria-label={cameraLabel}
							title={cameraLabel}
						>
							{isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
						</button>

						<button
							type="button"
							onClick={onLeaveRoom}
							className={styles.callExitButton}
							aria-label={exitRoomButtonLabel}
							title={exitRoomButtonLabel}
						>
							<PhoneOff size={18} />
							{exitRoomButtonLabel}
						</button>
					</div>
				</div>
			</section>
		</section>
	);
};
