"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthValidation } from "@/hooks/useAuthValidation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const { isValidating, isValid } = useAuthValidation();

  // useSocket(); // Removed to prevent duplicate connection (ChatArea handles it)
  // Only initialize notifications after user is validated
  useNotifications(isValid);

  // Wait for zustand to hydrate from localStorage
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated && !isValidating && (!isAuthenticated || !isValid)) {
      router.push('/login');
    }
  }, [isAuthenticated, isHydrated, isValidating, isValid, router]);

  // Don't render until hydrated and validated
  if (!isHydrated || isValidating || !isAuthenticated || !isValid) {
    return null;
  }

  return (
    <MainLayout />
  );
}
