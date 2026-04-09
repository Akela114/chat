
export interface DBUser {
    id: number,
    username: string,
    password_hash: string
}

export interface DBChat {
    id: number,
    name: string | null
}

export interface DBChatParticipant {
    id: number,
    user_id: number,
    chat_id: number
}

export interface DBChatWithParticipants extends DBChat {
    participants: DBChatParticipant[]
}

export interface DBChatWithParticipantsAndMessages extends DBChat {
    participants: DBChatParticipant[]
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
