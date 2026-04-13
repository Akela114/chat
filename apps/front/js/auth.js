class Auth {
    constructor(api) {
        this.api = api;
        this.currentUser = null;
        this.isLoginMode = true;
        
        this.authContainer = document.getElementById('authContainer');
        this.chatContainer = document.getElementById('chatContainer');
        this.formTitle = document.getElementById('formTitle');
        this.submitBtn = document.getElementById('submitBtn');
        this.toggleBtn = document.getElementById('toggleBtn');
        this.errorDiv = document.getElementById('errorMessage');
        this.usernameInput = document.getElementById('username');
        this.passwordInput = document.getElementById('password');
    }
    
    init() {
        this.submitBtn.addEventListener('click', () => this.handleSubmit());
        this.toggleBtn.addEventListener('click', () => this.toggleMode());

        this.checkSavedAuth();
    }
    
    showError(message) {
        this.errorDiv.textContent = message;
        this.errorDiv.style.display = 'block';
        setTimeout(() => {
            this.errorDiv.style.display = 'none';
        }, 3000);
    }
    
    async handleSubmit() {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;
        
        if (!username || !password) {
            this.showError('Заполните все поля');
            return;
        }
        
        if (this.isLoginMode) {
            await this.login(username, password);
        } else {
            await this.register(username, password);
        }
    }
    
    async register(username, password) {
        if (username.length < 3) {
            this.showError('Имя пользователя должно содержать минимум 3 символа');
            return;
        }
        
        if (password.length < 4) {
            this.showError('Пароль должен содержать минимум 4 символа');
            return;
        }
        
        try {
            await this.api.register(username, password);
            this.showError('Регистрация успешна! Теперь войдите.');
            this.toggleMode();
            this.usernameInput.value = username;
            this.passwordInput.value = '';
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    async login(username, password) {
        try {
            const data = await this.api.login(username, password);
            this.saveAuthData(data.token, data.user);
            this.onAuthSuccess(data.user);
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    saveAuthData(token, user) {
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
        this.currentUser = user;
    }
    
    onAuthSuccess(user) {
        this.currentUser = user;
        this.authContainer.style.display = 'none';
        this.chatContainer.style.display = 'flex';

        window.dispatchEvent(new CustomEvent('auth:success', { detail: { user } }));
    }
    
    async checkSavedAuth() {
        const token = localStorage.getItem(CONFIG.TOKEN_KEY);
        const userStr = localStorage.getItem(CONFIG.USER_KEY);
        
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                this.currentUser = user;
                this.onAuthSuccess(user);
            } catch {
                this.showAuthForm();
            }
        } else {
            this.showAuthForm();
        }
    }
    
    showAuthForm() {
        this.authContainer.style.display = 'flex';
        this.chatContainer.style.display = 'none';
    }
    
    logout() {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        this.currentUser = null;
        this.showAuthForm();
        
        window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    
    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        if (this.isLoginMode) {
            this.formTitle.textContent = 'Вход';
            this.submitBtn.textContent = 'Войти';
            this.toggleBtn.textContent = 'Нет аккаунта? Зарегистрироваться';
        } else {
            this.formTitle.textContent = 'Регистрация';
            this.submitBtn.textContent = 'Зарегистрироваться';
            this.toggleBtn.textContent = 'Уже есть аккаунт? Войти';
        }
        this.errorDiv.style.display = 'none';
        this.usernameInput.value = '';
        this.passwordInput.value = '';
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
}