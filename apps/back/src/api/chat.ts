import type { AuthService } from "../services/auth.ts";

export class ChatApi   {
    #authService: AuthService

    constructor(authService: AuthService) {
        this.#authService = authService;
    }

    async registerUser(payload: unknown) {
        return this.#authService.registerUser(payload);
    }

    async loginUser(payload: unknown){
        return this.#authService.loginUser(payload);
    }
}