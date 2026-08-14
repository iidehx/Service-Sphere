import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  listReports, 
  getUserProfile, 
  disableUser, 
  enableUser, 
  dismissReport 
} from '@/lib/firestoreAdmin';
import { EnrichedReport, UserProfile } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

// This function fetches reports immediately and returns them.
// It also triggers async profile fetching that will update the query cache.
async function fetchReportsBase(queryClient: any): Promise<EnrichedReport[]> {
  const reports = await listReports();
  
  // Return immediately without profiles to prevent blocking UI
  const baseReports = reports.map(r => ({ ...r } as EnrichedReport));
  
  // Trigger async enrichment
  enrichReports(reports, queryClient);
  
  return baseReports;
}

// Async enrichment
async function enrichReports(reports: any[], queryClient: any) {
  const uids = new Set<string>();
  reports.forEach(r => {
    if (r.reporterId) uids.add(r.reporterId);
    if (r.reportedUserId) uids.add(r.reportedUserId);
  });
  
  // Fetch missing profiles
  const profilesMap = new Map<string, UserProfile | null>();
  const promises = Array.from(uids).map(async uid => {
    try {
      const p = await getUserProfile(uid);
      profilesMap.set(uid, p);
    } catch {
      profilesMap.set(uid, null);
    }
  });
  
  await Promise.all(promises);

  // Update query cache with enriched data
  queryClient.setQueryData(['reports'], (old: EnrichedReport[] | undefined) => {
    if (!old) return old;
    return old.map(r => ({
      ...r,
      reporterProfile: r.reporterId ? profilesMap.get(r.reporterId) || null : null,
      accusedProfile: r.reportedUserId ? profilesMap.get(r.reportedUserId) || null : null,
    }));
  });
}

export function useReports() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['reports'],
    queryFn: () => fetchReportsBase(queryClient),
    enabled: !!user,
  });
}

export function useDisableUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: disableUser,
    onSuccess: (_, uid) => {
      queryClient.setQueryData<EnrichedReport[]>(['reports'], (old) => {
        if (!old) return old;
        return old.map(report => {
          if (report.reportedUserId === uid && report.accusedProfile) {
            return {
              ...report,
              accusedProfile: { ...report.accusedProfile, disabled: true }
            };
          }
          return report;
        });
      });
      // Ensure backend data is completely fresh
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useEnableUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: enableUser,
    onSuccess: (_, uid) => {
      queryClient.setQueryData<EnrichedReport[]>(['reports'], (old) => {
        if (!old) return old;
        return old.map(report => {
          if (report.reportedUserId === uid && report.accusedProfile) {
            return {
              ...report,
              accusedProfile: { ...report.accusedProfile, disabled: false }
            };
          }
          return report;
        });
      });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}

export function useDismissReport() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (reportId: string) => {
      if (!user) throw new Error("Not authenticated");
      return dismissReport(reportId, user.uid);
    },
    onSuccess: (_, reportId) => {
      queryClient.setQueryData<EnrichedReport[]>(['reports'], (old) => {
        if (!old) return old;
        return old.map(report => {
          if (report.id === reportId) {
            return { ...report, dismissed: true };
          }
          return report;
        });
      });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
