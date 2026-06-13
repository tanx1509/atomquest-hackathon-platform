const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mediasoup = require('mediasoup');
const cors = require('cors');
const config = require('./config');
const db = require('./db');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

let worker;
let router;

const initMediasoup = async () => {
  worker = await mediasoup.createWorker({
    logLevel: config.mediasoup.worker.logLevel,
    logTags: config.mediasoup.worker.logTags,
    rtcMinPort: config.mediasoup.worker.rtcMinPort,
    rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
  });

  worker.on('died', () => {
    console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
    setTimeout(() => process.exit(1), 2000);
  });

  router = await worker.createRouter({ mediaCodecs: config.mediasoup.router.mediaCodecs });
  console.log('Mediasoup Worker and Router initialized');
};

initMediasoup();

// Map sessionId -> { transports: Map, producers: Map, consumers: Map }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  socket.on('joinRoom', async ({ sessionId, role }, callback) => {
    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.role = role;

    if (!rooms.has(sessionId)) {
      rooms.set(sessionId, {
        transports: new Map(),
        producers: new Map(),
        consumers: new Map(),
        peers: new Map()
      });
      // Register session in DB if it's the first one (Agent creates it)
      if (role === 'agent') {
        try {
          await db.createSession(sessionId, socket.id);
        } catch (e) {
          console.error(e);
        }
      }
    }
    const room = rooms.get(sessionId);
    room.peers.set(socket.id, { role });

    socket.to(sessionId).emit('userJoined', { peerId: socket.id, role });
    
    // Fetch previous chats
    const chats = await db.getChats(sessionId);
    
    callback({
      routerRtpCapabilities: router.rtpCapabilities,
      peers: Array.from(room.peers.keys()),
      chats
    });
  });

  socket.on('createWebRtcTransport', async (_, callback) => {
    try {
      const { listenIps, initialAvailableOutgoingBitrate, maxIncomingBitrate } = config.mediasoup.webRtcTransport;
      const transport = await router.createWebRtcTransport({
        listenIps,
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate,
      });

      if (maxIncomingBitrate) {
        try {
          await transport.setMaxIncomingBitrate(maxIncomingBitrate);
        } catch (error) {}
      }

      transport.on('dtlsstatechange', dtlsState => {
        if (dtlsState === 'closed') {
          transport.close();
        }
      });

      const room = rooms.get(socket.sessionId);
      room.transports.set(transport.id, transport);

      callback({
        params: {
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        }
      });
    } catch (err) {
      console.error(err);
      callback({ error: err.message });
    }
  });

  socket.on('connectTransport', async ({ transportId, dtlsParameters }, callback) => {
    const room = rooms.get(socket.sessionId);
    const transport = room.transports.get(transportId);
    await transport.connect({ dtlsParameters });
    callback('success');
  });

  socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
    const room = rooms.get(socket.sessionId);
    const transport = room.transports.get(transportId);
    const producer = await transport.produce({ kind, rtpParameters });

    room.producers.set(producer.id, producer);
    producer.on('transportclose', () => {
      producer.close();
      room.producers.delete(producer.id);
    });

    // Notify other peers in room about new producer
    socket.to(socket.sessionId).emit('newProducer', { producerId: producer.id, peerId: socket.id });
    
    callback({ id: producer.id });
  });

  socket.on('consume', async ({ transportId, producerId, rtpCapabilities }, callback) => {
    const room = rooms.get(socket.sessionId);
    const transport = room.transports.get(transportId);

    if (!router.canConsume({ producerId, rtpCapabilities })) {
      console.error('can not consume');
      return callback({ error: 'cannot consume' });
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });

    room.consumers.set(consumer.id, consumer);

    consumer.on('transportclose', () => {
      consumer.close();
      room.consumers.delete(consumer.id);
    });

    consumer.on('producerclose', () => {
      consumer.close();
      room.consumers.delete(consumer.id);
      socket.emit('consumerClosed', { consumerId: consumer.id });
    });

    callback({
      params: {
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      }
    });
  });

  socket.on('resumeConsumer', async ({ consumerId }, callback) => {
    const room = rooms.get(socket.sessionId);
    const consumer = room.consumers.get(consumerId);
    await consumer.resume();
    callback();
  });

  // Chat
  socket.on('sendMessage', async ({ text }, callback) => {
    const sessionId = socket.sessionId;
    const role = socket.role;
    try {
      await db.saveChat(sessionId, role, text);
      const msg = { senderRole: role, message: text, timestamp: new Date() };
      io.to(sessionId).emit('newMessage', msg);
      callback({ success: true });
    } catch (e) {
      callback({ error: e.message });
    }
  });

  socket.on('endCall', async () => {
    const sessionId = socket.sessionId;
    await db.endSession(sessionId);
    io.to(sessionId).emit('callEnded');
    rooms.delete(sessionId);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    const sessionId = socket.sessionId;
    if (sessionId && rooms.has(sessionId)) {
      const room = rooms.get(sessionId);
      room.peers.delete(socket.id);
      socket.to(sessionId).emit('userLeft', { peerId: socket.id });
    }
  });
});

app.get('/api/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
