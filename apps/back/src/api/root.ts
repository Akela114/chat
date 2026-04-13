import type { IncomingMessage, ServerResponse } from 'http'
import { AuthService } from '../services/auth.ts';
import { AuthApi } from './auth.ts';
import { NotFoundError } from '../errors/notFoundError.ts';
import { ValidationError } from '../errors/validationError.ts';
import { getRequestBody } from '../utils/getRequestBody.ts';
import { ForbiddenError } from '../errors/forbiddenError.ts';
import { UnauthorizedError } from '../errors/unauthorizedError.ts';
import { ChatService } from '../services/chat.ts';

export const createApiRootHandler = (({ authService, chatService } : {
    authService: AuthService,
    chatService: ChatService
}) => {
    const authApi = new AuthApi(authService);

    return async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        
        const authHeader = req.headers.authorization;
        const authToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

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
                    // Public routes
                    case '/api/auth/register': {
                        const body = await authApi.registerUser(
                            await getRequestBody(req)
                        );
                        res.statusCode = 201;
                        res.end(JSON.stringify(body));
                        return;
                    }
                    case '/api/auth/login': {
                        const body = await authApi.loginUser(
                            await getRequestBody(req)
                        );
                        res.statusCode = 200;
                        res.end(JSON.stringify(body));
                        return;
                    }
                    // Private routes
                    case '/api/chats': {
                        const authorizedUser = await authService.authorizeUserByToken(authToken);
                        const body = await chatService.createChatWithUser(
                            await getRequestBody(req), authorizedUser
                        );
                        res.statusCode = 201;
                        res.end(JSON.stringify(body));
                        return;
                    }
                }
                let matches = url.pathname.match(/^\/api\/chats\/(\d+)\/messages$/);
                if (matches) {
                    const chatId = matches[1];
                    const authorizedUser = await authService.authorizeUserByToken(authToken);
                    const body = await chatService.addChatMessage(
                        { id: chatId },
                        await getRequestBody(req),
                        authorizedUser
                    );
                    res.statusCode = 201;
                    res.end(JSON.stringify(body));
                    return;
                }
                matches = url.pathname.match(/^\/api\/chats\/(\d+)\/participants$/);
                if (matches) {
                    const chatId = matches[1];
                    const authorizedUser = await authService.authorizeUserByToken(authToken);
                    const body = await chatService.addChatParticipant(
                        { id: chatId },
                        await getRequestBody(req),
                        authorizedUser
                    );
                    res.statusCode = 201;
                    res.end(JSON.stringify(body));
                    return;
                }
                matches = url.pathname.match(/^\/api\/chats\/(\d+)\/readMessages$/);
                if (matches) {
                    const chatId = matches[1];
                    const authorizedUser = await authService.authorizeUserByToken(authToken);
                    const body = await chatService.readChatMessage(
                        { id: chatId },
                        await getRequestBody(req),
                        authorizedUser
                    );
                    res.statusCode = 201;
                    res.end(JSON.stringify(body));
                    return;
                }
            }

            if (req.method === 'GET') {
                switch (url.pathname) {
                    // Private routes
                    case '/api/chats': {
                        const authorizedUser = await authService.authorizeUserByToken(authToken);
                        const body = await chatService.getChatsByParticipant(authorizedUser);
                        res.statusCode = 200;
                        res.end(JSON.stringify(body));
                        return;
                    }
                    case '/api/chats/participationCandidates': {
                        const authorizedUser = await authService.authorizeUserByToken(authToken);
                        const body = await chatService.getPossibleParticipants(Object.fromEntries(url.searchParams.entries()), authorizedUser);
                        res.statusCode = 200;
                        res.end(JSON.stringify(body));
                        return;
                    }
                }
                let matches = url.pathname.match(/^\/api\/chats\/(\d+)$/);
                if (matches) {
                    const chatId = matches[1];
                    const authorizedUser = await authService.authorizeUserByToken(authToken);
                    const body = await chatService.getChatById({ id: chatId }, authorizedUser);
                    res.statusCode = 200;
                    res.end(JSON.stringify(body));
                    return;
                }
            }

            if (req.method === 'DELETE') {
                let matches = url.pathname.match(/^\/api\/chats\/(\d+)\/participants\/self$/);
                if (matches) {
                    const chatId = matches[1];
                    const authorizedUser = await authService.authorizeUserByToken(authToken);
                    const body = await chatService.removeSelfFromChatParticipants(
                        { id: chatId },
                        authorizedUser
                    );
                    res.end(JSON.stringify(body));
                    return;
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
            if (error instanceof ForbiddenError) {
                res.statusCode = 403;
                res.end(JSON.stringify({ message: error.message }));
                console.error("ForbiddenError", error);
                return;
            }
            if (error instanceof UnauthorizedError) {
                res.statusCode = 401;
                res.end(JSON.stringify({ message: error.message }));
                console.error("UnauthorizedError", error);
                return;
            }
            res.statusCode = 500;
            console.error("InternalServerError", error);
            res.end(JSON.stringify({ message: 'internal server error' }));
            return;
        }
    }
})