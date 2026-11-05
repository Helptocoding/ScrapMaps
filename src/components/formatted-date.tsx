'use client';

import { useSyncExternalStore } from "react";

import { formatDate, formatRelativeDays } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function deterministicFallback(value: string | Date) {
  return `${new Date(value).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

type FormattedDateProps = {
  value: string | Date;
  relative?: boolean;
};

export function FormattedDate({ value, relative = false }: FormattedDateProps) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return deterministicFallback(value);
  }

  return relative ? formatRelativeDays(value) : formatDate(value);
}
