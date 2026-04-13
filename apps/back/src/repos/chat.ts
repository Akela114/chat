import type { Client } from "pg";
import type { DBChatParticipant, DBChat, DBChatMessage, DBChatWithParticipants, DBChatWithParticipantsAndMessages, DBChatParticipantWithUsername, DBUser } from "../types/database.ts";

export class ChatRepo {
    #client: Client

    constructor(client: Client) {
        this.#client = client
    }

    async getChatsByParticipant(participantId: number): Promise<DBChatWithParticipants[]> {
        const result = await this.#client.query<DBChatWithParticipants>(
            `SELECT chats.*, 
                json_agg(json_build_object(
                    'id', chat_participants.id,
                    'user_id', chat_participants.user_id,
                    'chat_id', chat_participants.chat_id,
                    'username', users.username
                )) as participants
            FROM chats
            JOIN chat_participants ON chat_participants.chat_id = chats.id
            JOIN users ON users.id = chat_participants.user_id
            WHERE EXISTS (
                SELECT 1 
                FROM chat_participants cp 
                WHERE cp.chat_id = chats.id 
                AND cp.user_id = $1
            )
            GROUP BY chats.id`,
            [participantId]
        );
        return result.rows;
    }

    async getChatById(chatId: number): Promise<DBChatWithParticipantsAndMessages | null> {
        const result = await this.#client.query<DBChat>(
            'SELECT * FROM chats WHERE id = $1',
            [chatId]
        );
        const resultChat = result.rows[0];
        if (!resultChat) {
            return null
        }
        const chatParticipants = await this.#client.query<DBChatParticipantWithUsername>(
            `SELECT chat_participants.id, chat_participants.user_id, chat_participants.chat_id, users.username
            FROM chat_participants
            JOIN users ON users.id = chat_participants.user_id
            WHERE chat_id = $1`,
            [chatId]
        );
        const chatMessages = await this.#client.query<DBChatMessage>(
            'SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at',
            [chatId]
        );
        return {
            ...resultChat,
            participants: chatParticipants.rows,
            messages: chatMessages.rows
        }
    }

    async getPossibleParticipants(chatId?: number): Promise<DBUser[]> {
        if (chatId) {
            const result = await this.#client.query<DBUser>(
                'SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM chat_participants WHERE chat_id = $1)',
                [chatId]
            );
            return result.rows;
        }

        const result = await this.#client.query<DBUser>(
            'SELECT * FROM users'
        );
        return result.rows;
    }

    async createChat(participantIds: number[]): Promise<DBChatWithParticipants> {
        try {
            await this.#client.query('BEGIN');
            const result = await this.#client.query<DBChat>(
                'INSERT INTO chats DEFAULT VALUES RETURNING *'
            );
            const createdChat = result.rows[0];
            await this.#client.query<DBChatParticipant>(
                `INSERT INTO chat_participants (user_id, chat_id)
                SELECT * FROM UNNEST($1::int[], $2::int[])`,
                [participantIds, Array.from({ length: participantIds.length }).fill(createdChat.id)]
            );
            const createdChatParticipants = await this.#client.query<DBChatParticipantWithUsername>(
                `SELECT chat_participants.id, chat_participants.user_id, chat_participants.chat_id, users.username
                FROM chat_participants
                JOIN users ON users.id = chat_participants.user_id
                WHERE chat_id = $1`,
                [createdChat.id]
            );
            await this.#client.query('COMMIT');
            return {
                ...createdChat,
                participants: createdChatParticipants.rows
            };
        } catch (error) {
            await this.#client.query('ROLLBACK');
            throw error;
        }
       
    }

    async addChatMessage(chatId: number, senderId: number, text: string) {
        const result = await this.#client.query<DBChatMessage>(
            'INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *',
            [chatId, senderId, text]
        );
        return result.rows[0];
    }

    async addChatParticipant(chatId: number, userId: number) {
        await this.#client.query<DBChatParticipant>(
            'INSERT INTO chat_participants (user_id, chat_id) VALUES ($1, $2) RETURNING *',
            [userId, chatId]
        );
        const result = await this.#client.query<DBUser>(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );
        return result.rows[0];
    }
}