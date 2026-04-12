class ChatManager {
    constructor(api, ws, auth) {
        this.api = api;
        this.ws = ws;
        this.auth = auth;
        this.chats = new Map();
        this.currentChatId = null;

        this.chatsList = document.getElementById('chatsList');
        this.messagesArea = document.getElementById('messagesArea');
        this.chatInfo = document.getElementById('chatInfo');
        this.messageInputArea = document.getElementById('messageInputArea');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.createChatBtn = document.getElementById('createChatBtn');
        this.newChatUsername = document.getElementById('newChatUsername');
        this.currentUserSpan = document.getElementById('currentUser');
        
        this.init();
    }
    
    init() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.createChatBtn.addEventListener('click', () => this.createNewChat());

        this.ws.on('chatCreated', (payload) => this.onChatCreated(payload));
        this.ws.on('chatMessageAdded', (payload) => this.onMessageReceived(payload));

        window.addEventListener('auth:success', () => this.loadChats());
        window.addEventListener('auth:logout', () => this.reset());
    }
    
    async loadChats() {
        try {
            const chats = await this.api.getChats();
            this.chats.clear();
            chats.forEach(chat => this.chats.set(chat.id, chat));
            this.renderChatsList();
        } catch (error) {
            console.error('Failed to load chats:', error);
        }
    }
    
    renderChatsList() {
        if (!this.chatsList) return;
        
        this.chatsList.innerHTML = '';
        const currentUser = this.auth.getCurrentUser();
        
        for (const chat of this.chats.values()) {
            const otherParticipant = chat.participants.find(p => p.id !== currentUser?.id);
            const chatName = otherParticipant?.username || 'Чат';
            
            const chatElement = document.createElement('div');
            chatElement.className = `chat-item ${this.currentChatId === chat.id ? 'active' : ''}`;
            chatElement.innerHTML = `
                <div class="chat-item-name">${chatName}</div>
                <div class="chat-item-participants">
                    Участники: ${chat.participants.map(p => p.username).join(', ')}
                </div>
            `;
            chatElement.addEventListener('click', () => this.openChat(chat.id));
            this.chatsList.appendChild(chatElement);
        }
        
        if (this.chats.size === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'chat-item';
            emptyMessage.innerHTML = '<div class="chat-item-name">Нет чатов</div>';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = '#999';
            this.chatsList.appendChild(emptyMessage);
        }
    }
    
    async openChat(chatId) {
        try {
            const chat = await this.api.getChatById(chatId);
            this.chats.set(chatId, chat);
            this.currentChatId = chatId;
            
            this.renderChatsList();
            this.renderChat(chat);
            
            this.messageInputArea.style.display = 'flex';
        } catch (error) {
            console.error('Failed to open chat:', error);
        }
    }
    
    renderChat(chat) {
        const currentUser = this.auth.getCurrentUser();
        const otherParticipant = chat.participants.find(p => p.id !== currentUser?.id);
        const chatName = otherParticipant?.username || 'Чат';
        
        this.chatInfo.innerHTML = `<h3>Чат с ${chatName}</h3>`;

        this.messagesArea.innerHTML = '';
        
        if (chat.messages && chat.messages.length > 0) {
            chat.messages.forEach(message => {
                this.renderMessage(message);
            });
        } else {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'welcome-message';
            emptyMessage.innerHTML = '<p>Нет сообщений. Напишите что-нибудь!</p>';
            this.messagesArea.appendChild(emptyMessage);
        }
        
        this.scrollToBottom();
    }
    
    renderMessage(message) {
        const currentUser = this.auth.getCurrentUser();
        const isOwn = message.sender_id === currentUser?.id;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isOwn ? 'own' : ''}`;
        messageDiv.dataset.messageId = message.id;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        if (!isOwn) {
            const chat = this.chats.get(this.currentChatId);
            const sender = chat?.participants.find(p => p.id === message.sender_id);
            if (sender) {
                const senderSpan = document.createElement('div');
                senderSpan.className = 'message-sender';
                senderSpan.textContent = sender.username;
                messageContent.appendChild(senderSpan);
            }
        }
        
        const textSpan = document.createElement('div');
        textSpan.textContent = message.text;
        messageContent.appendChild(textSpan);
        
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        const date = new Date(message.created_at);
        timeSpan.textContent = date.toLocaleTimeString();
        messageContent.appendChild(timeSpan);
        
        messageDiv.appendChild(messageContent);
        this.messagesArea.appendChild(messageDiv);
    }
    
    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || !this.currentChatId) return;
        
        try {
            const message = await this.api.sendMessage(this.currentChatId, text);
            this.renderMessage(message);
            this.messageInput.value = '';
            this.scrollToBottom();
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showError('Не удалось отправить сообщение');
        }
    }
    
    onMessageReceived(message) {
        if (this.currentChatId === message.chat_id) {
            this.renderMessage(message);
            this.scrollToBottom();
        }

        this.loadChats();
    }
    
    onChatCreated(chat) {
        this.chats.set(chat.id, chat);
        this.renderChatsList();
    }
    
    async createNewChat() {
        const username = this.newChatUsername.value.trim();
        if (!username) {
            this.showError('Введите username пользователя');
            return;
        }
        
        try {
            const chat = await this.api.createChat(username);
            this.chats.set(chat.id, chat);
            this.renderChatsList();
            this.newChatUsername.value = '';
            await this.openChat(chat.id);
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    scrollToBottom() {
        if (this.messagesArea) {
            this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
        }
    }
    
    showError(message) {
        console.error(message);
        alert(message);
    }
    
    reset() {
        this.chats.clear();
        this.currentChatId = null;
        this.renderChatsList();
        this.messagesArea.innerHTML = '<div class="welcome-message"><p>Выберите чат, чтобы начать общение</p></div>';
        this.chatInfo.innerHTML = '<h3>Выберите чат</h3>';
        this.messageInputArea.style.display = 'none';
    }
}