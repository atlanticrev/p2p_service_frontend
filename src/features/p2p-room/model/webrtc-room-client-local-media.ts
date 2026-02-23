import {
	HIGH_QUALITY_AUDIO_CONSTRAINTS,
	HIGH_QUALITY_VIDEO_CONSTRAINTS,
	requestBrowserUserMedia,
} from './webrtc-room-client-media';
import { applySenderQualityProfile } from './webrtc-room-client-track-controls';

type TBoostedAudioTrackResult = {
	track: MediaStreamTrack;
	audioContext: AudioContext | null;
	outgoingGainNode: GainNode | null;
};

type TCreateLocalMediaSessionParams = {
	peerConnection: RTCPeerConnection | null;
	defaultMicrophoneEnabled: boolean;
	defaultCameraEnabled: boolean;
};

type TLocalMediaSession = {
	localStream: MediaStream;
	localOutgoingStream: MediaStream;
	audioContext: AudioContext | null;
	outgoingGainNode: GainNode | null;
};

const createBoostedAudioTrack = (
	sourceStream: MediaStream,
	fallbackTrack: MediaStreamTrack,
): TBoostedAudioTrackResult => {
	try {
		const AudioContextCtor =
			window.AudioContext ||
			(window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

		if (!AudioContextCtor) {
			return {
				track: fallbackTrack,
				audioContext: null,
				outgoingGainNode: null,
			};
		}

		const audioContext = new AudioContextCtor();
		const sourceNode = audioContext.createMediaStreamSource(sourceStream);
		const destinationNode = audioContext.createMediaStreamDestination();
		const outgoingGainNode = audioContext.createGain();

		outgoingGainNode.gain.value = 1.8;
		sourceNode.connect(outgoingGainNode);
		outgoingGainNode.connect(destinationNode);

		if (audioContext.state === 'suspended') {
			void audioContext.resume();
		}

		const boostedAudioTrack = destinationNode.stream.getAudioTracks()[0];

		if (!boostedAudioTrack) {
			return {
				track: fallbackTrack,
				audioContext: null,
				outgoingGainNode: null,
			};
		}

		boostedAudioTrack.contentHint = 'speech';

		return {
			track: boostedAudioTrack,
			audioContext,
			outgoingGainNode,
		};
	} catch (error) {
		console.warn(
			'Failed to create boosted outgoing track, fallback to raw microphone track',
			error,
		);

		return {
			track: fallbackTrack,
			audioContext: null,
			outgoingGainNode: null,
		};
	}
};

export const createLocalMediaSession = async ({
	peerConnection,
	defaultMicrophoneEnabled,
	defaultCameraEnabled,
}: TCreateLocalMediaSessionParams): Promise<TLocalMediaSession> => {
	const localStream = await requestBrowserUserMedia({
		video: HIGH_QUALITY_VIDEO_CONSTRAINTS,
		audio: HIGH_QUALITY_AUDIO_CONSTRAINTS,
	});

	if (navigator.mediaDevices?.enumerateDevices) {
		navigator.mediaDevices.enumerateDevices().then((devices) => {
			// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
			devices.forEach((device) =>
				console.log(`Media devices - ${device.kind}: ${device.label} id=${device.deviceId}`),
			);
		});
	}

	const [localAudioTrack] = localStream.getAudioTracks();
	const localVideoTracks = localStream.getVideoTracks();

	localVideoTracks.forEach((track) => {
		track.contentHint = 'detail';
		track.enabled = defaultCameraEnabled;
	});

	let audioContext: AudioContext | null = null;
	let outgoingGainNode: GainNode | null = null;

	if (localAudioTrack) {
		localAudioTrack.enabled = defaultMicrophoneEnabled;
		localAudioTrack.onmute = () => console.warn('local track muted');
		localAudioTrack.onunmute = () => console.warn('local track unmuted');
	}

	const localOutgoingStream = new MediaStream(localVideoTracks);

	if (localAudioTrack) {
		const boostedAudioTrack = createBoostedAudioTrack(localStream, localAudioTrack);

		boostedAudioTrack.track.enabled = defaultMicrophoneEnabled;
		audioContext = boostedAudioTrack.audioContext;
		outgoingGainNode = boostedAudioTrack.outgoingGainNode;
		localOutgoingStream.addTrack(boostedAudioTrack.track);
	}

	localOutgoingStream.getTracks().forEach((track) => {
		track.enabled = track.kind === 'audio' ? defaultMicrophoneEnabled : defaultCameraEnabled;
		peerConnection?.addTrack(track, localOutgoingStream);
	});

	if (peerConnection) {
		applySenderQualityProfile(peerConnection);
	}

	console.log('[Local stream] audio tracks ->', localStream.getAudioTracks());

	console.log(
		'[Local stream] all tracks ->',
		localOutgoingStream
			.getTracks()
			.map((track) => ({ kind: track.kind, readyState: track.readyState, enabled: track.enabled })),
	);

	console.log('Track transmitters ->', peerConnection?.getSenders());

	return {
		localStream,
		localOutgoingStream,
		audioContext,
		outgoingGainNode,
	};
};
