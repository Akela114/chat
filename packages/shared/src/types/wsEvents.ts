import type { DTOChat, DTOMessage } from "./dto";

export type WSEvent = 'unauthorized' | 'authorized' | 'chatCreated' | 'chatMessageAdded';

export type WSPayload = {
    event: 'unauthorized' | 'authorized';
    payload: null;
} | {
    event: 'chatMessageAdded';
    payload: DTOMessage;
} | {
    event: 'chatCreated';
    payload: DTOChat;
}