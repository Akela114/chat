class ChatManager {
    constructor(api, ws, auth) {
        this.api = api;
        this.ws = ws;
        this.auth = auth;
        this.chats = new Map();
        this.currentChatId = null;
        this.possibleUsers = new Map();
        this.unreadCounts = new Map();
        
        // DOM элементы
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
        this.ws.on('chatParticipantAdded', (payload) => this.onParticipantAdded(payload));
        
        window.addEventListener('auth:success', () => this.loadChats());
        window.addEventListener('auth:logout', () => this.reset());
    }
    
    async loadChats() {
        try {
            const chats = await this.api.getChats();
            this.chats.clear();
            chats.forEach(chat => {
                this.chats.set(chat.id, chat);
                this.unreadCounts.set(chat.id, chat.unread_message_count || 0);
            });
            this.renderChatsList();
            this.loadPossibleUsers();
        } catch (error) {
            console.error('Failed to load chats:', error);
        }
    }
    
    async loadPossibleUsers(chatId = null) {
        try {
            const users = await this.api.getPossibleParticipants(chatId);
            this.possibleUsers.clear();
            users.forEach(user => {
                if (user.id !== this.auth.getCurrentUser()?.id) {
                    this.possibleUsers.set(user.id, user);
                }
            });
        } catch (error) {
            console.error('Failed to load possible users:', error);
        }
    }
    
    renderChatsList() {
        if (!this.chatsList) return;
        
        this.chatsList.innerHTML = '';
        const currentUser = this.auth.getCurrentUser();
        
        const sortedChats = Array.from(this.chats.values()).sort((a, b) => {
            const aUnread = this.unreadCounts.get(a.id) || 0;
            const bUnread = this.unreadCounts.get(b.id) || 0;
            if (aUnread > 0 && bUnread === 0) return -1;
            if (aUnread === 0 && bUnread > 0) return 1;
            return 0;
        });
        
        for (const chat of sortedChats) {
            const otherParticipants = chat.participants.filter(p => p.id !== currentUser?.id);
            const chatName = chat.name || otherParticipants.map(p => p.username).join(', ');
            const unreadCount = this.unreadCounts.get(chat.id) || 0;
            const isGroup = chat.participants.length > 2;
            
            const chatElement = document.createElement('div');
            chatElement.className = `chat-item ${this.currentChatId === chat.id ? 'active' : ''}`;
            chatElement.innerHTML = `
                <div class="chat-item-name">
                    ${chatName}
                    ${isGroup ? ' 👥' : ''}
                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                </div>
                <div class="chat-item-participants">
                    ${chat.participants.map(p => p.username).join(', ')}
                </div>
            `;
            chatElement.addEventListener('click', () => this.openChat(chat.id));
            this.chatsList.appendChild(chatElement);
        }
        
        if (this.chats.size === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'chat-item';
            emptyMessage.innerHTML = '<div class="chat-item-name">Нет чатов</div><div class="chat-item-participants">Создайте новый чат</div>';
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
            this.unreadCounts.set(chatId, 0);
            
            this.renderChatsList();
            this.renderChat(chat);
            
            this.messageInputArea.style.display = 'flex';
            
            if (chat.messages && chat.messages.length > 0) {
                const lastMessage = chat.messages[chat.messages.length - 1];
                await this.markMessagesAsRead(chatId, lastMessage.id);
            }

            await this.loadPossibleUsers(chatId);
            this.renderAddParticipantButton();
        } catch (error) {
            console.error('Failed to open chat:', error);
        }
    }
    
    renderChat(chat) {
        const currentUser = this.auth.getCurrentUser();
        const otherParticipants = chat.participants.filter(p => p.id !== currentUser?.id);
        const chatName = chat.name || otherParticipants.map(p => p.username).join(', ');
        const isGroup = chat.participants.length > 2;
        
        this.chatInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3>${chatName} ${isGroup ? '(Группа)' : ''}</h3>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        Участники: ${chat.participants.map(p => p.username).join(', ')}
                    </div>
                </div>
                ${isGroup ? `
                    <button id="addParticipantBtn" class="add-participant-btn" style="width: auto; padding: 8px 15px; background: #48bb78;">
                        + Добавить участника
                    </button>
                ` : ''}
            </div>
        `;
        
        this.messagesArea.innerHTML = '';
        
        if (chat.messages && chat.messages.length > 0) {
            chat.messages.forEach(message => {
                this.renderMessage(message);
            });
            this.scrollToBottom();
        } else {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'welcome-message';
            emptyMessage.innerHTML = '<p>Нет сообщений. Напишите что-нибудь!</p>';
            this.messagesArea.appendChild(emptyMessage);
        }
        
        if (isGroup) {
            const addBtn = document.getElementById('addParticipantBtn');
            if (addBtn) {
                addBtn.addEventListener('click', () => this.showAddParticipantDialog());
            }
        }
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
        timeSpan.textContent = date.toLocaleString();
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
            
            await this.markMessagesAsRead(this.currentChatId, message.id);
        } catch (error) {
            console.error('Failed to send message:', error);
            this.showError('Не удалось отправить сообщение');
        }
    }
    
    async markMessagesAsRead(chatId, messageId) {
        try {
            await this.api.markMessagesAsRead(chatId, messageId);
        } catch (error) {
            console.error('Failed to mark messages as read:', error);
        }
    }
    
    onMessageReceived(message) {
        if (this.currentChatId === message.chat_id) {
            this.renderMessage(message);
            this.scrollToBottom();
            this.markMessagesAsRead(this.currentChatId, message.id);
        } else {
            const currentCount = this.unreadCounts.get(message.chat_id) || 0;
            this.unreadCounts.set(message.chat_id, currentCount + 1);
            this.renderChatsList();
        }
        
        this.loadChats();
    }
    
    onChatCreated(chat) {
        this.chats.set(chat.id, chat);
        this.renderChatsList();
    }
    
    onParticipantAdded(payload) {
        console.log('Participant added:', payload);
        if (this.currentChatId === payload.chat_id) {
            this.openChat(this.currentChatId);
        }
        this.loadChats();
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
    
    showAddParticipantDialog() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            min-width: 300px;
        `;
        
        const availableUsers = Array.from(this.possibleUsers.values());
        const currentChat = this.chats.get(this.currentChatId);
        const availableInChat = availableUsers.filter(user => 
            !currentChat?.participants.some(p => p.id === user.id)
        );
        
        modalContent.innerHTML = `
            <h3 style="margin-bottom: 20px;">Добавить участника</h3>
            <select id="userToAdd" style="width: 100%; padding: 10px; margin-bottom: 15px;">
                <option value="">Выберите пользователя</option>
                ${availableInChat.map(user => `<option value="${user.username}">${user.username}</option>`).join('')}
            </select>
            <div style="display: flex; gap: 10px;">
                <button id="confirmAddBtn" style="flex: 1;">Добавить</button>
                <button id="cancelAddBtn" style="flex: 1; background: #999;">Отмена</button>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        const confirmBtn = modalContent.querySelector('#confirmAddBtn');
        const cancelBtn = modalContent.querySelector('#cancelAddBtn');
        const select = modalContent.querySelector('#userToAdd');
        
        confirmBtn.addEventListener('click', async () => {
            const username = select.value;
            if (username) {
                await this.addParticipantToChat(username);
                modal.remove();
            }
        });
        
        cancelBtn.addEventListener('click', () => modal.remove());
    }
    
    async addParticipantToChat(username) {
        if (!this.currentChatId) return;
        
        try {
            await this.api.addChatParticipant(this.currentChatId, username);
            this.showError(`Пользователь ${username} добавлен в чат`);
            await this.openChat(this.currentChatId);
            await this.loadPossibleUsers(this.currentChatId);
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
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    reset() {
        this.chats.clear();
        this.currentChatId = null;
        this.unreadCounts.clear();
        this.renderChatsList();
        this.messagesArea.innerHTML = '<div class="welcome-message"><p>Выберите чат, чтобы начать общение</p></div>';
        this.chatInfo.innerHTML = '<h3>Выберите чат</h3>';
        this.messageInputArea.style.display = 'none';
    }
}