export type TSignalMessage =
	| {
			type: 'offer';
			offer: RTCSessionDescriptionInit;
	  }
	| {
			type: 'answer';
			answer: RTCSessionDescriptionInit;
	  }
	| {
			type: 'candidate';
			candidate: RTCIceCandidateInit;
	  }
	| {
			type: 'startOffer';
	  }
	| {
			type: 'ready';
	  }
	| {
			type: 'hangup';
	  }
	| {
			type: 'status';
			message: string;
	  }
	| {
			type: 'roomState';
			participants: number;
			capacity: number;
	  }
	| {
			type: 'roomFull';
			message?: string;
	  }
	| {
			type: 'error';
			message?: string;
	  };

export type TLegacyGetUserMedia = (
	constraints: MediaStreamConstraints,
	successCallback: (stream: MediaStream) => void,
	errorCallback: (error: DOMException) => void,
) => void;
