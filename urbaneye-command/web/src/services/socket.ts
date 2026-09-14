import { io, Socket } from 'socket.io-client';
import { RoadEvent } from '../types';

let socket: Socket | null = null;
let activeSubscribedDistrict: string | null = null;

const getSocketTarget = (): string => {
  try {
    const envUrl = (((import.meta as any).env?.VITE_API_URL) as string) || '';
    if (envUrl) {
      return envUrl.replace(/\/api\/?$/, '');
    }
  } catch {
    // fallback
  }
  return '/';
};

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getSocketTarget(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to UrbanEye Live Intelligence Stream');
      if (activeSubscribedDistrict) {
        console.log(`📡 Re-joining district room: ${activeSubscribedDistrict}`);
        socket?.emit('join:district', activeSubscribedDistrict);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from Live Stream');
    });
  }
  return socket;
}

export function subscribeToDistrict(
  districtId: string,
  onNewEvent: (event: RoadEvent) => void,
  onEventUpdated: (event: RoadEvent) => void,
  districtCodeOrName?: string,
  onEventDeleted?: (data: { id: string }) => void
): () => void {
  const s = getSocket();
  activeSubscribedDistrict = districtId;

  // Join district ID and alternate name/code
  s.emit('join:district', districtId);
  if (districtCodeOrName) {
    s.emit('join:district', districtCodeOrName);
    s.emit('join:district', districtCodeOrName.toLowerCase());
  }

  const handleNew = (event: RoadEvent) => {
    onNewEvent(event);
  };

  const handleUpdated = (event: RoadEvent) => {
    onEventUpdated(event);
  };

  const handleDeleted = (data: { id: string }) => {
    if (onEventDeleted) onEventDeleted(data);
  };

  s.on('event:new', handleNew);
  s.on('event:updated', handleUpdated);
  s.on('event:deleted', handleDeleted);

  return () => {
    s.off('event:new', handleNew);
    s.off('event:updated', handleUpdated);
    s.off('event:deleted', handleDeleted);
  };
}

export function subscribeToNational(
  onNewEvent: (event: RoadEvent) => void,
  onEventUpdated: (event: RoadEvent) => void
): () => void {
  const s = getSocket();
  s.emit('join:national');

  const handleNew = (event: RoadEvent) => {
    onNewEvent(event);
  };

  const handleUpdated = (event: RoadEvent) => {
    onEventUpdated(event);
  };

  s.on('event:new', handleNew);
  s.on('event:updated', handleUpdated);

  return () => {
    s.off('event:new', handleNew);
    s.off('event:updated', handleUpdated);
  };
}
