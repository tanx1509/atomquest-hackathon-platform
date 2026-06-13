/* eslint-disable */
import * as mediasoupClient from 'mediasoup-client';
import { socket } from './socket';

export class WebRTCManager {
  device: mediasoupClient.Device | null = null;
  sendTransport: mediasoupClient.types.Transport | null = null;
  recvTransport: mediasoupClient.types.Transport | null = null;
  producerVideo: mediasoupClient.types.Producer | null = null;
  producerAudio: mediasoupClient.types.Producer | null = null;
  consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  remoteTracks: Map<string, MediaStreamTrack> = new Map();

  onRemoteTrackAdded: ((peerId: string, track: MediaStreamTrack) => void) | null = null;

  async loadDevice(routerRtpCapabilities: mediasoupClient.types.RtpCapabilities) {
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities });
  }

  async initTransports() {
    // Create Send Transport
    const sendTransportData = await new Promise<any>((resolve) => {
      socket.emit('createWebRtcTransport', {}, resolve);
    });

    this.sendTransport = this.device!.createSendTransport(sendTransportData.params);

    this.sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('connectTransport', {
        transportId: this.sendTransport!.id,
        dtlsParameters
      }, callback);
    });

    this.sendTransport.on('produce', async (parameters, callback, errback) => {
      socket.emit('produce', {
        transportId: this.sendTransport!.id,
        kind: parameters.kind,
        rtpParameters: parameters.rtpParameters,
      }, ({ id }: { id: string }) => {
        callback({ id });
      });
    });

    // Create Recv Transport
    const recvTransportData = await new Promise<any>((resolve) => {
      socket.emit('createWebRtcTransport', {}, resolve);
    });

    this.recvTransport = this.device!.createRecvTransport(recvTransportData.params);

    this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('connectTransport', {
        transportId: this.recvTransport!.id,
        dtlsParameters
      }, callback);
    });
  }

  async produce(track: MediaStreamTrack) {
    if (track.kind === 'video') {
      this.producerVideo = await this.sendTransport!.produce({ track });
    } else if (track.kind === 'audio') {
      this.producerAudio = await this.sendTransport!.produce({ track });
    }
  }

  async consume(producerId: string, peerId: string) {
    const { rtpCapabilities } = this.device!;
    const data = await new Promise<any>((resolve) => {
      socket.emit('consume', {
        transportId: this.recvTransport!.id,
        producerId,
        rtpCapabilities
      }, resolve);
    });

    if (data.error) {
      console.error(data.error);
      return;
    }

    const consumer = await this.recvTransport!.consume({
      id: data.params.id,
      producerId: data.params.producerId,
      kind: data.params.kind,
      rtpParameters: data.params.rtpParameters,
    });

    this.consumers.set(consumer.id, consumer);
    this.remoteTracks.set(consumer.id, consumer.track);

    if (this.onRemoteTrackAdded) {
      this.onRemoteTrackAdded(peerId, consumer.track);
    }

    socket.emit('resumeConsumer', { consumerId: consumer.id }, () => {});
  }
}
