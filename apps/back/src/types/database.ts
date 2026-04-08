
export interface DBUser {
    id: number,
    username: string,
    password: string
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

export interface DBMessage {
    id: number,
    text: string,
    sender_id: number,
    chat_id: number,
    created_at: Date,
    updated_at: Date
}
