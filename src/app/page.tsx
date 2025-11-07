'use client';

import { useEffect, useRef, useState } from 'react';
import { PhoneCall } from 'lucide-react';

import { SERVER_URL } from '@/src/app/config';

import styles from './page.module.scss';
import { WebrtcViewModel } from './webrtc-view-model';

export default function Page() {
	const [_, setStatus] = useState('disconnected');

	const [isCallStarted, setIsCallStarted] = useState(false);

	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);

	const [viewModel] = useState(() => new WebrtcViewModel(SERVER_URL));

	const onLocalStream = (event: Event) => {
		const stream = (event as CustomEvent<MediaStream>).detail;

		if (localVideoRef.current) {
			localVideoRef.current.srcObject = stream;
			localVideoRef.current.muted = true;
			localVideoRef.current.volume = 1.0;
		}
	};

	const onRemoteStream = (event: Event) => {
		const remoteStream = (event as CustomEvent<MediaStream>).detail;

		if (remoteVideoRef.current) {
			remoteVideoRef.current.srcObject = remoteStream;
			remoteVideoRef.current.muted = false;
			remoteVideoRef.current.volume = 1.0;

			// Вызов play() для гарантии воспроизведения
			remoteVideoRef.current
				.play()
				.then(() => {
					console.log('Remote video started playing');
				})
				.catch((err) => {
					console.warn('Remote video autoplay was prevented:', err);
				});
		}
	};

	const onConnectionStateChange = (event: Event) => {
		const connectionState = (event as CustomEvent<string>).detail;

		setStatus(connectionState);
	};

	const onError = (event: Event) => {
		console.error('WebRTC error:', (event as CustomEvent).detail);
	};

	const onCallEnd = (_: Event) => {
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
	};

	const startCall = () => {
		setIsCallStarted(true);

		viewModel.startCall();
	};

	const endCall = () => {
		setIsCallStarted(false);

		viewModel.endCall();
	};

	useEffect(() => {
		const onBeforeUnload = () => {
			viewModel.cleanUp();
		};

		window.addEventListener('beforeunload', onBeforeUnload);

		return () => window.removeEventListener('beforeunload', onBeforeUnload);
	}, []);

	useEffect(() => {
		viewModel.init();

		viewModel.addEventListener('localStream', onLocalStream);
		viewModel.addEventListener('remoteStream', onRemoteStream);
		viewModel.addEventListener('connectionState', onConnectionStateChange);
		viewModel.addEventListener('error', onError);
		viewModel.addEventListener('endCall', onCallEnd);

		return () => {
			viewModel.removeEventListener('localStream', onLocalStream);
			viewModel.removeEventListener('remoteStream', onRemoteStream);
			viewModel.removeEventListener('connectionState', onConnectionStateChange);
			viewModel.removeEventListener('error', onError);
			viewModel.removeEventListener('endCall', onCallEnd);

			viewModel.cleanUp();
		};
	}, [viewModel]);

	return (
		<main className={styles.container}>
			<video ref={remoteVideoRef} muted={false} playsInline autoPlay className={styles.remoteVideo} />

			<video ref={localVideoRef} muted={false} playsInline autoPlay className={styles.localVideo} />

			<div className={styles.controls}>
				{isCallStarted ? (
					<button type="button" onClick={endCall} className={styles.endCallButton}>
						<PhoneCall />
					</button>
				) : (
					<button type="button" onClick={startCall} className={styles.startCallButton}>
						<PhoneCall />
					</button>
				)}
			</div>
		</main>
	);
}
