interface User {
    id: number,
    username: string
}

interface Chat {
    id: number,
    name: string,
    participants: User[]
}

interface Message {
    id: number,
    text: string,
    senderId: number
}
