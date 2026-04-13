import type { DBUser } from "../types/database.ts";

export class UserRepo {
     #client: {
        query: <T>(query: string, values?: any[]) => Promise<{ rows: T[]}>
    }

    constructor(client: any) {
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