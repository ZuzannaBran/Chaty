import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { SocketClientEvents, SocketServerEvents } from '@chat/shared';
import { verifyToken } from './auth.js';
import { createApp } from './app.js';
import { config } from './config.js';

const httpServer = createServer();
const io = new Server<SocketClientEvents, SocketServerEvents>(httpServer, { cors: { origin: config.CLIENT_ORIGIN } });

io.use((socket, next) => {
  try {
    socket.data.userId = verifyToken(String(socket.handshake.auth.token ?? '')).userId;
    next();
  } catch { next(new Error('Brak autoryzacji')); }
});
io.on('connection', (socket) => {
  const userId = String(socket.data.userId);
  socket.join(`user:${userId}`);
  socket.broadcast.emit('presence:update', { userId, online: true });
  socket.on('conversation:join', (conversationId) => socket.join(`conversation:${conversationId}`));
  socket.on('typing:set', ({ conversationId, isTyping }) => {
    socket.to(`conversation:${conversationId}`).emit('typing:update', { conversationId, userId, isTyping });
  });
  socket.on('disconnect', () => socket.broadcast.emit('presence:update', { userId, online: false }));
});

httpServer.on('request', createApp(io));
httpServer.listen(config.PORT, () => console.log(`API działa na http://localhost:${config.PORT}`));
