import type { WebSocketServer, WebSocket } from "ws";
import type { AuthService } from "../services/auth";
import { randomUUID } from "crypto";

export class WSS {
    #wsUsersMap = new Map<number, Map<string, WebSocket>>();

    constructor(wss: WebSocketServer, authService: AuthService) {
        wss.on('connection', async (ws, req) => {
            try {
                const url = new URL(req.url ?? "", `http://${req.headers.host}`);
                const token = url.searchParams.get('token');
                const user = await authService.authorizeUserByToken(token);

                if (user) {
                    const wsMap = this.#wsUsersMap.get(user.id) ?? new Map<string, WebSocket>();
                    const uuid = randomUUID();
                    wsMap.set(uuid, ws);
                    this.#wsUsersMap.set(user.id, wsMap);
                    ws.on('close', () => {
                        const wsMap = this.#wsUsersMap.get(user.id);
                        if (wsMap) {
                            wsMap.delete(uuid);
                            if (wsMap.size === 0) {
                                this.#wsUsersMap.delete(user.id);
                            }
                        }
                    })
                    ws.send(JSON.stringify({ event: "authorized", payload: null }));
                }
            } catch (error) {
                console.log("WS authorization error", error);
                ws.send(JSON.stringify({ event: "unauthorized", payload: null }));
                ws.close();
            }
        })
    }

    notifyWsUsers = (
        usersIds: number[], event: string, payload: unknown
    ) => {
        usersIds.forEach((userId) => {
            const wsMap = this.#wsUsersMap.get(userId);
            wsMap?.forEach((ws) => {
                try {
                    ws.send(JSON.stringify({ event, payload }));
                } catch (error) {
                    console.log("WS error", error);
                    ws.close();
                }
            })
        })
    }
}