"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { subjectsApi } from "@/lib/api";
import type { Subject } from "@/lib/types";

const KEY = ["subjects"] as const;

export function useSubjects() {
  return useQuery({ queryKey: KEY, queryFn: subjectsApi.list });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subjectsApi.create,
    // Add it straight away (sorted by name) so the new subject can be picked at once.
    onSuccess: (subject) =>
      queryClient.setQueryData<Subject[]>(KEY, (old = []) =>
        [...old.filter((s) => s.id !== subject.id), subject].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        ),
      ),
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: subjectsApi.remove,
    // Its sessions become unsorted, so the session list changes too.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: KEY }),
        queryClient.invalidateQueries({ queryKey: ["lessons"] }),
      ]),
  });
}
