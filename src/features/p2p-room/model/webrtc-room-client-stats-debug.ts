export const startPeerConnectionStatsLogging = (peerConnection: RTCPeerConnection) => {
	if (typeof window === 'undefined') {
		return undefined;
	}

	return window.setInterval(async () => {
		peerConnection.getReceivers().forEach((receiver) => {
			console.log(
				'getReceivers info -> ',
				receiver.track.kind,
				receiver.track.enabled,
				receiver.track.readyState,
			);
		});

		const stats = await peerConnection.getStats();
		const audio = {
			inbound: {},
			outbound: {},
		};

		stats.forEach((report) => {
			if (report.type === 'candidate-pair' && report.state === 'succeeded') {
				const local = stats.get(report.localCandidateId);
				const remote = stats.get(report.remoteCandidateId);

				console.log('✅ Peers connected via:', local.candidateType, '/', remote.candidateType);
			}

			if (report.type === 'inbound-rtp' && report.kind === 'audio') {
				audio.inbound = {
					packetsReceived: report.packetsReceived,
					bytesReceived: report.bytesReceived,
					jitter: report.jitter,
				};
			}

			if (report.type === 'outbound-rtp' && report.kind === 'audio') {
				audio.outbound = {
					packetsSent: report.packetsSent,
					bytesSent: report.bytesSent,
				};
			}
		});

		console.log('Peer connection audio info ->');
		console.table(audio);
	}, 2_000);
};
