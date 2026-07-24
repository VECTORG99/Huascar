export type CommitApproval = {
  status: 'pending' | 'approved' | 'rejected';
  diffContext: string;
  createdAt: string;
};

export const commitApprovals = new Map<string, CommitApproval>();
