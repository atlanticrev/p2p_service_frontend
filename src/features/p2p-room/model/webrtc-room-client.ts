import { P2P_ROOM_STUN_SERVER } from '@/src/features/p2p-room/model/p2p-room-config';
import type { TRoomState } from '@/src/shared/types/p2p-room';
import {
	attachLocalTracksToPeerConnection,
	applySenderQualityProfile,
	getPrimaryTrackEnabled,
	setTrackEnabled,
} from './webrtc-room-client-track-controls';
import { bindPeerConnectionEvents } from './webrtc-room-client-peer-events';
import type { TSignalMessage } from './webrtc-room-client-signal';
import { processSignalMessage } from './webrtc-room-client-signal-processor';
import { createSignalingSocketConnection } from './webrtc-room-client-socket-connection';
import { startPeerConnectionStatsLogging } from './webrtc-room-client-stats-debug';
import { teardownCallSessionResources } from './webrtc-room-client-teardown';
import { buildWebSocketUrl } from './webrtc-room-client-url';
import { createLocalMediaSession } from './webrtc-room-client-local-media';

export class WebrtcRoomClient extends EventTarget {
	private readonly defaultMicrophoneEnabled = true;

	private readonly defaultCameraEnabled = false;

	private webSocket: WebSocket | null = null;

	private peerConnection: RTCPeerConnection | null = null;

	private initPromise: Promise<void> | null = null;

	private audioContext: AudioContext | null = null;

	private outgoingGainNode: GainNode | null = null;

	private readonly webSocketUrl: string;

	localStream: MediaStream | undefined;

	localOutgoingStream: MediaStream | undefined;

	remoteStream: MediaStream | undefined;

	logIntervalMs: number | undefined = 0;

	constructor(serverUrl: string) {
		super();

		this.webSocketUrl = buildWebSocketUrl(serverUrl);
	}

	private ensurePeerConnection() {
		if (this.peerConnection) {
			return this.peerConnection;
		}

		this.peerConnection = new RTCPeerConnection({
			iceServers: [P2P_ROOM_STUN_SERVER],
		});

		this.setupPeerConnectionEvents();

		return this.peerConnection;
	}

	private emitRoomState(roomState: TRoomState) {
		this.dispatchEvent(
			new CustomEvent<TRoomState>('roomState', {
				detail: roomState,
			}),
		);
	}

	private emitRoomFull(message: string) {
		this.dispatchEvent(new CustomEvent('roomFull', { detail: message }));
	}

	private emitStatus(message: string) {
		this.dispatchEvent(new CustomEvent('status', { detail: message }));
	}

	private emitErrorEvent(error: unknown) {
		this.dispatchEvent(new CustomEvent('error', { detail: error }));
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
			const handleSocketClose = () => {
				if (this.webSocket === socket) {
					this.webSocket = null;
				}
			};

			const handleSignalMessage = async (data: TSignalMessage) => {
				try {
					await processSignalMessage(data, {
						ensurePeerConnection: () => this.ensurePeerConnection(),
						getPeerConnection: () => this.peerConnection,
						hasLocalStream: () => Boolean(this.localStream),
						createLocalStream: () => this.createLocalStream(),
						attachExistingLocalTracks: () => this.attachExistingLocalTracksToPeerConnection(),
						onPeerHangup: () => this.handlePeerLeft(),
						onStartOffer: () => this.startOffer(),
						sendSignalMessage: (message) => {
							this.webSocket?.send(JSON.stringify(message));
						},
						emitRoomState: (roomState) => {
							this.emitRoomState(roomState);
						},
						emitRoomFull: (message) => {
							this.emitRoomFull(message);
						},
						emitStatus: (message) => {
							this.emitStatus(message);
						},
						emitSignalingError: (message) => {
							this.emitErrorEvent(message);
						},
					});
				} catch (error) {
					this.emitErrorEvent(error);
				}
			};

			const { socket, ready } = createSignalingSocketConnection({
				webSocketUrl: this.webSocketUrl,
				onSignalMessage: handleSignalMessage,
				onSocketClose: handleSocketClose,
			});

			this.webSocket = socket;
			void ready.then(resolve).catch(reject);
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

		const peerConnection = this.peerConnection;

		const sendCandidate = (candidate: RTCIceCandidate) => {
			this.webSocket?.send(JSON.stringify({ type: 'candidate', candidate }));
		};

		const onRemoteStream = (remoteStream: MediaStream) => {
			this.dispatchEvent(new CustomEvent('remoteStream', { detail: remoteStream }));
		};

		const onConnectionStateChange = (connectionState: RTCPeerConnectionState | undefined) => {
			this.dispatchEvent(new CustomEvent('connectionState', { detail: connectionState }));
		};

		const onPeerConnected = (connectedPeerConnection: RTCPeerConnection) => {
			this.logIntervalMs = startPeerConnectionStatsLogging(connectedPeerConnection);
		};

		bindPeerConnectionEvents({
			peerConnection,
			sendCandidate,
			onRemoteStream,
			onConnectionStateChange,
			onPeerConnected,
		});
	}

