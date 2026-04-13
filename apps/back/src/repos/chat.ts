import type { DBChatParticipant, DBChat, DBChatMessage, DBChatWithParticipants, DBChatWithParticipantsAndMessages, DBChatParticipantWithUsername, DBUser } from "../types/database.ts";

export class ChatRepo {
    #client: {
        query: <T>(query: string, values?: any[]) => Promise<{ rows: T[]}>
    }

    constructor(client: any) {
        this.#client = client
    }

    async getChatsByParticipant(participantId: number): Promise<DBChatWithParticipants[]> {
        const result = await this.#client.query<DBChatWithParticipants>(
            `SELECT chats.*, 
                (SELECT COUNT(*)::int 
                FROM messages 
                WHERE chat_id = chats.id 
                AND id > COALESCE(
                    (SELECT last_read_message_id FROM chat_participants WHERE chat_id = chats.id AND user_id = $1),
                    0
                )) as unread_count,
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
                AND cp.disabled = false
                AND cp.user_id = $1
            ) AND chat_participants.disabled = false
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
            WHERE chat_id = $1 AND disabled = false`,
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

    async getUnreadCount(chatId: number, userId: number): Promise<number> {
        const result = await this.#client.query<{unread_count: number}>(
            `SELECT (SELECT COUNT(*)::int 
                FROM messages 
                WHERE chat_id = $1 
                AND id > COALESCE(
                    (SELECT last_read_message_id FROM chat_participants WHERE chat_id = $1 AND user_id = $2),
                    0
                )) as unread_count`,
            [chatId, userId]
        );
        return result.rows[0].unread_count
    }

    async getPossibleParticipants(chatId?: number): Promise<DBUser[]> {
        if (chatId) {
            const result = await this.#client.query<DBUser>(
                'SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM chat_participants WHERE chat_id = $1 AND disabled = false)',
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
                unread_count: 0,
                participants: createdChatParticipants.rows
            };
        } catch (error) {
            await this.#client.query('ROLLBACK');
            throw error;
        }
       
    }

    async addChatMessage(chatId: number, senderId: number, text: string): Promise<DBChatMessage> {
        const result = await this.#client.query<DBChatMessage>(
            'INSERT INTO messages (chat_id, sender_id, text) VALUES ($1, $2, $3) RETURNING *',
            [chatId, senderId, text]
        );
        return result.rows[0];
    }

    async addChatParticipant(chatId: number, userId: number): Promise<DBUser> {
        const existingParticipant = await this.#client.query<DBChatParticipant>(
            'SELECT * FROM chat_participants WHERE chat_id = $1 AND user_id = $2',
            [chatId, userId]
        )
        if (existingParticipant.rows.length > 0) {
            await this.#client.query<DBChatParticipant>(
                'UPDATE chat_participants SET disabled = false WHERE chat_id = $1 AND user_id = $2',
                [chatId, userId]
            );
        } else {
            await this.#client.query<DBChatParticipant>(
                'INSERT INTO chat_participants (user_id, chat_id) VALUES ($1, $2) RETURNING *',
                [userId, chatId]
            );
        }
        const result = await this.#client.query<DBUser>(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );
        return result.rows[0];
    }

    async readChatMessage(chatId: number, userId: number, messageId: number): Promise<void> {
        await this.#client.query<DBChatParticipant>(
            'UPDATE chat_participants SET last_read_message_id = $1 WHERE chat_id = $2 AND user_id = $3',
            [messageId, chatId, userId]
        );
    }

    async disableChatParticipant(chatId: number, userId: number): Promise<DBUser> {
        await this.#client.query<DBChatParticipant>(
            'UPDATE chat_participants SET disabled = true WHERE chat_id = $1 AND user_id = $2',
            [chatId, userId]
        );
        const result = await this.#client.query<DBUser>(
            'SELECT * FROM users WHERE id = $1',
            [userId]
        );
        return result.rows[0];
    }
}