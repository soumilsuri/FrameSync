'use client';
// ============================================================
// lib/socket.ts — Typed Socket.IO client singleton
// Shared across Controller and Display pages.
// ============================================================

import { io, Socket } from 'socket.io-client';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      reconnectionDelay: 500,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
