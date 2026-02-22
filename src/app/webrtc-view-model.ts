import { IS_TURN_SERVERS_USED, STUN_SERVERS, TURN_SERVERS } from '@/src/app/config';

// export type TWebRTCEvent = 'localStream' | 'remoteStream' | 'connectionState' | 'error';

type TSignalMessage =
	| { type: 'offer'; offer: RTCSessionDescriptionInit }
	| { type: 'answer'; answer: RTCSessionDescriptionInit }
	| { type: 'candidate'; candidate: RTCIceCandidateInit }
	| { type: 'startOffer' }
	| { type: 'ready' }
	| { type: 'hangup' }
	| { type: 'status'; message: string }
	| { type: 'roomState'; participants: number; capacity: number }
	| { type: 'roomFull'; message?: string }
	| { type: 'error'; message?: string };

export type TRoomState = {
	participants: number;
	capacity: number;
};

type TLegacyGetUserMedia = (
	constraints: MediaStreamConstraints,
	successCallback: (stream: MediaStream) => void,
	errorCallback: (error: DOMException) => void,
) => void;

const HIGH_QUALITY_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
	width: { min: 640, ideal: 1920, max: 3840 },
	height: { min: 480, ideal: 1080, max: 2160 },
	frameRate: { ideal: 30, max: 60 },
	facingMode: 'user',
};

const HIGH_QUALITY_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
	echoCancellation: true,
	noiseSuppression: true,
	autoGainControl: true,
	channelCount: { ideal: 2, max: 2 },
	sampleRate: { ideal: 48_000 },
	sampleSize: { ideal: 16 },
};

export class WebrtcViewModel extends EventTarget {
	private readonly defaultMicrophoneEnabled = true;

	private readonly defaultCameraEnabled = false;

	private webSocket: WebSocket | null = null;

	private peerConnection: RTCPeerConnection | null = null;

	private initPromise: Promise<void> | null = null;

	private audioContext: AudioContext | null = null;

	private outgoingGainNode: GainNode | null = null;

	private readonly webSocketUrl: string;

	private readonly httpBaseUrl: string;

	localStream: MediaStream | undefined;

	localOutgoingStream: MediaStream | undefined;

	remoteStream: MediaStream | undefined;

	logIntervalMs: number | undefined = 0;

	constructor(serverUrl: string) {
		super();

		this.webSocketUrl = this.buildWebSocketUrl(serverUrl);
		this.httpBaseUrl = this.buildHttpBaseUrl(serverUrl);
	}

	private buildWebSocketUrl(url: string) {
		try {
			const parsed = new URL(url);

			if (parsed.protocol === 'http:') {
				parsed.protocol = 'ws:';
			}

			if (parsed.protocol === 'https:') {
				parsed.protocol = 'wss:';
			}

			return parsed.toString();
		} catch {
			return url;
		}
	}

	private buildHttpBaseUrl(url: string) {
		try {
			const parsed = new URL(url);

			if (parsed.protocol === 'ws:') {
				parsed.protocol = 'http:';
			}

			if (parsed.protocol === 'wss:') {
				parsed.protocol = 'https:';
			}

			return parsed.origin;
		} catch {
			return url;
		}
	}

	async getRoomState(): Promise<TRoomState> {
		const roomStateUrl = new URL('/room-state', this.httpBaseUrl).toString();
		const response = await fetch(roomStateUrl, { cache: 'no-store' });

		if (!response.ok) {
			throw new Error(`Failed to fetch room state: ${response.status}`);
		}

		const data = (await response.json()) as Partial<TRoomState>;

		return {
			participants: typeof data.participants === 'number' ? data.participants : 0,
			capacity: typeof data.capacity === 'number' ? data.capacity : 2,
		};
	}

	private async requestUserMedia(constraints: MediaStreamConstraints) {
		if (navigator.mediaDevices?.getUserMedia) {
			return navigator.mediaDevices.getUserMedia(constraints);
		}

		const legacyNavigator = navigator as Navigator & {
			getUserMedia?: TLegacyGetUserMedia;
			webkitGetUserMedia?: TLegacyGetUserMedia;
			mozGetUserMedia?: TLegacyGetUserMedia;
		};

		const legacyGetUserMedia =
			legacyNavigator.getUserMedia || legacyNavigator.webkitGetUserMedia || legacyNavigator.mozGetUserMedia;

		if (legacyGetUserMedia) {
			return new Promise<MediaStream>((resolve, reject) => {
				legacyGetUserMedia.call(navigator, constraints, resolve, reject);
			});
		}

		const secureContextInfo = typeof window !== 'undefined' ? `secure=${String(window.isSecureContext)} protocol=${window.location.protocol}` : 'secure=unknown';
		throw new Error(`getUserMedia is unavailable in this browser/context (${secureContextInfo})`);
	}

