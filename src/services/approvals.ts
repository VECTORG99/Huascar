export type CommitApproval = {
  status: 'pending' | 'approved' | 'rejected';
  diffContext: string;
  createdAt: string;
};

export const commitApprovals = new Map<string, CommitApproval>();
export const approvalTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Clean up all pending approval timers (for graceful shutdown) */
export function clearApprovalTimers(): void {
  for (const [id, timer] of approvalTimers) {
    clearTimeout(timer);
    approvalTimers.delete(id);
  }
}
