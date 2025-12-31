import { useInfiniteQuery } from '@tanstack/react-query';
import { IMessage } from '@repo/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FetchMessagesResponse {
  data: IMessage[];
  nextCursor: string | null;
}

export const useMessagesInfinite = (conversationId: string | null) => {
  return useInfiniteQuery<FetchMessagesResponse>({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam = undefined }) => {
      if (!conversationId) return { data: [], nextCursor: null };
      
      const params = new URLSearchParams();
      if (pageParam) params.append('cursor', pageParam as string);
      params.append('limit', '20');

      const res = await fetch(`${API_URL}/social/messages/${conversationId}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!conversationId,
    // Provide new pages at the beginning of the list? No, TanStack Query appends pages.
    // We will reverse the order in UI or use `select` option if needed.
    // Keeping data raw here is best.
  });
};
