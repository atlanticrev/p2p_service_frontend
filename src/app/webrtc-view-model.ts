// biome-ignore lint/style/useNamingConvention: <->
export type TWebRTCEvent = 'localStream' | 'remoteStream' | 'connectionState' | 'error';

const STUN_SERVERS_CONFIG = {
	urls: ['stun:fr-turn7.xirsys.com'],
};

const TURN_SERVERS_CONFIG = {
	username: process.env.NEXT_PUBLIC_TURN_SERVER_USERNAME,
	credential: process.env.NEXT_PUBLIC_TURN_SERVER_CREDENTIAL,
	urls: [
		'turn:fr-turn7.xirsys.com:80?transport=udp',
		'turn:fr-turn7.xirsys.com:3478?transport=udp',
		'turn:fr-turn7.xirsys.com:80?transport=tcp',
		'turn:fr-turn7.xirsys.com:3478?transport=tcp',
		'turns:fr-turn7.xirsys.com:443?transport=tcp',
		'turns:fr-turn7.xirsys.com:5349?transport=tcp',
	],
};

const USE_TURN_SERVERS = false;

export class WebrtcViewModel extends EventTarget {
	private ws: WebSocket | null = null;

	private peerConnection: RTCPeerConnection | null = null;

	private readonly serverUrl: string;

	constructor(serverUrl: string) {
		super();

		this.serverUrl = serverUrl;
	}

	logAudioStats(peerConnection: RTCPeerConnection) {
		setInterval(async () => {
			const stats = await peerConnection.getStats();

			const audio = { inbound: {}, outbound: {} };

			stats.forEach((report) => {
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

			console.log('Audio info:');

			console.table(audio);
		}, 2_000);
	}

	async init() {
		this.ws = new WebSocket(this.serverUrl);

		this.ws?.addEventListener('message', async (event) => {
			const data = JSON.parse(event.data);

			if (!this.peerConnection) {
				return;
			}

			try {
				if (data.type === 'offer') {
					await this.createLocalStream();

					await this.peerConnection.setRemoteDescription(data.offer);

					const answer = await this.peerConnection.createAnswer();
					await this.peerConnection.setLocalDescription(answer);

					this.ws?.send(JSON.stringify({ type: 'answer', answer }));
				}

				if (data.type === 'answer') {
					await this.peerConnection.setRemoteDescription(data.answer);
				}

				if (data.type === 'candidate') {
					await this.peerConnection.addIceCandidate(data.candidate);
				}
			} catch (err) {
				this.dispatchEvent(new CustomEvent('error', { detail: err }));
			}
		});

		this.peerConnection = new RTCPeerConnection({
			iceServers: [STUN_SERVERS_CONFIG, ...(USE_TURN_SERVERS ? [TURN_SERVERS_CONFIG] : [])],
		});

		this.peerConnection.addEventListener('track', (event) => {
			console.log('Incoming track:', event.track.kind, event.streams);

			const stream = event.streams[0];

			this.dispatchEvent(new CustomEvent('remoteStream', { detail: stream }));
		});

		this.peerConnection.addEventListener('icecandidate', (event) => {
			if (event.candidate) {
				this.ws?.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
			}
		});

		this.peerConnection.onconnectionstatechange = async () => {
			if (this.peerConnection?.connectionState === 'connected') {
				console.log('✅ Peers connected — start logging audio stats...');

				this.logAudioStats(this.peerConnection);
			}

			const stats = await this.peerConnection?.getStats();

			stats?.forEach((report) => {
				if (report.type === 'candidate-pair' && report.state === 'succeeded') {
					const local = stats.get(report.localCandidateId);

					const remote = stats.get(report.remoteCandidateId);

					// candidateType might be - 'host', 'srflx', 'prflx', 'relay'
					console.log('✅ Connected via:', local.candidateType, '/', remote.candidateType);
				}
			});

			this.dispatchEvent(new CustomEvent('connectionState', { detail: this.peerConnection?.connectionState }));
		};
	}

	async startCall() {
		if (!this.peerConnection || !this.ws) {
			throw new Error('Not initialized');
		}

		await this.createLocalStream();

		const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true });

		await this.peerConnection.setLocalDescription(offer);

		this.ws.send(JSON.stringify({ type: 'offer', offer }));
	}

	private async createLocalStream(): Promise<MediaStream> {
		/**
		 * This works only with HTTPS
		 */
		// @todo Обработать ошибки при запросе user media
		const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

		console.log('localStream.audioTracks ->', localStream.getAudioTracks());

		// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
		localStream.getTracks().forEach((track) => this.peerConnection?.addTrack(track, localStream));

		console.log('getSenders', this.peerConnection?.getSenders());

		this.dispatchEvent(new CustomEvent('localStream', { detail: localStream }));

		return localStream;
	}

	destroy() {
		this.peerConnection?.close();

		this.ws?.close();
	}
}
