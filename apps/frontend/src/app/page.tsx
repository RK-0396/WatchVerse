'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Play, Users, MessageSquare, Zap, X, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '@/hooks/useSocket';

export default function LandingPage() {
  const router = useRouter();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [roomId, setRoomId] = useState('');
  const [username, setUsername] = useState('');

  // Use a temporary socket for room creation if needed, or just redirect
  const handleCreateRoom = async () => {
    if (!roomName) return;
    const newRoomId = Math.random().toString(36).substr(2, 9);
    // In a real app, we might call an API or socket to create the room server-side first
    // For now, we'll redirect and the first person to join will effectively "create" it in memory
    // or we can emit a CREATE_ROOM event if we have a socket connection here.
    
    // Redirect with query params or state
    router.push(`/room/${newRoomId}?name=${encodeURIComponent(roomName)}&passcode=${passcode}&username=${encodeURIComponent(username)}`);
  };

  const handleJoinRoom = () => {
    if (!roomId) return;
    router.push(`/room/${roomId}?passcode=${passcode}&username=${encodeURIComponent(username)}`);
  };

  return (
    <div className="min-h-screen bg-background text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="text-center z-10 space-y-8 max-w-2xl"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border-white/10 text-sm font-medium text-primary mb-4">
          <Zap size={16} /> Now with 4K Sync Playback
        </div>
        
        <h1 className="text-7xl font-black tracking-tight leading-tight">
          Watch Together, <br />
          <span className="gradient-text">Anywhere.</span>
        </h1>
        
        <p className="text-xl text-white/60 font-medium">
          The ultimate social streaming platform. Watch YouTube, Spotify, and more with friends in perfect sync.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
          <Button size="lg" className="min-w-[200px]" onClick={() => setShowCreateModal(true)}>
            Create Private Room
          </Button>
          <Button variant="glass" size="lg" className="min-w-[200px]" onClick={() => setShowJoinModal(true)}>
            Join Room
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-8 pt-20">
          <Feature icon={<Play size={20} />} title="Real-time Sync" />
          <Feature icon={<Users size={20} />} title="Voice & Video" />
          <Feature icon={<MessageSquare size={20} />} title="Interactive Chat" />
        </div>
      </motion.div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <Modal onClose={() => setShowCreateModal(false)} title="Create Private Room">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/40 mb-1.5">Room Name</label>
                <input 
                  type="text" 
                  placeholder="The Cool Kids' Lounge"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
                <label className="block text-sm font-medium text-white/40 mb-1.5">Your Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors mb-4"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/40 mb-1.5">Passcode (Optional)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    placeholder="Leave empty for public"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 outline-none focus:border-primary/50 transition-colors"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                  />
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                </div>
              </div>
              <Button className="w-full py-6 text-lg mt-4" onClick={handleCreateRoom} disabled={!roomName || !username}>
                Launch WatchVerse
              </Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Join Room Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <Modal onClose={() => setShowJoinModal(false)} title="Join Existing Room">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/40 mb-1.5">Room ID</label>
                <input 
                  type="text" 
                  placeholder="e.g. x8y2z9"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
                <label className="block text-sm font-medium text-white/40 mb-1.5">Your Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 transition-colors mb-4"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/40 mb-1.5">Passcode (If required)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    placeholder="Enter room passcode"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 outline-none focus:border-primary/50 transition-colors"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                  />
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                </div>
              </div>
              <Button className="w-full py-6 text-lg mt-4" onClick={handleJoinRoom} disabled={!roomId || !username}>
                Enter Room
              </Button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass w-full max-w-md p-8 rounded-3xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
        <h2 className="text-3xl font-bold mb-8">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Feature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center text-primary">
        {icon}
      </div>
      <span className="text-sm font-semibold text-white/60">{title}</span>
    </div>
  );
}
