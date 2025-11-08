import { IS_TURN_SERVERS_USED, STUN_SERVERS, TURN_SERVERS } from '@/src/app/config';

// export type TWebRTCEvent = 'localStream' | 'remoteStream' | 'connectionState' | 'error';

type TSignalMessage =
	| { type: 'offer'; offer: RTCSessionDescriptionInit }
	| { type: 'answer'; answer: RTCSessionDescriptionInit }
	| { type: 'candidate'; candidate: RTCIceCandidateInit }
	| { type: 'startOffer' }
	| { type: 'ready' };

export class WebrtcViewModel extends EventTarget {
	private webSocket: WebSocket | null = null;

	private peerConnection: RTCPeerConnection | null = null;

	private readonly serverUrl: string;

	localStream: MediaStream | undefined;

	remoteStream: MediaStream | undefined;

	logIntervalMs: number | undefined = 0;

	constructor(serverUrl: string) {
		super();

		this.serverUrl = serverUrl;
	}

	async init() {
		/**
		 * WebSocket
		 */
		this.webSocket = new WebSocket(this.serverUrl);

		this.webSocket?.addEventListener('message', async (event) => {
			const data: TSignalMessage = JSON.parse(event.data);

			// @todo Debug
			try {
				/**
				 * Сервер просит сформировать офер
				 */
				if (data.type === 'startOffer') {
					await this.startOffer();
				}

				/**
				 * Тут я получаю предложение от другого участника соединиться
				 */
				if (data.type === 'offer') {
					// создаём peerConnection только если ещё не было
					if (!this.peerConnection) {
						this.peerConnection = new RTCPeerConnection({
							iceServers: [STUN_SERVERS, ...(IS_TURN_SERVERS_USED ? [TURN_SERVERS] : [])],
							iceTransportPolicy: 'all',
						});

						this.setupPeerConnectionEvents();
					}

					// ✅ Создаём локальный поток заранее
					if (!this.localStream) {
						await this.createLocalStream();
					}

					await this.peerConnection.setRemoteDescription(data.offer);

					const answer = await this.peerConnection.createAnswer();
					await this.peerConnection.setLocalDescription(answer);

					console.log('ANSWER SDP:', this.peerConnection?.localDescription?.sdp);

					this.webSocket?.send(JSON.stringify({ type: 'answer', answer }));
				}

				/**
				 * Тут я отправляю ответ на приглашение присоединиться
				 */
				if (data.type === 'answer') {
					await this.peerConnection?.setRemoteDescription(data.answer);
				}

				/**
				 * Тут я ?
				 */
				if (data.type === 'candidate') {
					await this.peerConnection?.addIceCandidate(data.candidate);
				}
			} catch (error) {
				this.dispatchEvent(new CustomEvent('error', { detail: error }));
			}
		});
	}

	private setupPeerConnectionEvents() {
		if (!this.peerConnection) {
			return;
		}

		this.peerConnection.addEventListener('track', (event) => {
			console.log('Incoming Remote track:', event.track.kind, event.track.readyState);

			console.log('Incoming streams:', event.streams);

			const remoteStream = event.streams[0];

			remoteStream.getTracks().forEach((track) => {
				track.enabled = true;
			});

			this.dispatchEvent(new CustomEvent('remoteStream', { detail: remoteStream }));
		});

		this.peerConnection.addEventListener('icecandidate', (event) => {
			if (event.candidate) {
				this.webSocket?.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
			}
		});

		this.peerConnection.addEventListener('connectionstatechange', () => {
			console.log('🔗 Connection state:', this.peerConnection?.connectionState);

			console.log('🔗 ICE Connection state:', this.peerConnection?.iceConnectionState);

			this.dispatchEvent(new CustomEvent('connectionState', { detail: this.peerConnection?.connectionState }));

			if (this.peerConnection?.connectionState === 'connected') {
				this.logStats(this.peerConnection);
			}
		});
	}

	async startCall() {
		if (!this.webSocket) {
			throw new Error('Connection to signaling server is not initialized');
		}

		if (this.peerConnection) {
			console.warn('PeerConnection уже существует, startOffer пропущен');

			return;
		}

		console.log('📞 Sending ready signal to server...');

		this.webSocket.send(JSON.stringify({ type: 'ready' }));
	}

	private async startOffer() {
		console.log('🎬 startOffer — создаём peerConnection и локальный поток');

		// Инициализация peerConnection (если ещё не создан)
		if (!this.peerConnection) {
			this.peerConnection = new RTCPeerConnection({
				iceServers: [STUN_SERVERS, ...(IS_TURN_SERVERS_USED ? [TURN_SERVERS] : [])],
				iceTransportPolicy: 'all',
			});

			this.setupPeerConnectionEvents();
		}

		/**
		 * RTC Offer
		 */
		if (!this.localStream) {
			await this.createLocalStream();
		}

		// Создаём офер
		const offer = await this.peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
		await this.peerConnection.setLocalDescription(offer);

		console.log('Local SDP ->', this.peerConnection.localDescription?.sdp);

		// Отправляем офер через WebSocket
		this.webSocket?.send(JSON.stringify({ type: 'offer', offer }));
	}

	endCall() {
		console.log('endCall');

		if (typeof window !== 'undefined') {
			window.clearInterval(this.logIntervalMs);
		}

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

		this.localStream = undefined;
		this.remoteStream = undefined;

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

		navigator.mediaDevices.enumerateDevices().then((devices) => {
			// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
			devices.forEach((d) => console.log(`Media devices - ${d.kind}: ${d.label} id=${d.deviceId}`));
		});

		this.localStream.getAudioTracks()[0].onmute = () => console.warn('local track muted');

		this.localStream.getAudioTracks()[0].onunmute = () => console.warn('local track unmuted');

		const stream = this.localStream;

		// Включаем все аудио и видео треки перед добавлением
		stream.getTracks().forEach((track) => {
			track.enabled = true; // включаем трек
			this.peerConnection?.addTrack(track, stream);
		});

		console.log('[Local stream] audio tracks ->', this.localStream.getAudioTracks());

		console.log(
			'[Local stream] all tracks ->',
			stream
				.getTracks()
				.map((track) => ({ kind: track.kind, readyState: track.readyState, enabled: track.enabled })),
		);

		console.log('Track transmitters ->', this.peerConnection?.getSenders());

		this.dispatchEvent(new CustomEvent('localStream', { detail: stream }));
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
		if (typeof window === 'undefined') {
			return;
		}

		this.logIntervalMs = window.setInterval(async () => {
			peerConnection.getReceivers().forEach((r) => {
				console.log('getReceivers info -> ', r.track.kind, r.track.enabled, r.track.readyState);
			});

			const stats = await peerConnection.getStats();

			const audio = { inbound: {}, outbound: {} };

			stats.forEach((report) => {
				if (report.type === 'candidate-pair' && report.state === 'succeeded') {
					const local = stats.get(report.localCandidateId);
					const remote = stats.get(report.remoteCandidateId);

					// candidateType might be - 'host', 'srflx', 'prflx', 'relay'
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
	}
}
