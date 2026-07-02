import { createServer } from "node:http";
import { Server } from "socket.io";
import type { SocketClientEvents, SocketServerEvents } from "@chat/shared";
import { verifyToken } from "./auth.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { assertMember } from "./data.js";

const httpServer = createServer();
const io = new Server<SocketClientEvents, SocketServerEvents>(httpServer, {
  cors: { origin: config.CLIENT_ORIGIN },
});

io.use((socket, next) => {
  try {
    socket.data.userId = verifyToken(
      String(socket.handshake.auth.token ?? ""),
    ).userId;
    next();
  } catch {
    next(new Error("Brak autoryzacji"));
  }
});
const connections = new Map<string, number>();
io.on("connection", (socket) => {
  const userId = String(socket.data.userId);
  for (const onlineUserId of connections.keys())
    socket.emit("presence:update", { userId: onlineUserId, online: true });
  connections.set(userId, (connections.get(userId) ?? 0) + 1);
  socket.join(`user:${userId}`);
  socket.broadcast.emit("presence:update", { userId, online: true });
  socket.on("conversation:join", (conversationId) => {
    if (assertMember(conversationId, userId))
      socket.join(`conversation:${conversationId}`);
  });
  socket.on("conversation:leave", (conversationId) =>
    socket.leave(`conversation:${conversationId}`),
  );
  socket.on("typing:set", ({ conversationId, isTyping }) => {
    if (assertMember(conversationId, userId))
      socket
        .to(`conversation:${conversationId}`)
        .emit("typing:update", { conversationId, userId, isTyping });
  });
  socket.on("disconnect", () => {
    const remaining = (connections.get(userId) ?? 1) - 1;
    if (remaining > 0) connections.set(userId, remaining);
    else {
      connections.delete(userId);
      socket.broadcast.emit("presence:update", { userId, online: false });
    }
  });
});

httpServer.on("request", createApp(io));
httpServer.listen(config.PORT, () =>
  console.log(`API działa na http://localhost:${config.PORT}`),
);
