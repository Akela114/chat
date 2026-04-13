class ChatManager {
    constructor(api, ws, auth) {
        this.api = api;
        this.ws = ws;
        this.auth = auth;
        this.chats = new Map();
        this.currentChatId = null;
        this.possibleUsers = new Map();
        this.allPossibleUsers = new Map();
        this.unreadCounts = new Map();
        this.isLoading = false;
        
        // DOM элементы
        this.chatsList = document.getElementById('chatsList');
        this.messagesArea = document.getElementById('messagesArea');
        this.chatInfo = document.getElementById('chatInfo');
        this.messageInputArea = document.getElementById('messageInputArea');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.createChatBtn = document.getElementById('createChatBtn');
        this.currentUserSpan = document.getElementById('currentUser');
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
        this.ws.on('chatParticipantRemoved', (payload) => this.onParticipantRemoved(payload));
        
        window.addEventListener('auth:success', () => {
            this.loadChats();
            this.loadAllPossibleUsers();
        });
        window.addEventListener('auth:logout', () => this.reset());
    }
    
    async loadChats() {
        if (this.isLoading) return;
        
        this.isLoading = true;
        
        try {
            this.showLoadingIndicator();
            
            const chats = await this.api.getChats();
            this.chats.clear();
            chats.forEach(chat => {
                this.chats.set(chat.id, chat);
                this.unreadCounts.set(chat.id, chat.unread_message_count || 0);
            });
            this.renderChatsList();
            
            this.hideLoadingIndicator();
        } catch (error) {
            console.error('Failed to load chats:', error);
            this.hideLoadingIndicator();
            
            if (error.message === 'Не авторизован') {
                this.auth.logout();
            }
        } finally {
            this.isLoading = false;
        }
    }
    
    showLoadingIndicator() {
        if (this.chatsList) {
            const loadingDiv = document.createElement('div');
            loadingDiv.id = 'chats-loading';
            loadingDiv.className = 'loading-indicator';
            loadingDiv.innerHTML = '<div class="loading-spinner"></div><div>Загрузка чатов...</div>';
            loadingDiv.style.cssText = `
                text-align: center;
                padding: 20px;
                color: #666;
            `;
            
            if (!document.querySelector('#loading-styles')) {
                const styles = document.createElement('style');
                styles.id = 'loading-styles';
                styles.textContent = `
                    .loading-spinner {
                        width: 30px;
                        height: 30px;
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid #667eea;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 10px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(styles);
            }

            if (this.chatsList.children.length === 0) {
                this.chatsList.appendChild(loadingDiv);
            }
        }
    }
    
    hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('chats-loading');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
    
    async loadPossibleUsers(chatId = null) {
        try {
            const users = await this.api.getPossibleParticipants(chatId);
            this.possibleUsers.clear();
            const currentUser = this.auth.getCurrentUser();
            users.forEach(user => {
                if (user.id !== currentUser?.id) {
                    this.possibleUsers.set(user.id, user);
                }
            });
        } catch (error) {
            console.error('Failed to load possible users:', error);
        }
    }

    async loadAllPossibleUsers(chatId = null) {
        try {
            const users = await this.api.getPossibleParticipants();
            this.allPossibleUsers.clear();
            const currentUser = this.auth.getCurrentUser();
            users.forEach(user => {
                if (user.id !== currentUser?.id) {
                    this.allPossibleUsers.set(user.id, user);
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
        
        if (this.chats.size === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'chat-item';
            emptyMessage.innerHTML = `
                <div class="chat-item-name">Нет чатов</div>
                <div class="chat-item-participants">Создайте новый чат, чтобы начать общение</div>
            `;
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = '#999';
            this.chatsList.appendChild(emptyMessage);
            return;
        }
        
        const sortedChats = Array.from(this.chats.values()).sort((a, b) => {
            const aUnread = this.unreadCounts.get(a.id) || 0;
            const bUnread = this.unreadCounts.get(b.id) || 0;
            
            if (aUnread > 0 && bUnread === 0) return -1;
            if (aUnread === 0 && bUnread > 0) return 1;
            
            return b.id - a.id;
        });
        
        for (const chat of sortedChats) {
            const otherParticipants = chat.participants.filter(p => p.id !== currentUser?.id);
            const chatName = chat.name || otherParticipants.map(p => p.username).join(', ') || 'пустой чат';
            const unreadCount = this.unreadCounts.get(chat.id) || 0;
            const isGroup = chat.participants.length > 2;
            
            const chatElement = document.createElement('div');
            chatElement.className = `chat-item ${this.currentChatId === chat.id ? 'active' : ''}`;
            chatElement.innerHTML = `
                <div class="chat-item-name">
                    <span>${this.escapeHtml(chatName)} ${isGroup ? '👥' : ''}</span>
                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                </div>
                <div class="chat-item-participants">
                    ${chat.participants.map(p => this.escapeHtml(p.username)).join(', ')}
                </div>
            `;
            chatElement.addEventListener('click', () => this.openChat(chat.id));
            this.chatsList.appendChild(chatElement);
        }
    }
    
    async openChat(chatId) {
        if (this.currentChatId === chatId) return;
        
        try {
            this.showMessagesLoadingIndicator();
            
            const chat = await this.api.getChatById(chatId);
            this.chats.set(chatId, chat);
            this.currentChatId = chatId;
            this.unreadCounts.set(chatId, 0);
            
            this.renderChatsList();
            this.renderChat(chat);
            
            this.messageInputArea.style.display = 'flex';
            this.messageInput.disabled = false;
            this.sendBtn.disabled = false;
            
            if (chat.messages && chat.messages.length > 0) {
                const lastMessage = chat.messages[chat.messages.length - 1];
                await this.markMessagesAsRead(chatId, lastMessage.id);
            }

            await this.loadPossibleUsers(chatId);

            localStorage.setItem('last_opened_chat', chatId);

            window.dispatchEvent(new CustomEvent('chat:opened', { detail: { chatId } }));
            
            this.hideMessagesLoadingIndicator();
        } catch (error) {
            console.error('Failed to open chat:', error);
            this.hideMessagesLoadingIndicator();
            this.showError('Не удалось загрузить чат');
        }
    }
    
    showMessagesLoadingIndicator() {
        if (this.messagesArea) {
            this.messagesArea.innerHTML = `
                <div class="loading-indicator" style="text-align: center; padding: 40px;">
                    <div class="loading-spinner"></div>
                    <div>Загрузка сообщений...</div>
                </div>
            `;
        }
    }
    
    hideMessagesLoadingIndicator() {
    }
    
    renderChat(chat) {
        const currentUser = this.auth.getCurrentUser();
        const otherParticipants = chat.participants.filter(p => p.id !== currentUser?.id);
        const chatName = chat.name || otherParticipants.map(p => p.username).join(', ') || 'пустой чат';
        const isGroup = chat.participants.length > 2;
        
        this.chatInfo.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h3>${this.escapeHtml(chatName)} ${isGroup ? '(Группа)' : ''}</h3>
                    <div style="font-size: 12px; color: #666; margin-top: 5px;">
                        Участники: ${chat.participants.map(p => this.escapeHtml(p.username)).join(', ')}
                    </div>
                </div>
                <div class="chatButtons">
                    <button id="addParticipantBtn" class="add-participant-btn" style="width: auto; padding: 8px 15px; background: #48bb78;">
                        + Добавить участника
                    </button>
                    <button id="leaveChatBtn" class="leave-chat-btn" style="width: auto; padding: 6px 8px; background: #f56565;" title="Выйти из чата">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6" width="20" height="20" style="transform: translateY(1px);">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                        </svg>
                    </button>
                </div>
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
            emptyMessage.id = 'emptyMessage';
            emptyMessage.innerHTML = '<p>Нет сообщений. Напишите что-нибудь!</p>';
            this.messagesArea.appendChild(emptyMessage);
        }
        
        const addBtn = document.getElementById('addParticipantBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.showAddParticipantDialog());
        }

        const leaveBtn = document.getElementById('leaveChatBtn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => this.leaveCurrentChat());
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
            const senderSpan = document.createElement('div');
            senderSpan.className = 'message-sender';
            senderSpan.textContent = sender ? this.escapeHtml(sender.username) : 'Удаленный участник';
            messageContent.appendChild(senderSpan);
        }
        
        const textSpan = document.createElement('div');
        textSpan.textContent = this.escapeHtml(message.text);
        messageContent.appendChild(textSpan);
        
        const timeSpan = document.createElement('div');
        timeSpan.className = 'message-time';
        const date = new Date(message.created_at);
        timeSpan.textContent = date.toLocaleString('ru-RU');
        messageContent.appendChild(timeSpan);
        
        messageDiv.appendChild(messageContent);
        this.messagesArea.appendChild(messageDiv);

        const emptyMessage = document.getElementById('emptyMessage');
        if (emptyMessage) {
            emptyMessage.remove();
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async sendMessage() {
        const text = this.messageInput.value.trim();
        if (!text || !this.currentChatId) return;
        
        if (this.isLoading) {
            this.showError('Подождите, данные загружаются...');
            return;
        }
        
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

    onParticipantRemoved(payload) {
        console.log('Participant removed:', payload);
        if (this.currentChatId === payload.chat_id) {
            this.openChat(this.currentChatId);
        }
        this.loadChats();
    }
    
    async createNewChat() {
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
        
        const availableInChat = Array.from(this.allPossibleUsers.values());
        
        if (availableInChat.length === 0) {
            modalContent.innerHTML = `
                <h3 style="margin-bottom: 20px;">Выбрать участника</h3>
                <p>Нет доступных пользователей для добавления</p>
                <button id="cancelAddBtn" style="margin-top: 15px;">Закрыть</button>
            `;
        } else {
            modalContent.innerHTML = `
                <h3 style="margin-bottom: 20px;">Добавить участника</h3>
                <select id="userToAdd" style="width: 100%; padding: 10px; margin-bottom: 15px;">
                    <option value="">Выберите пользователя</option>
                    ${availableInChat.map(user => `<option value="${this.escapeHtml(user.username)}">${this.escapeHtml(user.username)}</option>`).join('')}
                </select>
                <div style="display: flex; gap: 10px;">
                    <button id="confirmAddBtn" style="flex: 1;">Добавить</button>
                    <button id="cancelAddBtn" style="flex: 1; background: #999;">Отмена</button>
                </div>
            `;
        }
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        const confirmBtn = modalContent.querySelector('#confirmAddBtn');
        const cancelBtn = modalContent.querySelector('#cancelAddBtn');
        const select = modalContent.querySelector('#userToAdd');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                try {
                    const username = select.value;
                    if (username) {
                        const chat = await this.api.createChat(username);
                        this.chats.set(chat.id, chat);
                        this.renderChatsList();
                        await this.openChat(chat.id);
                        modal.remove();
                    }
                } catch (error) {
                    this.showError(error.message);
                }
            });
        }
        
        cancelBtn.addEventListener('click', () => modal.remove());
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
        
        if (availableInChat.length === 0) {
            modalContent.innerHTML = `
                <h3 style="margin-bottom: 20px;">Добавить участника</h3>
                <p>Нет доступных пользователей для добавления</p>
                <button id="cancelAddBtn" style="margin-top: 15px;">Закрыть</button>
            `;
        } else {
            modalContent.innerHTML = `
                <h3 style="margin-bottom: 20px;">Добавить участника</h3>
                <select id="userToAdd" style="width: 100%; padding: 10px; margin-bottom: 15px;">
                    <option value="">Выберите пользователя</option>
                    ${availableInChat.map(user => `<option value="${this.escapeHtml(user.username)}">${this.escapeHtml(user.username)}</option>`).join('')}
                </select>
                <div style="display: flex; gap: 10px;">
                    <button id="confirmAddBtn" style="flex: 1;">Добавить</button>
                    <button id="cancelAddBtn" style="flex: 1; background: #999;">Отмена</button>
                </div>
            `;
        }
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        const confirmBtn = modalContent.querySelector('#confirmAddBtn');
        const cancelBtn = modalContent.querySelector('#cancelAddBtn');
        const select = modalContent.querySelector('#userToAdd');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
                const username = select.value;
                if (username) {
                    await this.addParticipantToChat(username);
                    modal.remove();
                }
            });
        }
        
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

    async leaveCurrentChat() {
        if (!this.currentChatId) return;
        
        try {
            await this.api.leaveChat(this.currentChatId);
            this.chats.delete(this.currentChatId);
            this.renderChatsList();
            this.currentChatId = null;
            this.messagesArea.innerHTML = '<div class="welcome-message"><p>Выберите чат, чтобы начать общение</p></div>';
            this.chatInfo.innerHTML = '<h3>Выберите чат</h3>';
            this.messageInputArea.style.display = 'none';
            localStorage.removeItem('last_opened_chat');
            this.showError('Вы покинули чат');
        } catch (error) {
            this.showError(error.message);
        }
    } 
    
    scrollToBottom() {
        if (this.messagesArea) {
            setTimeout(() => {
                this.messagesArea.scrollTop = this.messagesArea.scrollHeight;
            }, 100);
        }
    }
    
    showError(message) {
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
        this.isLoading = false;
        this.renderChatsList();
        this.messagesArea.innerHTML = '<div class="welcome-message"><p>Выберите чат, чтобы начать общение</p></div>';
        this.chatInfo.innerHTML = '<h3>Выберите чат</h3>';
        this.messageInputArea.style.display = 'none';
        localStorage.removeItem('last_opened_chat');
    }
}