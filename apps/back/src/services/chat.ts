import type { DTOChat, DTOChatWithMessages, DTOMessage, RequestAddMessage, RequestCreateChat } from "@packages/shared/types";
import { ValidationError } from "../errors/validationError.ts";
import type { ChatRepo } from "../repos/chat.ts";
import type { UserRepo } from "../repos/user.ts";
import { NotFoundError } from "../errors/notFoundError.ts";
import { ForbiddenError } from "../errors/forbiddenError.ts";

export class ChatService {
    #chatRepo: ChatRepo
    #userRepo: UserRepo

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
        return {
            id: result.id,
            name: result.name,
            participants: result.participants.map((participant) => ({
                id: participant.user_id,
                username: participant.username,
            }))
        }
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
        const result = await this.#chatRepo.addChatMessage(chat.id, authorizedUser.id, payload.text);
        return {
            id: result.id,
            sender_id: result.sender_id,
            text: result.text,
            created_at: result.created_at,
            updated_at: result.updated_at
        }
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
}