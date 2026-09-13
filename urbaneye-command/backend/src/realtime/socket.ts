import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

export let io: SocketIOServer | null = null;


export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  io.on('connection', (socket: Socket) => {
    // Client can subscribe to their scoped district feed
    socket.on('join:district', (districtId: string) => {
      if (districtId) {
        socket.join(`district:${districtId}`);
        socket.join(`district:${districtId.toLowerCase()}`);
      }
    });

    // State admin can subscribe to their state feed
    socket.on('join:state', (stateId: string) => {
      if (stateId) {
        socket.join(`state:${stateId}`);
      }
    });

    // Mobile app can subscribe to its device session pairing status
    socket.on('join:session', (sessionId: string) => {
      if (sessionId) {
        socket.join(`session:${sessionId}`);
      }
    });

    // National admin can subscribe to all events
    socket.on('join:national', () => {
      socket.join('national:live');
    });

    socket.on('disconnect', () => {
      // clean up automatically handled by socket.io
    });
  });

  return io;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function emitNewRoadEvent(event: any): void {
  if (!io) return;
  // Send to district rooms
  io.to(`district:${event.districtId}`).emit('event:new', event);
  io.to(`district:${String(event.districtId).toLowerCase()}`).emit('event:new', event);
  if (event.district?.code) {
    io.to(`district:${String(event.district.code).toLowerCase()}`).emit('event:new', event);
  }
  if (event.district?.name) {
    io.to(`district:${String(event.district.name).toLowerCase()}`).emit('event:new', event);
  }
  // Send to state room
  if (event.district?.stateId) {
    io.to(`state:${event.district.stateId}`).emit('event:new', event);
  }
  // Send to national live overview
  io.to('national:live').emit('event:new', event);
}

export function emitRoadEventUpdated(event: any): void {
  if (!io) return;
  io.to(`district:${event.districtId}`).emit('event:updated', event);
  io.to(`district:${String(event.districtId).toLowerCase()}`).emit('event:updated', event);
  if (event.district?.code) {
    io.to(`district:${String(event.district.code).toLowerCase()}`).emit('event:updated', event);
  }
  if (event.district?.stateId) {
    io.to(`state:${event.district.stateId}`).emit('event:updated', event);
  }
  io.to('national:live').emit('event:updated', event);
}

export function emitRoadEventDeleted(eventId: string, districtId: string, stateId?: string): void {
  if (!io) return;
  io.to(`district:${districtId}`).emit('event:deleted', { id: eventId, districtId });
  io.to(`district:${String(districtId).toLowerCase()}`).emit('event:deleted', { id: eventId, districtId });
  if (stateId) {
    io.to(`state:${stateId}`).emit('event:deleted', { id: eventId, districtId });
  }
  io.to('national:live').emit('event:deleted', { id: eventId, districtId });
}

export function emitPairingConfirmed(session: any): void {
  if (!io) return;
  io.to(`session:${session.id}`).emit('pairing:confirmed', {
    status: 'PAIRED',
    deviceSessionId: session.id,
    busLabel: session.busLabel,
    routeTag: session.routeTag,
    districtId: session.districtId,
    districtName: session.district?.name,
  });
}
