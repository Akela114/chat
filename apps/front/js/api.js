class API {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }

    getAuthToken() {
        return localStorage.getItem(CONFIG.TOKEN_KEY);
    }

    async request(endpoint, method, data, requiresAuth = false) {
        const headers = {
            'Content-Type': 'application/json',
        };

        if (requiresAuth) {
            const token = this.getAuthToken();
            if (!token) {
                throw new Error('Не авторизован');
            }
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers,
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, config);
        
        if (!response.ok) {
            let errorMessage;
            try {
                const error = await response.json();
                errorMessage = error.message;
            } catch {
                errorMessage = `Ошибка ${response.status}`;
            }
            
            if (response.status === 401) {
                localStorage.removeItem(CONFIG.TOKEN_KEY);
                localStorage.removeItem(CONFIG.USER_KEY);
                window.dispatchEvent(new CustomEvent('auth:logout'));
            }
            
            throw new Error(errorMessage);
        }

        if (response.status === 204) {
            return null;
        }

        return await response.json();
    }

    async register(username, password) {
        return this.request('/auth/register', 'POST', { username, password });
    }

    async login(username, password) {
        return this.request('/auth/login', 'POST', { username, password });
    }

    async getChats() {
        return this.request('/chats', 'GET', null, true);
    }

    async getChatById(chatId) {
        return this.request(`/chats/${chatId}`, 'GET', null, true);
    }

    async createChat(username) {
        return this.request('/chats', 'POST', { username }, true);
    }

    async sendMessage(chatId, text) {
        return this.request(`/chats/${chatId}/messages`, 'POST', { text }, true);
    }

    async addChatParticipant(chatId, username) {
        return this.request(`/chats/${chatId}/participants`, 'POST', { username }, true);
    }

    async getPossibleParticipants(chatId = null) {
        let endpoint = '/chats/participationCandidates';
        if (chatId) {
            endpoint += `?chatId=${chatId}`;
        }
        return this.request(endpoint, 'GET', null, true);
    }

    async markMessagesAsRead(chatId, messageId) {
        return this.request(`/chats/${chatId}/readMessages`, 'POST', { messageId }, true);
    }
}