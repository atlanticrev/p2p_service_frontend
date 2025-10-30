'use client';

import { useEffect, useRef, useState } from 'react';

import styles from './page.module.scss';
import { WebrtcViewModel } from './webrtc-view-model';

const SERVER_URL = 'https://p2p-service-backend.onrender.com';

export default function Page() {
	const [viewModel] = useState(() => new WebrtcViewModel(SERVER_URL));

	const [status, setStatus] = useState('disconnected');

	const localVideoRef = useRef<HTMLVideoElement>(null);

	const remoteVideoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		viewModel.init();

		const onLocalStream = (e: Event) => {
			const stream = (e as CustomEvent<MediaStream>).detail;

			if (localVideoRef.current) {
				localVideoRef.current.srcObject = stream;

				localVideoRef.current.play().catch((error) => console.warn(error, 'Local video play failed'));
			}
		};

		const onRemoteStream = (e: Event) => {
			const stream = (e as CustomEvent<MediaStream>).detail;

			if (remoteVideoRef.current) {
				remoteVideoRef.current.srcObject = stream;

				remoteVideoRef.current.play().catch((error) => console.warn(error, 'Remote video play failed'));
			}
		};

		const onState = (e: Event) => {
			const state = (e as CustomEvent<string>).detail;

			setStatus(state);
		};

		const onError = (e: Event) => {
			console.error('WebRTC error:', (e as CustomEvent).detail);
		};

		viewModel.addEventListener('localStream', onLocalStream);
		viewModel.addEventListener('remoteStream', onRemoteStream);
		viewModel.addEventListener('connectionState', onState);
		viewModel.addEventListener('error', onError);

		return () => {
			viewModel.removeEventListener('localStream', onLocalStream);
			viewModel.removeEventListener('remoteStream', onRemoteStream);
			viewModel.removeEventListener('connectionState', onState);
			viewModel.removeEventListener('error', onError);

			viewModel.destroy();
		};
	}, [viewModel]);

	return (
		<main className={styles.container}>
			<h2>WebRTC Video Call</h2>

			<div className={styles.videoWrapper}>
				<video ref={localVideoRef} autoPlay playsInline muted className={styles.video} />

				{/** biome-ignore lint/a11y/useMediaCaption: <-> */}
				<video ref={remoteVideoRef} autoPlay playsInline className={styles.video} />
			</div>

			<button type="button" onClick={() => viewModel.startCall()} className={styles.button}>
				Start Call
			</button>

			<p className={styles.status}>Status: {status}</p>
		</main>
	);
}
