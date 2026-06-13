'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Video, User, HeadphonesIcon } from 'lucide-react';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [token, setToken] = useState('');

  const joinAsCustomer = () => {
    if (token) {
      router.push(`/session/${token}?role=customer`);
    }
  };

  const loginAsAgent = () => {
    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-xl space-y-8">
        <div className="text-center">
          <Video className="w-16 h-16 mx-auto text-blue-500 mb-4" />
          <h1 className="text-3xl font-bold text-white">AtomQuest Support</h1>
          <p className="text-slate-400 mt-2">Real-time video assistance platform</p>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600">
            <div className="flex items-center gap-3 mb-4">
              <HeadphonesIcon className="w-6 h-6 text-emerald-400" />
              <h2 className="text-xl font-semibold">Support Agents</h2>
            </div>
            <Link
              href="/dashboard"
              className="block text-center w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              Login to Dashboard
            </Link>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-slate-400">OR</span>
            </div>
          </div>

          <div className="bg-slate-700/50 p-6 rounded-xl border border-slate-600">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-6 h-6 text-blue-400" />
              <h2 className="text-xl font-semibold">Customers</h2>
            </div>
            <input
              type="text"
              placeholder="Enter Session Token"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 mb-3 text-white focus:outline-none focus:border-blue-500"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <button
              onClick={joinAsCustomer}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50"
              disabled={!token}
            >
              Join Session
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
