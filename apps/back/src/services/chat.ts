import type { DTOAddedParticipant, DTOChat, DTOChatWithMessages, DTOMessage, DTOUser, RequestAddChatParticipant, RequestAddMessage, RequestCreateChat, WSEvent, WSPayload } from "@packages/shared/types";
import { ValidationError } from "../errors/validationError.ts";
import type { ChatRepo } from "../repos/chat.ts";
import type { UserRepo } from "../repos/user.ts";
import { NotFoundError } from "../errors/notFoundError.ts";
import { ForbiddenError } from "../errors/forbiddenError.ts";
import { randomUUID } from 'crypto'

type TChatUpdateSubscriberCallback = <T extends WSEvent>(
    participantsIds: number[],
    event: WSEvent,
    message: Extract<WSPayload, { event: T }>['payload']
) => void

export class ChatService {
    #chatRepo: ChatRepo
    #userRepo: UserRepo
    #chatUpdatesSubscribers: Map<string, TChatUpdateSubscriberCallback> = new Map();

    constructor(chatRepo: ChatRepo, userRepo: UserRepo) {
        this.#chatRepo = chatRepo;
        this.#userRepo = userRepo;
    }

    async getChatsByParticipant(authorizedUser: { id: number }): Promise<DTOChat[]> {
        const result = await this.#chatRepo.getChatsByParticipant(authorizedUser.id);
        return result.map((chat) => ({
            id: chat.id,
            name: chat.name,
            participants: chat.participants.map((participant) => ({
                id: participant.user_id,
                username: participant.username,
            }))
        }))
    }

