import type { DTOChat, DTOMessage, DTOUser } from "./dto";

export type WSEvent = 'unauthorized' | 'authorized' | 'chatCreated' | 'chatMessageAdded' | 'chatParticipantAdded';

export type WSPayload = {
    event: 'unauthorized' | 'authorized';
    payload: null;
} | {
    event: 'chatMessageAdded';
    payload: DTOMessage;
} | {
    event: 'chatCreated';
    payload: DTOChat;
} | {
    event: 'chatParticipantAdded';
    payload: DTOUser;
}