import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initSocketIO } from './realtime/socket.js';
import { authRouter } from './auth/auth.router.js';
import { pairingRouter } from './pairing/pairing.router.js';
import { eventsRouter } from './events/events.router.js';
import { geographyRouter } from './geography/geography.router.js';
import { trafficRouter } from './traffic/traffic.router.js';
import { incidentsRouter } from './incidents/incidents.router.js';
import { safetyRouter } from './safety/safety.router.js';
import { predictiveRouter } from './predictive/predictive.router.js';
import { modelsRouter } from './models/models.router.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Initialize real-time Socket.IO
initSocketIO(server);

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// URL Normalizer: Strip duplicate slashes (e.g. //api/pairing/request -> /api/pairing/request)
app.use((req, res, next) => {
  if (req.url.startsWith('//')) {
    req.url = req.url.replace(/^\/+/, '/');
  }
  next();
});

// Request logger
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.url.startsWith('/api/pairing/status')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/pairing', pairingRouter);
app.use('/api/events', eventsRouter);
app.use('/api/detections', eventsRouter);
app.use('/detections', eventsRouter);
app.use('/api/geography', geographyRouter);
app.use('/api/traffic', trafficRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/safety', safetyRouter);
app.use('/api/predictive', predictiveRouter);
app.use('/api/models', modelsRouter);



app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'UrbanEye Command Center API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Production: Serve the built Vite frontend dashboard
const clientDistCandidates = [
  path.resolve(__dirname, '../../web/dist'),
  path.resolve(process.cwd(), '../web/dist'),
  path.resolve(process.cwd(), 'urbaneye-command/web/dist'),
  path.resolve(__dirname, '../public'),
];
const clientDistPath = clientDistCandidates.find(p => fs.existsSync(p));
if (clientDistPath) {
  console.log(`🌐 Serving production web dashboard from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/socket.io') || req.url.startsWith('/detections')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🛡️  UrbanEye Command Backend listening on port ${PORT}`);
  console.log(`📡 WebSocket / Socket.IO live intelligence streaming active`);
  console.log(`🔗 REST API endpoints mounted at /api/*`);
  console.log(`====================================================`);
});
