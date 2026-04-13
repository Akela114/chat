export interface DTOUser {
    id: number,
    username: string
}

export interface DTOAuth {
    token: string
    user: DTOUser
}

export interface DTOMessage {
    id: number,
    chat_id: number,
    text: string,
    sender_id: number,
    created_at: Date,
    updated_at: Date
}

export interface DTOChat {
    id: number,
    name: string | null,
    unread_message_count: number,
    participants: DTOUser[]
}

export interface DTOChatWithMessages extends DTOChat {
    messages: DTOMessage[]
}

export interface DTOAddedParticipant {
    id: number,
    username: string
    chat_id: number
}

export interface DTOSuccessfullRequest {
    message: string
}