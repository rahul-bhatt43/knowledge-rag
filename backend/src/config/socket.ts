// import { Server } from 'socket.io';
// import http from 'http';

// export function setupSocketServer(server: http.Server) {
//   const io = new Server(server, { cors: { origin: '*' } });
//   // Register namespaces, middleware, and event handlers here
//   io.on('connection', (socket) => {
//     console.log('Client connected', socket.id);
//   });
//   return io;
// }

export const socketConfig = {
  pingInterval: 10000,
  pingTimeout: 5000,
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
};
