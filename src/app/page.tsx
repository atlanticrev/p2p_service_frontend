'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

import { SERVER_URL } from '@/src/app/config';

import styles from './page.module.scss';
import { type TRoomState, WebrtcViewModel } from './webrtc-view-model';

const DEFAULT_ROOM_STATE: TRoomState = {
	participants: 0,
	capacity: 2,
};

export default function Page() {
	const [status, setStatus] = useState('disconnected');
	const [isJoining, setIsJoining] = useState(false);
	const [isRoomJoined, setIsRoomJoined] = useState(false);
	const [hasRemoteParticipant, setHasRemoteParticipant] = useState(false);
	const [roomState, setRoomState] = useState<TRoomState>(DEFAULT_ROOM_STATE);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const roomTitle = 'Room #1';

	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);

	const [viewModel] = useState(() => new WebrtcViewModel(SERVER_URL));

	const refreshRoomState = useCallback(async () => {
		try {
			const nextRoomState = await viewModel.getRoomState();
			setRoomState(nextRoomState);
		} catch (error) {
			console.warn('Failed to fetch room state', error);
		}
	}, [viewModel]);

	const onLocalStream = useCallback((event: Event) => {
		const stream = (event as CustomEvent<MediaStream>).detail;

		if (localVideoRef.current) {
			localVideoRef.current.srcObject = stream;
			localVideoRef.current.muted = true;
			localVideoRef.current.volume = 1.0;

			localVideoRef.current
				.play()
				.then(() => {
					console.log('Local video started playing...');
				})
				.catch((err) => {
					console.warn('Local video autoplay was prevented:', err);
				});
		}
	}, []);

	const onRemoteStream = useCallback((event: Event) => {
		const remoteStream = (event as CustomEvent<MediaStream>).detail;
		setHasRemoteParticipant(true);

		if (remoteVideoRef.current) {
			remoteVideoRef.current.srcObject = remoteStream;
			remoteVideoRef.current.muted = false;
			remoteVideoRef.current.volume = 1.0;

			remoteVideoRef.current
				.play()
				.then(() => {
					console.log('Remote video started playing...');
				})
				.catch((err) => {
					console.warn('Remote video autoplay was prevented:', err);
				})
				.finally(() => {
					console.log('Volume:', remoteVideoRef.current?.volume, 'Muted:', remoteVideoRef.current?.muted);
				});
		}
	}, []);

	const onConnectionStateChange = useCallback((event: Event) => {
		const connectionState = (event as CustomEvent<string>).detail;

		setStatus(connectionState);

		if (connectionState !== 'connected') {
			setHasRemoteParticipant(false);
		}
	}, []);

	const onRoomState = useCallback(
		(event: Event) => {
			const nextRoomState = (event as CustomEvent<TRoomState>).detail;
			setRoomState(nextRoomState);

			if (isRoomJoined && nextRoomState.participants < 2) {
				setHasRemoteParticipant(false);
			}
		},
		[isRoomJoined],
	);

	const onRoomFull = useCallback((event: Event) => {
		const reason = (event as CustomEvent<string>).detail ?? 'Комната уже заполнена';

		setIsJoining(false);
		setIsRoomJoined(false);
		setStatus('room-full');
		setErrorMessage(`Не удалось войти: ${reason}`);
	}, []);

	const onError = useCallback((event: Event) => {
		console.error('WebRTC error:', (event as CustomEvent).detail);
		setErrorMessage('Не удалось подключиться к комнате. Проверь интернет и доступ к микрофону.');
	}, []);

	const onCallEnd = useCallback(
		(_: Event) => {
			setStatus('disconnected');
			setIsJoining(false);
			setIsRoomJoined(false);
			setHasRemoteParticipant(false);

			if (localVideoRef.current?.srcObject) {
				// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
				(localVideoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
				localVideoRef.current.srcObject = null;
			}

			if (remoteVideoRef.current?.srcObject) {
				// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
				(remoteVideoRef.current.srcObject as MediaStream).getTracks().forEach((track) => track.stop());
				remoteVideoRef.current.srcObject = null;
			}

			void refreshRoomState();
		},
		[refreshRoomState],
	);

	const startCall = useCallback(async () => {
		setErrorMessage(null);
		setIsJoining(true);
		setStatus('connecting');

		try {
			const latestRoomState = await viewModel.getRoomState();
			setRoomState(latestRoomState);

			if (latestRoomState.participants >= latestRoomState.capacity) {
				setStatus('room-full');
				setErrorMessage('Комната уже занята. Попробуй зайти позже.');

				return;
			}

			await viewModel.startCall();
			setIsRoomJoined(true);
			setStatus('waiting-for-peer');
		} catch (error) {
			console.error('Failed to start call', error);
			setStatus('disconnected');
			setErrorMessage('Не удалось войти в комнату');
		} finally {
			setIsJoining(false);
		}
	}, [viewModel]);

	const endCall = useCallback(() => {
		setStatus('disconnected');
		setErrorMessage(null);
		setIsRoomJoined(false);
		setHasRemoteParticipant(false);
		viewModel.cleanUp();
		void refreshRoomState();
	}, [viewModel, refreshRoomState]);

	const statusLabel = (() => {
		if (status === 'room-full') {
			return 'Комната занята';
		}

		if (!isRoomJoined && status === 'disconnected') {
			return 'Не в комнате';
		}

		if (status === 'waiting-for-peer' || status === 'connecting') {
			return 'Ожидаем второго участника';
		}

		if (status === 'connected') {
			return 'Соединение установлено';
		}

		return status;
	})();

	const remoteParticipantInRoom = isRoomJoined ? roomState.participants > 1 : roomState.participants > 0;
	const remoteParticipantInCall = hasRemoteParticipant || status === 'connected';

	useEffect(() => {
		const onBeforeUnload = () => {
			viewModel.cleanUp();
		};

		window.addEventListener('beforeunload', onBeforeUnload);
		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, [viewModel]);

	useEffect(() => {
		void refreshRoomState();

		if (isRoomJoined) {
			return;
		}

		const pollId = window.setInterval(() => {
			void refreshRoomState();
		}, 4_000);

		return () => window.clearInterval(pollId);
	}, [refreshRoomState, isRoomJoined]);

	useEffect(() => {
		viewModel.addEventListener('localStream', onLocalStream);
		viewModel.addEventListener('remoteStream', onRemoteStream);
		viewModel.addEventListener('connectionState', onConnectionStateChange);
		viewModel.addEventListener('roomState', onRoomState);
		viewModel.addEventListener('roomFull', onRoomFull);
		viewModel.addEventListener('error', onError);
		viewModel.addEventListener('endCall', onCallEnd);

		return () => {
			viewModel.removeEventListener('localStream', onLocalStream);
			viewModel.removeEventListener('remoteStream', onRemoteStream);
			viewModel.removeEventListener('connectionState', onConnectionStateChange);
			viewModel.removeEventListener('roomState', onRoomState);
			viewModel.removeEventListener('roomFull', onRoomFull);
			viewModel.removeEventListener('error', onError);
			viewModel.removeEventListener('endCall', onCallEnd);
			viewModel.cleanUp();
		};
	}, [viewModel, onLocalStream, onRemoteStream, onConnectionStateChange, onRoomState, onRoomFull, onError, onCallEnd]);

	return (
		<main className={styles.page}>
			<section className={styles.roomCard}>
				<div className={styles.roomHeader}>
					<p className={styles.roomLabel}>Комната</p>
					<h1 className={styles.roomTitle}>{roomTitle}</h1>
				</div>

				<p className={styles.roomHint}>В комнате: {roomState.participants} / {roomState.capacity}</p>

				<div className={styles.peopleList}>
					<div className={styles.personCard}>
						<p className={styles.personName}>Вы</p>
						<p className={styles.personState}>{isJoining ? 'Подключение...' : isRoomJoined ? 'В комнате' : 'Не подключены'}</p>
					</div>

					<div className={styles.personCard}>
						<p className={styles.personName}>Собеседник</p>
						<p className={styles.personState}>
							{remoteParticipantInCall
								? 'В звонке'
								: remoteParticipantInRoom
									? 'В комнате'
									: isRoomJoined
										? 'Ожидаем вход'
										: 'Комната пуста'}
						</p>
					</div>
				</div>

				<div className={styles.controls}>
					{isRoomJoined ? (
						<button type="button" onClick={endCall} className={styles.endCallButton}>
							<PhoneOff size={18} />
							Покинуть комнату
						</button>
					) : (
						<button type="button" onClick={() => void startCall()} className={styles.startCallButton} disabled={isJoining}>
							<PhoneCall size={18} />
							{isJoining ? 'Подключаем...' : 'Присоединиться к комнате'}
						</button>
					)}

					<p className={styles.status}>Статус: {statusLabel}</p>
					{errorMessage ? <p className={styles.error}>{errorMessage}</p> : null}
				</div>
			</section>

			{isRoomJoined ? (
				<section className={styles.videoStage}>
					<video ref={remoteVideoRef} muted={false} playsInline autoPlay className={styles.remoteVideo} />

					{remoteParticipantInCall ? null : <div className={styles.waitingOverlay}>Ожидаем подключение собеседника...</div>}

					<div className={styles.callHud}>
						<div className={styles.callMeta}>
							<p className={styles.callRoom}>{roomTitle}</p>
							<p className={styles.callState}>{remoteParticipantInCall ? 'В звонке' : 'Ожидание собеседника'}</p>
						</div>

						<button type="button" onClick={endCall} className={styles.callEndButton}>
							<PhoneOff size={16} />
							Выйти
						</button>
					</div>

					<video ref={localVideoRef} muted={true} playsInline autoPlay className={styles.localVideo} />
				</section>
			) : null}
		</main>
	);
}
