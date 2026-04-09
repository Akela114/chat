import type { Client } from "pg";
import type { DBUser } from "../types/database";

export class UserRepo {
    #client: Client

    constructor(client: Client) {
        this.#client = client
    }

    async getUserByUsername(username: string) {
        const result = await this.#client.query<DBUser>(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        return result.rows[0];
    }

    async createUser(username: string, passwordSalt: string) {
        const result = await this.#client.query<DBUser>(
            'INSERT INTO users (username, password_salt) VALUES ($1, $2) RETURNING *',
            [username, passwordSalt]
        );
        return result.rows[0];
    }
}