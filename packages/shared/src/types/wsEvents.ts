import type { DTOChat, DTOMessage, DTOUser } from "./dto";

export type WSEvent = 'unauthorized' | 'authorized' | 'chatCreated' | 'chatMessageAdded' | 'chatParticipantAdded' | 'chatParticipantRemoved';

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
} | {
    event: 'chatParticipantRemoved';
    payload: DTOUser;
}