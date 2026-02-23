export const applySenderQualityProfile = (peerConnection: RTCPeerConnection) => {
	peerConnection.getSenders().forEach((sender) => {
		const track = sender.track;

		if (!track) {
			return;
		}

		const parameters = sender.getParameters();
		parameters.encodings =
			parameters.encodings && parameters.encodings.length > 0 ? parameters.encodings : [{}];

		if (track.kind === 'video') {
			track.contentHint = 'detail';
			parameters.encodings[0].maxBitrate = 3_500_000;
			parameters.encodings[0].maxFramerate = 30;
			parameters.encodings[0].scaleResolutionDownBy = 1;
		}

		if (track.kind === 'audio') {
			parameters.encodings[0].maxBitrate = 128_000;
		}

		void sender.setParameters(parameters).catch((error) => {
			console.warn(`Failed to set sender parameters for ${track.kind}`, error);
		});
	});
};

export const attachLocalTracksToPeerConnection = (
	peerConnection: RTCPeerConnection,
	localOutgoingStream: MediaStream,
) => {
	const attachedTrackIds = new Set(
		peerConnection
			.getSenders()
			.map((sender) => sender.track?.id)
			.filter((trackId): trackId is string => Boolean(trackId)),
	);

	let attachedTracksCount = 0;

	localOutgoingStream.getTracks().forEach((track) => {
		if (attachedTrackIds.has(track.id)) {
			return;
		}

		peerConnection.addTrack(track, localOutgoingStream);
		attachedTracksCount += 1;
	});

	return attachedTracksCount;
};

export const getPrimaryTrackEnabled = (
	kind: 'audio' | 'video',
	localStream?: MediaStream,
	localOutgoingStream?: MediaStream,
) => {
	if (kind === 'audio') {
		return (
			localOutgoingStream?.getAudioTracks()[0]?.enabled ??
			localStream?.getAudioTracks()[0]?.enabled ??
			null
		);
	}

	return (
		localStream?.getVideoTracks()[0]?.enabled ??
		localOutgoingStream?.getVideoTracks()[0]?.enabled ??
		null
	);
};

export const setTrackEnabled = (
	kind: 'audio' | 'video',
	enabled: boolean,
	localStream?: MediaStream,
	localOutgoingStream?: MediaStream,
) => {
	const targetStreams = [
		localStream,
		localOutgoingStream,
	];
	const processedTrackIds = new Set<string>();

	let hasTrack = false;

	targetStreams.forEach((stream) => {
		const tracks = kind === 'audio' ? stream?.getAudioTracks() : stream?.getVideoTracks();

		tracks?.forEach((track) => {
			if (processedTrackIds.has(track.id)) {
				return;
			}

			track.enabled = enabled;
			processedTrackIds.add(track.id);
			hasTrack = true;
		});
	});

	return hasTrack;
};