	async init() {
		if (this.webSocket?.readyState === WebSocket.OPEN) {
			return;
		}

		if (this.initPromise) {
			await this.initPromise;

			return;
		}

		this.initPromise = new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(this.webSocketUrl);
			this.webSocket = socket;

			socket.addEventListener('message', async (event) => {
				const data: TSignalMessage = JSON.parse(event.data);

				// @todo Debug
				try {
					if (data.type === 'roomState') {
						this.dispatchEvent(
							new CustomEvent<TRoomState>('roomState', {
								detail: { participants: data.participants, capacity: data.capacity },
							}),
						);

						return;
					}

					if (data.type === 'roomFull') {
						this.dispatchEvent(new CustomEvent('roomFull', { detail: data.message ?? 'Room is full' }));

						return;
					}

					if (data.type === 'status') {
						this.dispatchEvent(new CustomEvent('status', { detail: data.message }));

						return;
					}

					if (data.type === 'error') {
						this.dispatchEvent(new CustomEvent('error', { detail: data.message ?? 'Signaling server error' }));

						return;
					}

					if (data.type === 'hangup') {
						this.endCall({ notifyRemote: false });
						this.destroy();

						return;
					}

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
								// iceTransportPolicy: 'all',
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

			const onOpen = () => {
				resolve();
			};

			const onError = (event: Event) => {
				reject(event);
			};

			socket.addEventListener('open', onOpen, { once: true });
			socket.addEventListener('error', onError, { once: true });
			socket.addEventListener('close', () => {
				if (this.webSocket === socket) {
					this.webSocket = null;
				}
			});
		});

		try {
			await this.initPromise;
		} catch (error) {
			this.webSocket?.close();
			this.webSocket = null;
			throw error;
		} finally {
			this.initPromise = null;
		}
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

	private applySenderQualityProfile() {
		if (!this.peerConnection) {
			return;
		}

		this.peerConnection.getSenders().forEach((sender) => {
			const track = sender.track;

			if (!track) {
				return;
			}

			const parameters = sender.getParameters();
			parameters.encodings = parameters.encodings && parameters.encodings.length > 0 ? parameters.encodings : [{}];

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
	}

	async startCall() {
		if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
			await this.init();
		}

		if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
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

	private getPrimaryTrackEnabled(kind: 'audio' | 'video') {
		if (kind === 'audio') {
			return this.localOutgoingStream?.getAudioTracks()[0]?.enabled ?? this.localStream?.getAudioTracks()[0]?.enabled ?? null;
		}

		return this.localStream?.getVideoTracks()[0]?.enabled ?? this.localOutgoingStream?.getVideoTracks()[0]?.enabled ?? null;
	}

	private setTrackEnabled(kind: 'audio' | 'video', enabled: boolean) {
		const targetStreams = [this.localStream, this.localOutgoingStream];

		let hasTrack = false;
		const processedTrackIds = new Set<string>();

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
	}

	isMicrophoneEnabled() {
		return this.getPrimaryTrackEnabled('audio');
	}

	isCameraEnabled() {
		return this.getPrimaryTrackEnabled('video');
	}

	setMicrophoneEnabled(enabled: boolean) {
		const hasTrack = this.setTrackEnabled('audio', enabled);

		return hasTrack ? (this.isMicrophoneEnabled() ?? enabled) : null;
	}

	setCameraEnabled(enabled: boolean) {
		const hasTrack = this.setTrackEnabled('video', enabled);

		return hasTrack ? (this.isCameraEnabled() ?? enabled) : null;
	}

	toggleMicrophone() {
		const nextEnabled = !(this.isMicrophoneEnabled() ?? true);

		return this.setMicrophoneEnabled(nextEnabled);
	}

	toggleCamera() {
		const nextEnabled = !(this.isCameraEnabled() ?? true);

		return this.setCameraEnabled(nextEnabled);
	}

	endCall(options?: { notifyRemote?: boolean }) {
		const notifyRemote = options?.notifyRemote ?? true;

		console.log('endCall');

		if (typeof window !== 'undefined') {
			window.clearInterval(this.logIntervalMs);
		}

		const stoppedTrackIds = new Set<string>();
		const stopStreamTracks = (stream?: MediaStream) => {
			stream?.getTracks().forEach((track) => {
				if (stoppedTrackIds.has(track.id)) {
					return;
				}

				track.stop();
				stoppedTrackIds.add(track.id);
			});
		};

		// 1. Остановить локальные треки
		stopStreamTracks(this.localOutgoingStream);
		stopStreamTracks(this.localStream);

		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
		}

		this.outgoingGainNode = null;

		// 2. Закрыть соединение
		if (this.peerConnection) {
			this.peerConnection.ontrack = null;
			this.peerConnection.onicecandidate = null;
			this.peerConnection.close();
			this.peerConnection = null;
		}

		this.localStream = undefined;
		this.localOutgoingStream = undefined;
		this.remoteStream = undefined;

		// 3. Сообщить удалённой стороне
		if (notifyRemote && this.webSocket?.readyState === WebSocket.OPEN) {
			this.webSocket.send(JSON.stringify({ type: 'hangup' }));
		}

		this.dispatchEvent(new CustomEvent('endCall'));
	}

	private async createLocalStream() {
		/**
		 * This works only with HTTPS
		 */
		// @todo Обработать ошибки при запросе user media
		this.localStream = await this.requestUserMedia({
			video: HIGH_QUALITY_VIDEO_CONSTRAINTS,
			audio: HIGH_QUALITY_AUDIO_CONSTRAINTS,
		});

		if (navigator.mediaDevices?.enumerateDevices) {
			navigator.mediaDevices.enumerateDevices().then((devices) => {
				// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
				devices.forEach((d) => console.log(`Media devices - ${d.kind}: ${d.label} id=${d.deviceId}`));
			});
		}

		const [localAudioTrack] = this.localStream.getAudioTracks();
		const localVideoTracks = this.localStream.getVideoTracks();

		localVideoTracks.forEach((track) => {
			track.contentHint = 'detail';
			track.enabled = this.defaultCameraEnabled;
		});

		if (localAudioTrack) {
			localAudioTrack.enabled = this.defaultMicrophoneEnabled;
			localAudioTrack.onmute = () => console.warn('local track muted');
			localAudioTrack.onunmute = () => console.warn('local track unmuted');
		}

		const outgoingStream = new MediaStream(localVideoTracks);

		if (localAudioTrack) {
			const boostedAudioTrack = this.createBoostedAudioTrack(this.localStream, localAudioTrack);
			boostedAudioTrack.enabled = this.defaultMicrophoneEnabled;
			outgoingStream.addTrack(boostedAudioTrack);
		}

		this.localOutgoingStream = outgoingStream;

		// Применяем дефолтные состояния треков (mic on / cam off) перед добавлением.
		outgoingStream.getTracks().forEach((track) => {
			track.enabled = track.kind === 'audio' ? this.defaultMicrophoneEnabled : this.defaultCameraEnabled;
			this.peerConnection?.addTrack(track, outgoingStream);
		});

		this.applySenderQualityProfile();

		console.log('[Local stream] audio tracks ->', this.localStream.getAudioTracks());

		console.log(
			'[Local stream] all tracks ->',
			outgoingStream
				.getTracks()
				.map((track) => ({ kind: track.kind, readyState: track.readyState, enabled: track.enabled })),
		);

		console.log('Track transmitters ->', this.peerConnection?.getSenders());

		this.dispatchEvent(new CustomEvent('localStream', { detail: this.localStream }));
	}

	private createBoostedAudioTrack(sourceStream: MediaStream, fallbackTrack: MediaStreamTrack) {
		try {
			const AudioContextCtor =
				window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

			if (!AudioContextCtor) {
				return fallbackTrack;
			}

			this.audioContext = new AudioContextCtor();
			const sourceNode = this.audioContext.createMediaStreamSource(sourceStream);
			const destinationNode = this.audioContext.createMediaStreamDestination();

			this.outgoingGainNode = this.audioContext.createGain();
			this.outgoingGainNode.gain.value = 1.8;

			sourceNode.connect(this.outgoingGainNode);
			this.outgoingGainNode.connect(destinationNode);

			if (this.audioContext.state === 'suspended') {
				void this.audioContext.resume();
			}

			const boostedAudioTrack = destinationNode.stream.getAudioTracks()[0];

			if (!boostedAudioTrack) {
				return fallbackTrack;
			}

			boostedAudioTrack.contentHint = 'speech';

			return boostedAudioTrack;
		} catch (error) {
			console.warn('Failed to create boosted outgoing track, fallback to raw microphone track', error);

			return fallbackTrack;
		}
	}

	cleanUp() {
		console.log('cleanUp');

		this.endCall();

		this.destroy();
	}

	destroy() {
		console.log('destroy');

		this.peerConnection?.close();
		this.peerConnection = null;

		this.webSocket?.close();
		this.webSocket = null;
		this.initPromise = null;
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
