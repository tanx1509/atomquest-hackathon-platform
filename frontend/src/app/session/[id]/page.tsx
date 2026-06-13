/* eslint-disable */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { socket } from '@/lib/socket';
import { WebRTCManager } from '@/lib/webrtc';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, MessageSquare, Circle, StopCircle } from 'lucide-react';

export default function SessionRoom({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = searchParams.get('role') || 'customer';
  const sessionId = params.id;

  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoContainerRef = useRef<HTMLDivElement>(null);
  
  const webrtcManager = useRef<WebRTCManager | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  useEffect(() => {
    socket.connect();
    webrtcManager.current = new WebRTCManager();

    webrtcManager.current.onRemoteTrackAdded = (peerId, track) => {
      let videoEl = document.getElementById(`video-${peerId}`) as HTMLVideoElement;
      if (!videoEl) {
        videoEl = document.createElement('video');
        videoEl.id = `video-${peerId}`;
        videoEl.autoplay = true;
        videoEl.playsInline = true;
        videoEl.className = 'w-full h-full object-cover rounded-xl bg-slate-800 border border-slate-700';
        remoteVideoContainerRef.current?.appendChild(videoEl);
      }
      
      const stream = videoEl.srcObject as MediaStream || new MediaStream();
      stream.addTrack(track);
      videoEl.srcObject = stream;
    };

    socket.on('connect', () => {
      socket.emit('joinRoom', { sessionId, role }, async (data: any) => {
        if (data.error) return alert(data.error);
        
        setMessages(data.chats || []);
        
        await webrtcManager.current!.loadDevice(data.routerRtpCapabilities);
        await webrtcManager.current!.initTransports();
        
        startLocalMedia();
        setConnected(true);
      });
    });

    socket.on('newProducer', ({ producerId, peerId }) => {
      webrtcManager.current?.consume(producerId, peerId);
    });

    socket.on('userLeft', ({ peerId }) => {
      const el = document.getElementById(`video-${peerId}`);
      if (el) el.remove();
    });

    socket.on('newMessage', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('callEnded', () => {
      alert('The session was ended by the agent.');
      endCallLocal();
    });

    return () => {
      socket.disconnect();
      localStream.current?.getTracks().forEach(t => t.stop());
    };
  }, [sessionId, role]);

  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStream.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach(track => {
        webrtcManager.current?.produce(track);
      });
    } catch (e) {
      console.error('Failed to get local media', e);
    }
  };

  const toggleMic = () => {
    if (localStream.current) {
      const audioTrack = localStream.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (localStream.current) {
      const videoTrack = localStream.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCamOn(videoTrack.enabled);
      }
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('sendMessage', { text: chatInput }, () => {
      setChatInput('');
    });
  };

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorder.current?.stop();
      setIsRecording(false);
    } else {
      if (!localStream.current) return;
      // In a real app we'd composite remote streams too, or record via SFU
      mediaRecorder.current = new MediaRecorder(localStream.current);
      mediaRecorder.current.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${sessionId}.webm`;
        a.click();
        recordedChunks.current = [];
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    }
  };

  const endCall = () => {
    if (role === 'agent') {
      socket.emit('endCall');
    }
    endCallLocal();
  };

  const endCallLocal = () => {
    localStream.current?.getTracks().forEach(t => t.stop());
    router.push(role === 'agent' ? '/dashboard' : '/');
  };

  return (
    <div className="h-screen bg-slate-900 text-white flex overflow-hidden">
      {/* Video Grid */}
      <div className="flex-1 p-4 flex flex-col relative">
        <div className="absolute top-6 left-6 z-10 bg-slate-800/80 px-4 py-2 rounded-lg backdrop-blur-md border border-slate-700">
          <p className="font-semibold text-emerald-400">Session: {sessionId}</p>
          <p className="text-xs text-slate-300 capitalize">{role} View</p>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center p-4" ref={remoteVideoContainerRef}>
          {/* Local Video */}
          <div className="relative w-full h-full max-h-full aspect-video rounded-xl overflow-hidden bg-slate-800 border border-slate-700">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1 rounded-md text-sm backdrop-blur-md">
              You ({role})
            </div>
          </div>
          {/* Remote videos append here via ref */}
        </div>

        {/* Controls */}
        <div className="h-24 bg-slate-800/50 backdrop-blur-lg rounded-2xl mx-4 mb-4 flex items-center justify-center gap-6 border border-slate-700">
          <button onClick={toggleMic} className={`p-4 rounded-full ${micOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'} transition-colors`}>
            {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          <button onClick={toggleCam} className={`p-4 rounded-full ${camOn ? 'bg-slate-700 hover:bg-slate-600' : 'bg-red-500 hover:bg-red-600'} transition-colors`}>
            {camOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
          
          {role === 'agent' && (
            <button onClick={toggleRecording} className={`p-4 rounded-full ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'} transition-colors`}>
              {isRecording ? <StopCircle className="w-6 h-6" /> : <Circle className="w-6 h-6 text-red-400 fill-red-400" />}
            </button>
          )}

          <button onClick={endCall} className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors ml-8">
            <PhoneOff className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Chat Sidebar */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h2 className="font-semibold text-lg">In-Call Chat</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.senderRole === role ? 'items-end' : 'items-start'}`}>
              <span className="text-xs text-slate-400 mb-1 capitalize">{msg.senderRole}</span>
              <div className={`px-4 py-2 rounded-2xl max-w-[90%] ${msg.senderRole === role ? 'bg-blue-600 rounded-tr-none' : 'bg-slate-700 rounded-tl-none'}`}>
                {msg.message}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="p-4 bg-slate-900 border-t border-slate-700 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
          <button type="submit" className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
