import type { IncomingMessage, ServerResponse } from 'http'
import { Client } from 'pg';
import { UserRepo } from '../repos/user.ts';
import { UserService } from '../services/user.ts';
import { PublicApi } from './publicApi.ts';
import { NotFoundError } from '../errors/notFoundError.ts';
import { ValidationError } from '../errors/validationError.ts';
import { getRequestBody } from '../utils/getRequestBody.ts';

// TODO: вынести в переменные окружения
const dbClient = new Client({
  host: "postgres",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "postgres",
});
await dbClient.connect();

const userRepo = new UserRepo(dbClient);
const userService = new UserService(userRepo);
const publicApi = new PublicApi(userService);

export const apiRootHandler = (async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
            
    try {
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }

        res.setHeader('Content-Type', 'application/json');
        
        if (req.method === 'POST') {
            switch (url.pathname) {
                case '/api/auth/register': {
                    const body = await publicApi.registerUser(
                        await getRequestBody(req)
                    );
                    res.statusCode = 201;
                    res.end(JSON.stringify(body));
                    return;
                }
                case '/api/auth/login': {
                    const body = await publicApi.loginUser(
                        await getRequestBody(req)
                    );
                    res.statusCode = 200;
                    res.end(JSON.stringify(body));
                    return;
                }
            }
        }
        throw new NotFoundError('route not found');
    } catch (error) {
        if (error instanceof NotFoundError) {
            res.statusCode = 404;
            res.end(JSON.stringify({ message: error.message }));
            console.log("NotFoundError", error.message);
            return;
        }
        if (error instanceof ValidationError) {
            res.statusCode = 400;
            res.end(JSON.stringify({ message: error.message }));
            console.log("ValidationError", error.message);
            return;
        }
        res.statusCode = 500;
        console.error("InternalServerError", error);
        res.end(JSON.stringify({ message: 'internal server error' }));
        return;
    }
})