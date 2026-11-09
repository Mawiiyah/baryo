import { WebSocketServer, WebSocket } from 'ws';
import type { BridgeMessage, GiftIconsMessage } from './events.js';

export function createServer(port: number) {
  const wss = new WebSocketServer({ port });
  let lastIcons: GiftIconsMessage | undefined; // ipapadala rin sa game na kumonekta mamaya
  wss.on('connection', (socket, req) => {
    console.log(`[ws] game connected (${req.socket.remoteAddress}), clients=${wss.clients.size}`);
    if (lastIcons) socket.send(JSON.stringify(lastIcons));
    socket.on('close', () => console.log(`[ws] game disconnected, clients=${wss.clients.size}`));
  });
  console.log(`[ws] listening on ws://localhost:${port}`);

  return {
    broadcast(event: BridgeMessage) {
      if (event.type === 'giftIcons') lastIcons = event;
      const data = JSON.stringify(event);
      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(data);
      }
    },
    close: () => wss.close(),
  };
}
