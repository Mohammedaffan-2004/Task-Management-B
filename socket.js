const { Server } = require("socket.io");

const setupSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(` Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(` Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = setupSocket;