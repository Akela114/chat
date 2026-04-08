interface DTOAuth {
    token: string
}

interface DTOUser {
    id: number,
    username: string
}

interface DTOChat {
    id: number,
    name: string | null,
    participants: DTOUser[]
}

interface DTOMessage {
    id: number,
    text: string,
    sender_id: number,
    created_at: Date,
    updated_at: Date
}
