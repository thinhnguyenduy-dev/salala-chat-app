"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuthValidation } from "@/hooks/useAuthValidation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const { isValidating, isValid } = useAuthValidation();

  // Only initialize notifications after user is validated
  useNotifications(isValid);

  useEffect(() => {
    // Only redirect after Zustand has hydrated from localStorage
    if (_hasHydrated && !isValidating && (!isAuthenticated || !isValid)) {
      router.push('/login');
    }
  }, [isAuthenticated, _hasHydrated, isValidating, isValid, router]);

  // Don't render until hydrated and validated
  if (!_hasHydrated || isValidating || !isAuthenticated || !isValid) {
    return null;
  }

  return (
    <MainLayout />
  );
}
