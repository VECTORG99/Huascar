import { useCallback, useEffect, useState } from "react";

import { getHistory } from "@/lib/api";
import type { HistoryRecord } from "@/types/agent";

export function useExecutionHistory() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await getHistory());
    } catch {
      // History is non-critical.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(fetchHistory); }, [fetchHistory]);

  return { history, historyLoading, expandedId, setExpandedId, fetchHistory };
}
