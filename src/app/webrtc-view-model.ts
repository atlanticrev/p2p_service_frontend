// biome-ignore lint/style/useNamingConvention: <->
export type TWebRTCEvent = 'localStream' | 'remoteStream' | 'connectionState' | 'error';

export class WebrtcViewModel extends EventTarget {
	private ws: WebSocket | null = null;

	private peerConnection: RTCPeerConnection | null = null;

	private readonly serverUrl: string;

	constructor(serverUrl: string) {
		super();

		this.serverUrl = serverUrl;
	}

	async init() {
		this.ws = new WebSocket(this.serverUrl);

		this.peerConnection = new RTCPeerConnection({
			iceServers: [
				{ urls: 'stun:stun.l.google.com:19302' },
				{
					urls: 'turn:relay1.expressturn.com:3478',
					username: 'efProject',
					credential: 'efProject',
				},
			],
		});

		this.peerConnection.ontrack = (e) => {
			const stream = e.streams[0];

			this.dispatchEvent(new CustomEvent('remoteStream', { detail: stream }));
		};

		this.peerConnection.onicecandidate = (e) => {
			if (e.candidate) {
				this.ws?.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
			}
		};

		this.ws.onmessage = async (event) => {
			const data = JSON.parse(event.data);

			if (!this.peerConnection) {
				return;
			}

			try {
				if (data.type === 'offer') {
					await this.peerConnection.setRemoteDescription(data.offer);

					await this.createLocalStream();

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
		};

		this.peerConnection.onconnectionstatechange = () => {
			this.dispatchEvent(new CustomEvent('connectionState', { detail: this.peerConnection?.connectionState }));
		};
	}

	async startCall() {
		if (!this.peerConnection || !this.ws) {
			throw new Error('Not initialized');
		}

		await this.createLocalStream();

		const offer = await this.peerConnection.createOffer();

		await this.peerConnection.setLocalDescription(offer);

		this.ws.send(JSON.stringify({ type: 'offer', offer }));
	}

	private async createLocalStream(): Promise<MediaStream> {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

		// biome-ignore lint/suspicious/useIterableCallbackReturn: <->
		stream.getTracks().forEach((t) => this.peerConnection?.addTrack(t, stream));

		this.dispatchEvent(new CustomEvent('localStream', { detail: stream }));

		return stream;
	}

	destroy() {
		this.peerConnection?.close();

		this.ws?.close();
	}
}
