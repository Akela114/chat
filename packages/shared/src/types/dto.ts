export interface DTOUser {
    id: number,
    username: string
}


export interface DTOAuth {
    token: string
    user: DTOUser
}

export interface DTOChat {
    id: number,
    name: string | null,
    participants: DTOUser[]
}

export interface DTOMessage {
    id: number,
    text: string,
    sender_id: number,
    created_at: Date,
    updated_at: Date
}
