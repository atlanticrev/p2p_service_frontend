import { useCallback, useRef, type RefObject } from 'react';

type TVideoRefs = {
	localVideoRef: RefObject<HTMLVideoElement | null>;
	remoteVideoRef: RefObject<HTMLVideoElement | null>;
};

type TVideoElementActions = {
	attachLocalStream: (stream: MediaStream) => void;
	attachRemoteStream: (stream: MediaStream) => void;
	clearLocalVideoElement: () => void;
	clearRemoteVideoElement: () => void;
	clearVideoElements: () => void;
	hasLocalVideoSource: () => boolean;
};

const stopVideoElementTracks = (videoElement: HTMLVideoElement | null) => {
	if (!videoElement?.srcObject) {
		return;
	}

	(videoElement.srcObject as MediaStream).getTracks().forEach((track) => {
		track.stop();
	});

	videoElement.srcObject = null;
};

const playVideoElement = (videoElement: HTMLVideoElement, label: string) => {
	void videoElement
		.play()
		.then(() => {
			console.log(`${label} video started playing...`);
		})
		.catch((error) => {
			console.warn(`${label} video autoplay was prevented:`, error);
		});
};

const logVideoElementState = (videoElement: HTMLVideoElement) => {
	console.log('Volume:', videoElement.volume, 'Muted:', videoElement.muted);
};

export const useVideoElements = (): TVideoRefs & TVideoElementActions => {
	const localVideoRef = useRef<HTMLVideoElement>(null);
	const remoteVideoRef = useRef<HTMLVideoElement>(null);

	const attachLocalStream = useCallback((stream: MediaStream) => {
		const localVideoElement = localVideoRef.current;
		if (!localVideoElement) {
			return;
		}

		localVideoElement.srcObject = stream;
		localVideoElement.muted = true;
		localVideoElement.volume = 1;
		playVideoElement(localVideoElement, 'Local');
	}, []);

	const attachRemoteStream = useCallback((stream: MediaStream) => {
		const remoteVideoElement = remoteVideoRef.current;
		if (!remoteVideoElement) {
			return;
		}

		remoteVideoElement.srcObject = stream;
		remoteVideoElement.muted = false;
		remoteVideoElement.volume = 1;
		playVideoElement(remoteVideoElement, 'Remote');
		logVideoElementState(remoteVideoElement);
	}, []);

	const clearLocalVideoElement = useCallback(() => {
		stopVideoElementTracks(localVideoRef.current);
	}, []);

	const clearRemoteVideoElement = useCallback(() => {
		stopVideoElementTracks(remoteVideoRef.current);
	}, []);

	const clearVideoElements = useCallback(() => {
		clearLocalVideoElement();
		clearRemoteVideoElement();
	}, [clearLocalVideoElement, clearRemoteVideoElement]);

	const hasLocalVideoSource = useCallback(() => {
		return Boolean(localVideoRef.current?.srcObject);
	}, []);

	return {
		localVideoRef,
		remoteVideoRef,
		attachLocalStream,
		attachRemoteStream,
		clearLocalVideoElement,
		clearRemoteVideoElement,
		clearVideoElements,
		hasLocalVideoSource,
	};
};
