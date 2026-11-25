"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appleCalendarApi } from "@/lib/api";

const KEY = ["apple-calendar"] as const;

/** Whether due dates are written into Apple Calendar, and how the last sync went. */
export function useAppleCalendar() {
  return useQuery({
    queryKey: KEY,
    queryFn: appleCalendarApi.status,
    // while a sync runs in the background (after a new summary), check back until it's done
    refetchInterval: (query) => (query.state.data?.syncing ? 1500 : false),
  });
}

export function useSetAppleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appleCalendarApi.setEnabled,
    onSuccess: (status) => queryClient.setQueryData(KEY, status),
  });
}

export function useSyncAppleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: appleCalendarApi.sync,
    onSuccess: (status) => queryClient.setQueryData(KEY, status),
  });
}
