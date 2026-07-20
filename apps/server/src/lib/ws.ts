import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

let wss: WebSocketServer | null = null;

export function setupWebSocket(server: http.Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('error', () => {});
    ws.on('message', () => {});
    ws.on('pong', () => { (ws as any)._alive = true; });
    (ws as any)._alive = true;
  });

  // Ping all clients every 25s to keep connections alive through proxies/load balancers.
  // Clients that miss two consecutive pings are terminated and will reconnect.
  setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((client: WebSocket) => {
      if ((client as any)._alive === false) { client.terminate(); return; }
      (client as any)._alive = false;
      try { client.ping(); } catch {}
    });
  }, 25000);

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
