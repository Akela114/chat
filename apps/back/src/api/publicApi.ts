import type { UserService } from "../services/user.ts";

export class PublicApi   {
    #userService: UserService

    constructor(userService: UserService) {
        this.#userService = userService;
    }

    async registerUser(payload: unknown) {
        return this.#userService.registerUser(payload);
    }

    async loginUser(payload: unknown){
        return this.#userService.loginUser(payload);
    }
}