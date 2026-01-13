"use client";

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

export function useAuthValidation() {
  const { user, logout, isAuthenticated } = useAuthStore();
  const [isValidating, setIsValidating] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    const validateUser = async () => {
      // Need token to validate session
      // @ts-ignore
      const token = useAuthStore.getState().token;
      
      if (!isAuthenticated || !user?.id || !token) {
        setIsValidating(false);
        setIsValid(false);
        return;
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        // Use protected endpoint to verify token validity
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.status === 401 || response.status === 403) {
          console.warn('Session expired or invalid, logging out');
          logout();
          setIsValid(false);
        } else if (!response.ok) {
           // Handle 404 (user deleted) or 500 (server error)
           // If 404, user doesn't exist anymore
           if (response.status === 404) {
             console.warn('User not found, logging out');
             logout();
             setIsValid(false);
           } else {
             // Server error, assume valid for now (don't force logout on 500)
             console.error('Validation server error:', response.status);
             setIsValid(true);
           }
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
