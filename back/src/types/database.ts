interface User {
    id: number,
    username: string,
    password: string
}

interface Chat {
    id: number,
    name: string
}

interface ChatParticipant {
    id: number,
    userId: number,
    chatId: number
}

interface Message {
    id: number,
    text: string,
    senderId: number,
    chatId: number
}