	private attachExistingLocalTracksToPeerConnection() {
		if (!this.peerConnection || !this.localOutgoingStream) {
			return;
		}

		const attachedTracksCount = attachLocalTracksToPeerConnection(
			this.peerConnection,
			this.localOutgoingStream,
		);

		if (attachedTracksCount > 0) {
			console.log('Reattached local tracks to peer connection:', attachedTracksCount);
			applySenderQualityProfile(this.peerConnection);
		}
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

		const peerConnection = this.ensurePeerConnection();

		/**
		 * RTC Offer
		 */
		if (!this.localStream) {
			await this.createLocalStream();
		}

		this.attachExistingLocalTracksToPeerConnection();

		// Создаём офер
		const offer = await peerConnection.createOffer({
			offerToReceiveAudio: true,
			offerToReceiveVideo: true,
		});
		await peerConnection.setLocalDescription(offer);

		console.log('Local SDP ->', peerConnection.localDescription?.sdp);

		// Отправляем офер через WebSocket
		this.webSocket?.send(JSON.stringify({ type: 'offer', offer }));
	}

	isMicrophoneEnabled() {
		return getPrimaryTrackEnabled('audio', this.localStream, this.localOutgoingStream);
	}

	isCameraEnabled() {
		return getPrimaryTrackEnabled('video', this.localStream, this.localOutgoingStream);
	}

	setMicrophoneEnabled(enabled: boolean) {
		const hasTrack = setTrackEnabled('audio', enabled, this.localStream, this.localOutgoingStream);

		return hasTrack ? (this.isMicrophoneEnabled() ?? enabled) : null;
	}

	setCameraEnabled(enabled: boolean) {
		const hasTrack = setTrackEnabled('video', enabled, this.localStream, this.localOutgoingStream);

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

	private teardownCallSession(options?: {
		notifyRemote?: boolean;
		eventType?: 'endCall' | 'peerLeft' | null;
		preserveLocalMedia?: boolean;
	}) {
		const notifyRemote = options?.notifyRemote ?? true;
		const eventType = options?.eventType ?? null;
		const preserveLocalMedia = options?.preserveLocalMedia ?? false;

		console.log('teardownCallSession', { notifyRemote, eventType, preserveLocalMedia });
		const teardownResult = teardownCallSessionResources({
			notifyRemote,
			eventType,
			preserveLocalMedia,
			logIntervalMs: this.logIntervalMs,
			webSocket: this.webSocket,
			peerConnection: this.peerConnection,
			localStream: this.localStream,
			localOutgoingStream: this.localOutgoingStream,
			remoteStream: this.remoteStream,
			audioContext: this.audioContext,
			outgoingGainNode: this.outgoingGainNode,
			dispatchClientEvent: (nextEventType) => {
				this.dispatchEvent(new CustomEvent(nextEventType));
			},
		});

		this.peerConnection = teardownResult.peerConnection;
		this.localStream = teardownResult.localStream;
		this.localOutgoingStream = teardownResult.localOutgoingStream;
		this.remoteStream = teardownResult.remoteStream;
		this.audioContext = teardownResult.audioContext;
		this.outgoingGainNode = teardownResult.outgoingGainNode;
	}

	private handlePeerLeft() {
		this.teardownCallSession({ notifyRemote: false, eventType: 'peerLeft', preserveLocalMedia: true });
	}

	endCall(options?: { notifyRemote?: boolean }) {
		this.teardownCallSession({ notifyRemote: options?.notifyRemote ?? true, eventType: 'endCall' });
	}

	leaveRoom(options?: { notifyRemote?: boolean }) {
		this.endCall(options);
	}

	private async createLocalStream() {
		/**
		 * This works only with HTTPS
		 */
		// @todo Обработать ошибки при запросе user media
		const localMediaSession = await createLocalMediaSession({
			peerConnection: this.peerConnection,
			defaultMicrophoneEnabled: this.defaultMicrophoneEnabled,
			defaultCameraEnabled: this.defaultCameraEnabled,
		});

		this.localStream = localMediaSession.localStream;
		this.localOutgoingStream = localMediaSession.localOutgoingStream;
		this.audioContext = localMediaSession.audioContext;
		this.outgoingGainNode = localMediaSession.outgoingGainNode;

		this.dispatchEvent(new CustomEvent('localStream', { detail: this.localStream }));
	}

	cleanUp() {
		console.log('cleanUp');

		this.leaveRoom();

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
}
