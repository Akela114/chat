import http from 'http';
import { createApiRootHandler } from './api/root.ts';
import { WebSocketServer } from 'ws';
import { Client } from 'pg';
import { UserRepo } from './repos/user.ts';
import { ChatRepo } from './repos/chat.ts';
import { AuthService } from './services/auth.ts';
import { ChatService } from './services/chat.ts';
import { WSS } from './api/wss.ts';

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
const chatRepo = new ChatRepo(dbClient);
const authService = new AuthService(userRepo);
const chatService = new ChatService(chatRepo, userRepo);

const wss = new WSS(new WebSocketServer({ port: 5005 }), authService);
chatService.addChatUpdatesSubscriber(wss.notifyWsUsers.bind(wss));

const server = http.createServer(createApiRootHandler({ authService, chatService }));

server.listen(5000, () => {
  console.log('Server running at http://localhost:5000/');
});
