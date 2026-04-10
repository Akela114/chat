import type { DTOAuth, DTOUser, RequestLogin, RequestRegister } from "@packages/shared/types";
import type { UserRepo } from "../repos/user.ts";
import { ValidationError } from "../errors/validationError.ts";
import { hashPassword } from "../utils/password/hashPassword.ts";
import { NotFoundError } from "../errors/notFoundError.ts";
import { verifyPassword } from "../utils/password/verifyPassword.ts";
import { generateJWT } from "../utils/jwt/generateJWT.ts";
import { parseJWT } from "../utils/jwt/parseJWT.ts";
import { UnauthorizedError } from "../errors/unauthorizedError.ts";

export class AuthService {
    #userRepo: UserRepo

    constructor(userRepo: UserRepo) {
        this.#userRepo = userRepo;
    }

    async registerUser(payload: unknown): Promise<DTOUser> {
        this.#validateRegisterUserPayload(payload);
        const passwordHash = await hashPassword(payload.password);
        const user = await this.#userRepo.createUser(payload.username, passwordHash);
        return {
            id: user.id,
            username: user.username
        }
    }

    async loginUser(payload: unknown): Promise<DTOAuth> {
        this.#validateLoginUserPayload(payload);
        const user = await this.#userRepo.getUserByUsername(payload.username);
        if (!user) {
            throw new NotFoundError('user not found');
        }
        const isPasswordValid = await verifyPassword(payload.password, user.password_hash);
        if (!isPasswordValid) {
            throw new ValidationError('invalid user/password combination');
        }
        const userDto = {
            id: user.id,
            username: user.username
        }
        const token = generateJWT(userDto, 'secret');
        return {
            token,
            user: userDto
        }
    }

    async authorizeUserByToken(token: string | null): Promise<DTOUser> {
        try {
            if (!token) {
                throw new Error;
            }
            const { payload } = parseJWT(token, 'secret');
            const user = await this.#userRepo.getUserByUsername(payload.username);
            if (!user) {
                throw new Error;
            }
            return user;
        } catch {
            throw new UnauthorizedError('invalid token');
        }
    }

    #validateRegisterUserPayload(payload: unknown): asserts payload is RequestRegister {
        if (typeof payload !== 'object' || payload === null) {
            throw new ValidationError('payload must be an object');
        }
        if (!('username' in payload) || typeof payload.username !== 'string') {
            throw new ValidationError('username must be a string');
        }
        if (payload.username.length < 3) {
            throw new ValidationError('username must be at least 3 characters long');
        }
        if (!('password' in payload) || typeof payload.password !== 'string') {
            throw new ValidationError('password must be a string');
        }
        if (payload.password.length < 4) {
            throw new ValidationError('password must be at least 4 characters long');
        }
    }

    #validateLoginUserPayload(payload: unknown): asserts payload is RequestLogin {
        if (typeof payload !== 'object' || payload === null) {
            throw new ValidationError('payload must be an object');
        }
        if (!('username' in payload) || typeof payload.username !== 'string') {
            throw new ValidationError('username must be a string');
        }
        if (!('password' in payload) || typeof payload.password !== 'string') {
            throw new ValidationError('password must be a string');
        }
    }
}