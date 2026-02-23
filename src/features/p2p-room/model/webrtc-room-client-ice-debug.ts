const parseIceCandidate = (candidateLine?: string | null) => {
	if (!candidateLine) {
		return null;
	}

	const normalizedLine = candidateLine.startsWith('candidate:')
		? candidateLine.slice('candidate:'.length)
		: candidateLine;
	const parts = normalizedLine.trim().split(/\s+/);

	if (parts.length < 8) {
		return {
			raw: candidateLine,
		};
	}

	const getValue = (key: string) => {
		const index = parts.indexOf(key);

		return index >= 0 && index + 1 < parts.length ? parts[index + 1] : undefined;
	};

	return {
		foundation: parts[0],
		component: parts[1],
		protocol: parts[2]?.toLowerCase(),
		priority: parts[3],
		address: parts[4],
		port: Number(parts[5]),
		type: getValue('typ'),
		tcpType: getValue('tcptype'),
		relatedAddress: getValue('raddr'),
		relatedPort: getValue('rport') ? Number(getValue('rport')) : undefined,
	};
};

export const logIceCandidate = (
	direction: 'local' | 'remote',
	candidate: RTCIceCandidate | RTCIceCandidateInit,
) => {
	const parsedCandidate = parseIceCandidate(candidate.candidate);

	console.log(`ICE ${direction} candidate`, {
		sdpMid: candidate.sdpMid ?? null,
		sdpMlineIndex: candidate.sdpMLineIndex ?? null,
		parsed: parsedCandidate,
	});
};

export const logIceSelectedPairSnapshot = async (
	peerConnection: RTCPeerConnection,
	reason: string,
) => {
	try {
		const stats = await peerConnection.getStats();
		type TcandidateStatsLike = RTCStats & {
			candidateType?: string;
			protocol?: string;
			address?: string;
			port?: number;
		};

		let selectedPair: (RTCIceCandidatePairStats & { selected?: boolean }) | undefined;

		stats.forEach((report) => {
			if (selectedPair || report.type !== 'transport') {
				return;
			}

			const transportReport = report as RTCTransportStats;

			if (!transportReport.selectedCandidatePairId) {
				return;
			}

			const candidatePairReport = stats.get(transportReport.selectedCandidatePairId);
			if (candidatePairReport?.type === 'candidate-pair') {
				selectedPair = candidatePairReport as RTCIceCandidatePairStats & { selected?: boolean };
			}
		});

		if (!selectedPair) {
			stats.forEach((report) => {
				if (selectedPair || report.type !== 'candidate-pair') {
					return;
				}

				const candidatePairReport = report as RTCIceCandidatePairStats & {
					selected?: boolean;
				};

				if (
					candidatePairReport.nominated ||
					candidatePairReport.selected ||
					candidatePairReport.state === 'succeeded'
				) {
					selectedPair = candidatePairReport;
				}
			});
		}

		if (!selectedPair) {
			console.log(`ICE selected pair snapshot (${reason}): no selected pair`);
			return;
		}

		const localCandidateReport = selectedPair.localCandidateId
			? stats.get(selectedPair.localCandidateId)
			: undefined;
		const remoteCandidateReport = selectedPair.remoteCandidateId
			? stats.get(selectedPair.remoteCandidateId)
			: undefined;

		const localCandidate =
			localCandidateReport &&
			(localCandidateReport.type === 'local-candidate' ||
				localCandidateReport.type === 'remote-candidate')
				? (localCandidateReport as TcandidateStatsLike)
				: undefined;
		const remoteCandidate =
			remoteCandidateReport &&
			(remoteCandidateReport.type === 'remote-candidate' ||
				remoteCandidateReport.type === 'local-candidate')
				? (remoteCandidateReport as TcandidateStatsLike)
				: undefined;

		console.log(`ICE selected pair snapshot (${reason})`, {
			state: selectedPair.state,
			nominated: selectedPair.nominated,
			selected: selectedPair.selected,
			currentRoundTripTime: selectedPair.currentRoundTripTime,
			availableOutgoingBitrate: selectedPair.availableOutgoingBitrate,
			local: localCandidate
				? {
						candidateType: localCandidate.candidateType,
						protocol: localCandidate.protocol,
						address: localCandidate.address,
						port: localCandidate.port,
					}
				: null,
			remote: remoteCandidate
				? {
						candidateType: remoteCandidate.candidateType,
						protocol: remoteCandidate.protocol,
						address: remoteCandidate.address,
						port: remoteCandidate.port,
					}
				: null,
		});
	} catch (error) {
		console.warn(`Failed to read ICE stats snapshot (${reason})`, error);
	}
};
