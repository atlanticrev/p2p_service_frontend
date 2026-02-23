import type { TLegacyGetUserMedia } from './webrtc-room-client-signal';

export const HIGH_QUALITY_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
	width: {
		min: 640,
		ideal: 1920,
		max: 3840,
	},
	height: {
		min: 480,
		ideal: 1080,
		max: 2160,
	},
	frameRate: {
		ideal: 30,
		max: 60,
	},
	facingMode: 'user',
};

export const HIGH_QUALITY_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
	channelCount: {
		ideal: 2,
		max: 2,
	},
	sampleRate: {
		ideal: 48_000,
	},
	sampleSize: {
		ideal: 16,
	},
};

export const requestBrowserUserMedia = async (constraints: MediaStreamConstraints) => {
	if (navigator.mediaDevices?.getUserMedia) {
		return navigator.mediaDevices.getUserMedia(constraints);
	}

	const legacyNavigator = navigator as Navigator & {
		getUserMedia?: TLegacyGetUserMedia;
		webkitGetUserMedia?: TLegacyGetUserMedia;
		mozGetUserMedia?: TLegacyGetUserMedia;
	};

	const legacyGetUserMedia =
		legacyNavigator.getUserMedia ||
		legacyNavigator.webkitGetUserMedia ||
		legacyNavigator.mozGetUserMedia;

	if (legacyGetUserMedia) {
		return new Promise<MediaStream>((resolve, reject) => {
			legacyGetUserMedia.call(navigator, constraints, resolve, reject);
		});
	}

	const secureContextInfo =
		typeof window !== 'undefined'
			? `secure=${String(window.isSecureContext)} protocol=${window.location.protocol}`
			: 'secure=unknown';

	throw new Error(`getUserMedia is unavailable in this browser/context (${secureContextInfo})`);
};

export const stopStreamTracks = (
	stream: MediaStream | undefined,
	stoppedTrackIds?: Set<string>,
) => {
	stream?.getTracks().forEach((track) => {
		if (stoppedTrackIds?.has(track.id)) {
			return;
		}

		track.stop();
		stoppedTrackIds?.add(track.id);
	});
};