    async createChatWithUser(payload: unknown, authorizedUser: { id: number }): Promise<DTOChat> {
        this.#validateCreateChatWithUserPayload(payload);
        const user = await this.#userRepo.getUserByUsername(payload.username);
        if (!user) {
            throw new ValidationError('user to create a chat with not found');
        }
        if (user.id === authorizedUser.id) {
            throw new ValidationError('cannot create a chat with yourself');
        }
        const result = await this.#chatRepo.createChat([user.id, authorizedUser.id]);
        const formattedResult = {
            id: result.id,
            name: result.name,
            participants: result.participants.map((participant) => ({
                id: participant.user_id,
                username: participant.username,
            }))
        }

        this.#notifyChatUpdatesSubscribers(
            [user.id],
            'chatCreated',
            formattedResult
        )
        return formattedResult
    }

    async getChatById(params: unknown, authorizedUser: { id: number }): Promise<DTOChatWithMessages> {
        this.#validateGetChatByIdParams(params);
        const result = await this.#chatRepo.getChatById(Number(params.id));
        if (!result) {
            throw new NotFoundError('chat not found');
        }
        if (!result.participants.some((participant) => participant.user_id === authorizedUser.id)) {
            throw new ForbiddenError('not allowed to access this chat');
        }
        return {
            id: result.id,
            name: result.name,
            participants: result.participants.map((participant) => ({
                id: participant.user_id,
                username: participant.username,
            })),
            messages: result.messages
        }
    }

    async addChatMessage(
        params: unknown, payload: unknown, authorizedUser: { id: number }
    ): Promise<DTOMessage> {
        this.#validateAddChatMessagePayload(payload);
        this.#validateAddChatMessageParams(params);
        const chat = await this.getChatById({ id: params.id }, authorizedUser);
        if (!chat) {
            throw new NotFoundError('chat not found');
        }
        if (!chat.participants.some((participant) => participant.id === authorizedUser.id)) {
            throw new ForbiddenError('not allowed to access this chat');
        }
        const result = await this.#chatRepo.addChatMessage(chat.id, authorizedUser.id, payload.text);
        const formattedResult = {
            id: result.id,
            chat_id: result.chat_id,
            sender_id: result.sender_id,
            text: result.text,
            created_at: result.created_at,
            updated_at: result.updated_at
        }
        
        this.#notifyChatUpdatesSubscribers(
            chat.participants.filter((participant) => participant.id !== authorizedUser.id).map((participant) => participant.id),
            'chatMessageAdded',
            formattedResult
        )
        return formattedResult
    }

    async addChatParticipant(
        params: unknown, payload: unknown, authorizedUser: { id: number }
    ): Promise<DTOAddedParticipant> {
        this.#validateAddChatParticipantPayload(payload);
        this.#validateAddChatParticipantParams(params);
        const chat = await this.getChatById({ id: params.id }, authorizedUser);
        if (chat.participants.some((participant) => participant.username === payload.username)) {
            throw new ValidationError('user is already a participant of this chat');
        }
        const user = await this.#userRepo.getUserByUsername(payload.username);
        if (!user) {
            throw new ValidationError('user not found');
        }
        const result = await this.#chatRepo.addChatParticipant(chat.id, user.id);
        const formattedResult = {
            id: result.id,
            username: result.username,
            chat_id: chat.id
        }
        this.#notifyChatUpdatesSubscribers(
            [...chat.participants.filter((participant) => participant.id !== user.id).map((participant) => participant.id), result.id],
            'chatParticipantAdded',
            formattedResult
        )
        return formattedResult
    }

    async getPossibleParticipants(params: unknown, authorizedUser: { id: number }): Promise<DTOUser[]> {
        this.#validateGetPossibleParticipantsParams(params);
        if (params.chatId) {
            const chat = await this.getChatById({ id: params.chatId }, authorizedUser);
            const result = await this.#chatRepo.getPossibleParticipants(chat.id);
            return result.map((user) => ({
                id: user.id,
                username: user.username
            }))
        }
        const result = await this.#chatRepo.getPossibleParticipants();
        return result.map((user) => ({
            id: user.id,
            username: user.username
        })).filter((user) => user.id !== authorizedUser.id)
    }

    addChatUpdatesSubscriber(subscriber: TChatUpdateSubscriberCallback) {
        const id = randomUUID();
        this.#chatUpdatesSubscribers.set(id, subscriber);
        return () => this.#chatUpdatesSubscribers.delete(id);
    }

    #notifyChatUpdatesSubscribers(participantsIds: number[], event: WSEvent, payload: Extract<WSPayload, { event: WSEvent }>['payload']) {
        this.#chatUpdatesSubscribers.forEach((subscriber) => subscriber(participantsIds, event, payload));
    }
    
    #validateGetChatByIdParams(params: unknown): asserts params is { id: string } {
        if (typeof params !== 'object' || params === null) {
            throw new ValidationError('params must be provided');
        }
        if (!('id' in params) || !params.id || isNaN(Number(params.id))) {
            throw new ValidationError('id must be a number');
        }
    }

    #validateCreateChatWithUserPayload(payload: unknown): asserts payload is RequestCreateChat {
        if (typeof payload !== 'object' || payload === null) {
            throw new ValidationError('payload must be an object');
        }
        if (!('username' in payload) || typeof payload.username !== 'string') {
            throw new ValidationError('username must be a string');
        }
    }

    #validateAddChatMessageParams(params: unknown): asserts params is { id: string } {
        if (typeof params !== 'object' || params === null) {
            throw new ValidationError('params must be provided');
        }
        if (!('id' in params) || !params.id || isNaN(Number(params.id))) {
            throw new ValidationError('id must be a number');
        }
    }

    #validateAddChatMessagePayload(payload: unknown): asserts payload is RequestAddMessage {
        if (typeof payload !== 'object' || payload === null) {
            throw new ValidationError('payload must be an object');
        }
        if (!('text' in payload) || typeof payload.text !== 'string') {
            throw new ValidationError('text must be a string');
        }
    }

    #validateAddChatParticipantPayload(payload: unknown): asserts payload is RequestAddChatParticipant {
        if (typeof payload !== 'object' || payload === null) {
            throw new ValidationError('payload must be an object');
        }
        if (!('username' in payload) || typeof payload.username !== 'string') {
            throw new ValidationError('username must be a string');
        }
    }

    #validateAddChatParticipantParams(params: unknown): asserts params is { id: string } {
        if (typeof params !== 'object' || params === null) {
            throw new ValidationError('params must be provided');
        }
        if (!('id' in params) || !params.id || isNaN(Number(params.id))) {
            throw new ValidationError('id must be a number');
        }
    }

    #validateGetPossibleParticipantsParams(params: unknown): asserts params is { chatId?: string } {
        if (typeof params !== 'object' || params === null) {
            throw new ValidationError('params must be provided');
        }
        if (('id' in params) && isNaN(Number(params.id))) {
            throw new ValidationError('id must be a number');
        }
    }
}