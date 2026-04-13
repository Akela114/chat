export interface RequestRegister {
    username: string,
    password: string
}

export interface RequestLogin {
    username: string,
    password: string
}

export interface RequestCreateChat {
    username: string
}

export interface RequestAddMessage {
    text: string,
}

export interface RequestAddChatParticipant {
    username: string
}

export interface RequestReadMessage {
    messageId: number
}