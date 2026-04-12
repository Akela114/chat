document.addEventListener('DOMContentLoaded', () => {
    const api = new API(CONFIG.API_BASE_URL);
    const auth = new Auth(api);
    const ws = new ChatWebSocket(CONFIG.WS_URL);
    const chatManager = new ChatManager(api, ws, auth);

    window.addEventListener('auth:success', () => {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        if (token) {
            ws.connect(token);
        }
    });

    window.addEventListener('auth:logout', () => {
        ws.disconnect();
    });

    window.addEventListener('auth:success', (event) => {
        const userSpan = document.getElementById('currentUser');
        if (userSpan && event.detail.user) {
            userSpan.textContent = event.detail.user.username;
        }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => auth.logout());
    }
});