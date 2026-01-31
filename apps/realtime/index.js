import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

// Allow your Next.js app to connect (dev)
app.use(
  cors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.get("/health", (_req, res) => res.json({ ok: true }));

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  // Join a room
  socket.on("join_room", ({ room_id }) => {
    if (!room_id || typeof room_id !== "string") return;
    socket.join(room_id);
    socket.emit("joined_room", { room_id });
  });

  // Leave a room
  socket.on("leave_room", ({ room_id }) => {
    if (!room_id || typeof room_id !== "string") return;
    socket.leave(room_id);
    socket.emit("left_room", { room_id });
  });

  // Relay message to everyone in the room (including sender)
  socket.on("send_message", (msg) => {
    // msg: { room_id, sender_id, body, ts }
    if (!msg || typeof msg !== "object") return;
    const { room_id, sender_id, body, ts } = msg;

    if (
      !room_id ||
      typeof room_id !== "string" ||
      !sender_id ||
      typeof sender_id !== "string" ||
      typeof body !== "string" ||
      typeof ts !== "number"
    ) {
      return;
    }

    io.to(room_id).emit("message", msg);
  });
});

server.listen(PORT, () => {
  console.log(`realtime server listening on http://localhost:${PORT}`);
});
