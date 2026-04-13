document.addEventListener('DOMContentLoaded', () => {

    const api = new API(CONFIG.API_BASE_URL);
    const auth = new Auth(api);
    const ws = new ChatWebSocket(CONFIG.WS_URL);
    const chatManager = new ChatManager(api, ws, auth);
    
    let isWebSocketConnected = false;
    
    window.addEventListener('auth:success', async (event) => {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        if (token && !isWebSocketConnected) {
            ws.connect(token);
            isWebSocketConnected = true;
        }

        await chatManager.loadChats();
        
        const lastOpenedChat = localStorage.getItem('last_opened_chat');
        if (lastOpenedChat && !chatManager.currentChatId) {
            await chatManager.openChat(parseInt(lastOpenedChat));
        }
    });
    
    window.addEventListener('auth:logout', () => {
        ws.disconnect();
        isWebSocketConnected = false;
        localStorage.removeItem('last_opened_chat');
    });
    
    window.addEventListener('chat:opened', (event) => {
        if (event.detail && event.detail.chatId) {
            localStorage.setItem('last_opened_chat', event.detail.chatId);
        }
    });
    
    window.addEventListener('auth:success', (event) => {
        const userSpan = document.getElementById('currentUser');
        if (userSpan && event.detail.user) {
            userSpan.textContent = event.detail.user.username;
        }
    });


    chatManager.init();
    auth.init();
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => auth.logout());
    }
});