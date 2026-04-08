interface RequestRegister {
    username: string,
    password: string
}

interface RequestLogin {
    username: string,
    password: string
}

interface RequestCreateChat {
    username: string
}

interface RequestAddMessage {
    text: string,
}