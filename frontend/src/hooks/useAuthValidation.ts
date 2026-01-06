"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export function useAuthValidation() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateUser = async () => {
      if (!isAuthenticated || !user?.id) {
        setIsValidating(false);
        setIsValid(false);
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const response = await fetch(`${apiUrl}/social/user/${user.id}`);

        if (!response.ok) {
          console.warn('User session invalid, logging out');
          logout();
          setIsValid(false);
        } else {
          setIsValid(true);
        }
      } catch (error) {
        console.error('Error validating user session:', error);
        // On network error, don't logout - might be temporary
        setIsValid(true);
      } finally {
        setIsValidating(false);
      }
    };

    validateUser();
  }, [user?.id, isAuthenticated, logout]);

  return { isValidating, isValid };
}
