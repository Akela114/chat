import type { Client } from "pg";
import type { DBUser } from "../types/database";

export class UserRepo {
    #client: Client

    constructor(client: Client) {
        this.#client = client
    }

    async getUserByUsername(username: string): Promise<DBUser | null> {
        const result = await this.#client.query<DBUser>(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        if (!result.rows[0]) {
            return null
        }
        return result.rows[0];
    }

    async createUser(username: string, passwordHash: string): Promise<DBUser> {
        const result = await this.#client.query<DBUser>(
            'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING *',
            [username, passwordHash]
        );
        return result.rows[0];
    }
}