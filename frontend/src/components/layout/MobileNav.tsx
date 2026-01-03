"use client";

import { MessageSquare, Users, User } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';

export function MobileNav() {
  const { mobileView, setMobileView } = useChatStore();

  const tabs = [
    { id: 'chats' as const, label: 'Chats', icon: MessageSquare },
    { id: 'friends' as const, label: 'Friends', icon: Users },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = mobileView === tab.id || (mobileView === 'chat' && tab.id === 'chats');
          
          return (
            <button
              key={tab.id}
              onClick={() => setMobileView(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
