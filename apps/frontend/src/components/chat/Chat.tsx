'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@watchverse/types';
import { Button } from '../ui/button';
import { Send, Smile } from 'lucide-react';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';

interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  currentUserId: string;
}

export const Chat = ({ messages, onSendMessage, currentUserId }: ChatProps) => {
  const [input, setInput] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to get a consistent color for a username
  const getUserColor = (username: string) => {
    const colors = ['#8b5cf6', '#d946ef', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    setShowEmojiPicker(false);
  };

  const onEmojiClick = (emojiObject: any) => {
    setInput(prev => prev + emojiObject.emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-background/20 backdrop-blur-3xl overflow-hidden border-t border-white/5">
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">Live Chat</h3>
        <div className="flex items-center gap-1.5">
           <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
           <span className="text-[10px] font-bold text-primary/80 uppercase">{messages.length} Messages</span>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-hide"
      >
        {messages.map((msg, i) => {
          const isMe = msg.senderId === currentUserId || (msg as any).userId === currentUserId || msg.username === (currentUserId as any) /* fallback just in case */;
          const userColor = getUserColor(msg.username);
          
          return (
            <div 
              key={msg.id || i}
              className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div 
                className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white/80 border border-white/10"
                style={{ backgroundColor: `${userColor}33`, borderColor: `${userColor}44` }}
              >
                {msg.username.charAt(0).toUpperCase()}
              </div>
              
              <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <span className="text-[10px] font-bold text-white/20 uppercase tracking-wider mb-1 ml-1">
                    {msg.username}
                  </span>
                )}
                <div 
                  className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-lg ${
                    isMe 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-none'
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[8px] font-medium text-white/10 mt-1 uppercase tracking-tighter">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-black/20 border-t border-white/10 flex gap-2 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-full right-4 mb-2 z-50 shadow-2xl">
            <EmojiPicker 
              theme={Theme.DARK} 
              emojiStyle={EmojiStyle.NATIVE} 
              onEmojiClick={onEmojiClick}
              lazyLoadEmojis={true}
              height={350}
            />
          </div>
        )}
        <Button 
          type="button" 
          variant="ghost" 
          size="sm" 
          className={`w-10 h-10 p-0 rounded-xl hover:bg-white/5 ${showEmojiPicker ? 'text-primary bg-primary/10' : 'text-white/40'}`}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile size={20} />
        </Button>
        <input 
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-primary/50 transition-colors"
        />
        <Button type="submit" size="sm" className="w-10 h-10 p-0 rounded-xl bg-primary hover:bg-primary/90 text-white">
          <Send size={18} />
        </Button>
      </form>
    </div>
  );
};
