// biome-ignore lint/style/useNamingConvention: <->
export type TWebRTCEvent = 'localStream' | 'remoteStream' | 'connectionState' | 'error';

type TSignalMessage =
	| { type: 'offer'; offer: RTCSessionDescriptionInit }
	| { type: 'answer'; answer: RTCSessionDescriptionInit }
	| { type: 'candidate'; candidate: RTCIceCandidateInit };

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
	private webSocket: WebSocket | null = null;

	private peerConnection: RTCPeerConnection | null = null;

	private readonly serverUrl: string;

	localStream: MediaStream | undefined;

	remoteStream: MediaStream | undefined;

	constructor(serverUrl: string) {
		super();

		this.serverUrl = serverUrl;

		// @todo Избавиться от создания лишнего MediaStream
		if (typeof window !== 'undefined' && typeof MediaStream !== 'undefined') {
			this.localStream = new MediaStream();
		}

		// @todo Избавиться от создания лишнего MediaStream
		if (typeof window !== 'undefined' && typeof MediaStream !== 'undefined') {
			this.remoteStream = new MediaStream();
		}
	}

	async init() {
		/**
		 * WebSocket
		 */
		this.webSocket = new WebSocket(this.serverUrl);

		this.webSocket?.addEventListener('message', async (event) => {
			if (!this.peerConnection) {
				return;
			}

			const data: TSignalMessage = JSON.parse(event.data);

			// @todo Debug
			try {
				/**
				 * Тут я получаю предложение от другого участника соединиться
				 */
				if (data.type === 'offer') {
					await this.peerConnection.setRemoteDescription(data.offer);

					await this.createLocalStream();

					const answer = await this.peerConnection.createAnswer();
					await this.peerConnection.setLocalDescription(answer);

					this.webSocket?.send(JSON.stringify({ type: 'answer', answer }));
				}

				/**
				 * Тут я отправляю ответ на приглашение присоединиться
				 */
				if (data.type === 'answer') {
					await this.peerConnection.setRemoteDescription(data.answer);
				}

				/**
				 * Тут я ?
				 */
				if (data.type === 'candidate') {
					await this.peerConnection.addIceCandidate(data.candidate);
				}
			} catch (error) {
				this.dispatchEvent(new CustomEvent('error', { detail: error }));
			}
		});
	}

	async startCall() {
		if (!this.webSocket) {
			throw new Error('Connection to signaling server is not initialized');
		}

		/**
		 * RTCPeerConnection
		 */
		this.peerConnection = new RTCPeerConnection({
			iceServers: [STUN_SERVERS_CONFIG, ...(USE_TURN_SERVERS ? [TURN_SERVERS_CONFIG] : [])],
			iceTransportPolicy: 'all', // Allow only p2p connection
		});

		this.peerConnection.addEventListener('track', (event) => {
			console.log('Incoming track:', event.track.kind, event.streams);

			/**
			 * Этот медиа-поток уже содержит все дорожки которые согласился прислать пир (аудио, видео)
			 */
			this.dispatchEvent(new CustomEvent('remoteStream', { detail: event.streams[0] }));
		});

		this.peerConnection.addEventListener('icecandidate', (event) => {
			if (event.candidate) {
				this.webSocket?.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
			}
		});

		this.peerConnection.addEventListener('connectionstatechange', async () => {
			if (this.peerConnection?.connectionState === 'connected') {
				console.log('✅ Peers connected — start logging stats...');

				this.logStats(this.peerConnection);
			}

			this.dispatchEvent(new CustomEvent('connectionState', { detail: this.peerConnection?.connectionState }));
		});

		await this.createLocalStream();

		const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true });
		await this.peerConnection.setLocalDescription(offer);

		this.webSocket.send(JSON.stringify({ type: 'offer', offer }));
	}

	endCall() {
		console.log('endCall');

		// 1. Остановить локальные треки
		// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
		this.localStream?.getTracks().forEach((track) => track.stop());

		// 2. Закрыть соединение
		if (this.peerConnection) {
			this.peerConnection.ontrack = null;
			this.peerConnection.onicecandidate = null;
			this.peerConnection.close();
			this.peerConnection = null;
		}

		// 3. Сообщить удалённой стороне
		this.webSocket?.send(JSON.stringify({ type: 'hangup' }));

		this.dispatchEvent(new CustomEvent('endCall'));
	}

	private async createLocalStream() {
		/**
		 * This works only with HTTPS
		 */
		// @todo Обработать ошибки при запросе user media
		this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

		console.log('localStream.audioTracks ->', this.localStream.getAudioTracks());

		// @todo Избавиться (без этого ругается .addTrack(track, stream))
		const stream = this.localStream;
		// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
		this.localStream.getTracks().forEach((track) => this.peerConnection?.addTrack(track, stream));

		console.log('getSenders', this.peerConnection?.getSenders());

		this.dispatchEvent(new CustomEvent('localStream', { detail: this.localStream }));
	}

	cleanUp() {
		console.log('cleanUp');

		this.endCall();

		this.destroy();
	}

	destroy() {
		console.log('destroy');

		this.peerConnection?.close();

		this.webSocket?.close();
	}

	logStats(peerConnection: RTCPeerConnection) {
		setInterval(async () => {
			const stats = await peerConnection.getStats();

			const audio = { inbound: {}, outbound: {} };

			stats.forEach((report) => {
				if (report.type === 'candidate-pair' && report.state === 'succeeded') {
					const local = stats.get(report.localCandidateId);

					const remote = stats.get(report.remoteCandidateId);

					// candidateType might be - 'host', 'srflx', 'prflx', 'relay'
					console.log('✅ Connected via:', local.candidateType, '/', remote.candidateType);
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

			console.log('Audio info:');

			console.table(audio);
		}, 2_000);
	}
}
