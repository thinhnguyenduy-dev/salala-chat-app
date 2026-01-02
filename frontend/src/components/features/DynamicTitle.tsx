"use client";

import { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export function DynamicTitle() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (user?.displayName || user?.username) {
      document.title = `Salala - ${user.displayName || user.username}`;
    } else {
      document.title = "Salala";
    }
  }, [user?.username, user?.displayName]);

  return null;
}
