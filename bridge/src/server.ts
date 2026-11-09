import { WebSocketServer, WebSocket } from 'ws';
import type { GameEvent } from './events.js';

export function createServer(port: number) {
  const wss = new WebSocketServer({ port });
  wss.on('connection', (socket, req) => {
    console.log(`[ws] game connected (${req.socket.remoteAddress}), clients=${wss.clients.size}`);
    socket.on('close', () => console.log(`[ws] game disconnected, clients=${wss.clients.size}`));
  });
  console.log(`[ws] listening on ws://localhost:${port}`);

  return {
    broadcast(event: GameEvent) {
      const data = JSON.stringify(event);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(data);
      }
    },
    close: () => wss.close(),
  };
}
