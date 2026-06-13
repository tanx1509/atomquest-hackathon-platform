'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, ArrowLeft, Copy, Check } from 'lucide-react';

export default function Dashboard() {
  const router = useRouter();
  const [createdSession, setCreatedSession] = useState('');
  const [copied, setCopied] = useState(false);

  const generateSession = () => {
    const sessionId = Math.random().toString(36).substring(2, 9);
    setCreatedSession(sessionId);
    setCopied(false);
  };

  const copyLink = () => {
    const link = `${window.location.origin}/session/${createdSession}?role=customer`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const joinSession = () => {
    router.push(`/session/${createdSession}?role=agent`);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
        
        <h1 className="text-3xl font-bold mb-8">Agent Dashboard</h1>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="bg-emerald-500/10 p-3 rounded-lg">
              <PlusCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Create Support Session</h2>
              <p className="text-slate-400">Generate a unique room for video assistance</p>
            </div>
          </div>

          {!createdSession ? (
            <button 
              onClick={generateSession}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5" /> Generate Session
            </button>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Session ID / Token</p>
                  <p className="font-mono text-xl text-emerald-400">{createdSession}</p>
                </div>
                <button 
                  onClick={copyLink}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied URL' : 'Copy Invite URL'}
                </button>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={joinSession}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                >
                  Join Session as Agent
                </button>
                <button 
                  onClick={() => setCreatedSession('')}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
