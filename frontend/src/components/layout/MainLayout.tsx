"use client";

import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
import { ChatArea } from './ChatArea';
import { MobileNav } from './MobileNav';
import { useChatStore } from '@/store/useChatStore';

export function MainLayout() {
  const { isInfoSidebarOpen, mobileView, activeConversationId } = useChatStore();

  return (
    <>
      <div className="flex h-screen w-full bg-background overflow-hidden pb-16 md:pb-0">
        {/* Mobile: Single view based on mobileView state */}
        {/* Desktop: Show all panels */}
        
        {/* Left Sidebar - Friends/Navigation */}
        <div className={`
          ${mobileView === 'chats' || mobileView === 'friends' || mobileView === 'profile' ? 'flex' : 'hidden'}
          md:flex
          w-full md:w-80
        `}>
          <SidebarLeft />
        </div>

        {/* Main Chat Area */}
        <div className={`
          ${mobileView === 'chat' || !activeConversationId ? 'flex' : 'hidden'}
          md:flex
          flex-1
        `}>
          <ChatArea />
        </div>

        {/* Right Sidebar - Info */}
        {isInfoSidebarOpen && (
          <div className="hidden lg:block">
            <SidebarRight />
          </div>
        )}
      </div>
      
      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </>
  );
}
