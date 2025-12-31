import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
import { ChatArea } from './ChatArea';

export function MainLayout() {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Left Sidebar - Friends/Navigation */}
      <SidebarLeft />

      {/* Main Chat Area */}
      <ChatArea />

      {/* Right Sidebar - Info */}
      <SidebarRight />
    </div>
  );
}
