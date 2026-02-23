type TP2pRoomControlTexts = {
	muteOn: string;
	muteOff: string;
	cameraOn: string;
	cameraOff: string;
};

type TP2pRoomTexts = {
	roomTitle: string;
	roomLabel: string;
	roomHintPrefix: string;
	youLabel: string;
	peerLabel: string;
	youDisconnected: string;
	youConnecting: string;
	peerInRoom: string;
	peerRoomEmpty: string;
	joinButton: string;
	joiningButton: string;
	callConnected: string;
	callWaiting: string;
	callWaitingPeerJoin: string;
	callWaitingAlone: string;
	callStateConnected: string;
	callStateAlone: string;
	callStateWaiting: string;
	statusPrefix: string;
	notInRoom: string;
	roomBusy: string;
	roomBusyMessage: string;
	joinFailedMessage: string;
	joinFailedReasonPrefix: string;
	genericRoomFullReason: string;
	webrtcErrorMessage: string;
	remoteWaitingOverlay: string;
	exitCallButton: string;
	exitRoomButton: string;
	callExitAria: string;
	callControls: TP2pRoomControlTexts;
};

type TSharedTexts = {
	p2pRoom: TP2pRoomTexts;
};

export const sharedTexts: TSharedTexts = {
	p2pRoom: {
		roomTitle: 'Room #1',
		roomLabel: 'Комната',
		roomHintPrefix: 'В комнате:',
		youLabel: 'Вы',
		peerLabel: 'Собеседник',
		youDisconnected: 'Не подключены',
		youConnecting: 'Подключение...',
		peerInRoom: 'В комнате',
		peerRoomEmpty: 'Комната пуста',
		joinButton: 'Присоединиться к комнате',
		joiningButton: 'Подключаем...',
		callConnected: 'Соединение установлено',
		callWaiting: 'Ожидаем второго участника',
		callWaitingPeerJoin: 'Ожидаем подключение собеседника...',
		callWaitingAlone: 'В комнате никого кроме вас нет',
		callStateConnected: 'В звонке',
		callStateAlone: 'В комнате только вы',
		callStateWaiting: 'Ожидание собеседника',
		statusPrefix: 'Статус:',
		notInRoom: 'Не в комнате',
		roomBusy: 'Комната занята',
		roomBusyMessage: 'Комната уже занята. Попробуй зайти позже.',
		joinFailedMessage: 'Не удалось войти в комнату',
		joinFailedReasonPrefix: 'Не удалось войти:',
		genericRoomFullReason: 'Комната уже заполнена',
		webrtcErrorMessage: 'Не удалось подключиться к комнате. Проверь интернет и доступ к микрофону.',
		remoteWaitingOverlay: 'Ожидаем подключение собеседника...',
		exitCallButton: 'Выйти',
		exitRoomButton: 'Выйти из комнаты',
		callExitAria: 'Выйти из звонка',
		callControls: {
			muteOn: 'Выключить микрофон',
			muteOff: 'Включить микрофон',
			cameraOn: 'Выключить камеру',
			cameraOff: 'Включить камеру',
		},
	},
};
