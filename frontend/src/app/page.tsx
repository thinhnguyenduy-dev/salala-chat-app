"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { useNotifications } from "@/hooks/useNotifications";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  
  // useSocket(); // Removed to prevent duplicate connection (ChatArea handles it)
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
    <MainLayout />
  );
}
