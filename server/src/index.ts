// ============================================================
// index.ts — Fastify bootstrap + Socket.IO initialization
// ============================================================

import Fastify from 'fastify';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { VIDEO_LIST } from './types';

import { registerSocketHandlers } from './socketHandlers';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const getNormalizedCorsOrigin = () => {
  const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
  if (origin !== '*' && !origin.startsWith('http://') && !origin.startsWith('https://')) {
    return `https://${origin}`;
  }
  return origin;
};
const CORS_ORIGIN = getNormalizedCorsOrigin();

const fastify = Fastify({ logger: true });

// Attach Socket.IO to the underlying raw http.Server
const httpServer = createServer(fastify.server);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// REST endpoint: list available videos
fastify.get('/api/videos', async () => {
  return { videos: VIDEO_LIST };
});

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

// Wire all Socket.IO events
io.on('connection', (socket) => {
  registerSocketHandlers(io, socket);
});

// Start — listen on the raw http server (not fastify.listen) so Socket.IO shares the port
const start = async () => {
  try {
    await fastify.ready();
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 FrameSync Server running on http://localhost:${PORT}`);
      console.log(`   WebSocket endpoint: ws://localhost:${PORT}`);
      console.log(`   CORS origin: ${CORS_ORIGIN}\n`);
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
