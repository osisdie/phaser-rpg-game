import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Hub } from './hub.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '9473', 10);

const app = express();
const server = createServer(app);

// Serve dashboard static files
app.use(express.static(join(__dirname, '..', 'public')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', ...hub.getStats() });
});

// WebSocket server — handle upgrade on the same HTTP server
const wss = new WebSocketServer({ server });
const hub = new Hub();

wss.on('connection', (ws) => {
  hub.handleConnection(ws);
});

hub.start();

server.listen(PORT, () => {
  console.log(`[Monitor] Server running on http://localhost:${PORT}`);
  console.log(`[Monitor] Dashboard: http://localhost:${PORT}`);
  console.log(`[Monitor] WebSocket: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[Monitor] Shutting down...');
  hub.stop();
  wss.close();
  server.close();
  process.exit(0);
});
