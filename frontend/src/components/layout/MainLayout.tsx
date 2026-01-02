"use client";

import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
import { ChatArea } from './ChatArea';
import { useChatStore } from '@/store/useChatStore';

export function MainLayout() {
  const isInfoSidebarOpen = useChatStore((state) => state.isInfoSidebarOpen);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Sidebar - Friends/Navigation */}
      <SidebarLeft />

      {/* Main Chat Area */}
      <ChatArea />

      {/* Right Sidebar - Info */}
      {isInfoSidebarOpen && <SidebarRight />}
    </div>
  );
}
