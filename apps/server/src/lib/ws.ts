import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: http.Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('error', () => {});
    ws.on('message', () => {});
  });

  console.log('WebSocket server ready on /ws');
}

export function broadcast(type: string) {
  if (!wss) return;
  const msg = JSON.stringify({ type });
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(msg); } catch {}
    }
  });
}
