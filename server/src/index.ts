// ============================================================
// index.ts — Fastify bootstrap + Socket.IO initialization
// ============================================================

import Fastify from 'fastify';
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

// Add CORS headers for Fastify HTTP routes
fastify.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    reply.status(200).send();
  }
});

// Attach Socket.IO directly to Fastify's underlying HTTP server with permissive CORS
const io = new Server(fastify.server, {
  cors: {
    origin: true, // Allow all origins dynamically
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Root endpoint for browser & status check
fastify.get('/', async () => {
  return { status: 'ok', service: 'FrameSync Server' };
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

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`\n🚀 FrameSync Server running on http://0.0.0.0:${PORT}`);
    console.log(`   WebSocket endpoint: ws://0.0.0.0:${PORT}`);
    console.log(`   CORS origin: ${CORS_ORIGIN}\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
