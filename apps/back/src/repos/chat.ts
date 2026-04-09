import type { Client } from "pg";
import type { DBChatParticipant, DBChat, DBChatMessage, DBChatWithParticipants, DBChatWithParticipantsAndMessages } from "../types/database.ts";

export class ChatRepo {
    #client: Client

    constructor(client: Client) {
        this.#client = client
    }

    async getChatsByParticipant(participantId: number): Promise<DBChatWithParticipants[]> {
        const result = await this.#client.query<DBChatWithParticipants>(
            `SELECT chats.*, json_agg(chat_participants.*) as participants
            FROM chats
            JOIN chat_participants ON chat_participants.chat_id = chats.id
            WHERE chat_participants.user_id = $1
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
        const chatParticipants = await this.#client.query<DBChatParticipant>(
            'SELECT * FROM chat_participants WHERE chat_id = $1',
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

    async createChat(participantIds: number[]): Promise<DBChatWithParticipants> {
        try {
            await this.#client.query('BEGIN');
            const result = await this.#client.query<DBChat>(
                'INSERT INTO chats RETURNING *'
            );
            const createdChat = result.rows[0];
            const createdChatParticipants = await this.#client.query<DBChatParticipant>(
                `INSERT INTO chat_participants (user_id, chat_id)
                SELECT * FROM UNNEST($1::int[], $2::int[])
                RETURNING *`,
                [participantIds, Array.from({ length: participantIds.length }).fill(createdChat.id)]
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
}