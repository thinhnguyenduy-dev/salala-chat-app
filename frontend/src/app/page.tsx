"use client";

import { SidebarLeft } from "@/components/layout/SidebarLeft";
import { ChatArea } from "@/components/layout/ChatArea";
import { SidebarRight } from "@/components/layout/SidebarRight";
import { useSocket } from "@/hooks/useSocket";
import { useNotifications } from "@/hooks/useNotifications";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  
  useSocket();
  useNotifications();

  // Wait for zustand to hydrate from localStorage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isHydrated, router]);

  // Don't render until hydrated to prevent flash
  if (!isHydrated || !isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <SidebarLeft />
      <ChatArea />
      <SidebarRight />
    </div>
  );
}
