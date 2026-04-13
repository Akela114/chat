
export interface DBUser {
    id: number,
    username: string,
    password_hash: string
}

export interface DBChat {
    id: number,
    name: string | null,
    unread_count: number
}

export interface DBChatParticipant {
    id: number,
    user_id: number,
    chat_id: number,
    last_read_message_id: number,
    disabled: boolean
}

export interface DBChatParticipantWithUsername extends DBChatParticipant {
    username: string
}

export interface DBChatWithParticipants extends DBChat {
    participants: DBChatParticipantWithUsername[]
}

export interface DBChatWithParticipantsAndMessages extends Omit<DBChat, "unread_count"> {
    participants: DBChatParticipantWithUsername[]
    messages: DBChatMessage[]
}

export interface DBChatMessage {
    id: number,
    text: string,
    sender_id: number,
    chat_id: number,
    created_at: Date,
    updated_at: Date
}
