import { useState } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { ExternalLink, ShieldAlert, CheckCircle2, UserX, UserCheck, AlertTriangle } from 'lucide-react';
import { useReports, useDisableUser, useEnableUser, useDismissReport } from '@/hooks/use-reports';
import { firestoreUserConsoleUrl } from '@/lib/firestoreAdmin';
import { EnrichedReport } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function Reports() {
  const { data: reports, isLoading, error } = useReports();
  const [filter, setFilter] = useState<'pending' | 'reviewed' | 'all'>('pending');

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border rounded-lg shadow-sm text-center">
        <AlertTriangle className="w-10 h-10 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Failed to load reports</h2>
        <p className="text-muted-foreground">{error instanceof Error ? error.message : "Unknown error occurred"}</p>
      </div>
    );
  }

  const filteredReports = reports?.filter(r => {
    if (filter === 'pending') return !r.dismissed;
    if (filter === 'reviewed') return r.dismissed;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moderation Queue</h1>
          <p className="text-muted-foreground mt-1">Review flagged users and content. Actions taken here are immediate.</p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pending">Pending Review</TabsTrigger>
          <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
          <TabsTrigger value="all">All Reports</TabsTrigger>
        </TabsList>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <ReportSkeleton key={i} />)
          ) : filteredReports?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-card border rounded-lg text-center shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <h3 className="text-lg font-medium">No reports found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {filter === 'pending' ? "The moderation queue is clear. Good job!" : "Try changing your filter."}
              </p>
            </div>
          ) : (
            filteredReports?.map(report => (
              <ReportCard key={report.id} report={report} />
            ))
          )}
        </div>
      </Tabs>
    </div>
  );
}

function ReportCard({ report }: { report: EnrichedReport }) {
  const disableMutation = useDisableUser();
  const enableMutation = useEnableUser();
  const dismissMutation = useDismissReport();
  const { toast } = useToast();
  
  const [isExpanded, setIsExpanded] = useState(false);
  
  const isAccusedDisabled = report.accusedProfile?.disabled;
  const isDismissed = report.dismissed;

  const handleDisable = async () => {
    try {
      await disableMutation.mutateAsync(report.reportedUserId);
      toast({ title: 'User disabled', description: 'The accused user has been disabled.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to disable user.', variant: 'destructive' });
    }
  };

  const handleEnable = async () => {
    try {
      await enableMutation.mutateAsync(report.reportedUserId);
      toast({ title: 'User enabled', description: 'The accused user has been re-enabled.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to enable user.', variant: 'destructive' });
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissMutation.mutateAsync(report.id);
      toast({ title: 'Report dismissed', description: 'The report was marked as reviewed.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to dismiss report.', variant: 'destructive' });
    }
  };

  return (
    <Card className={`overflow-hidden transition-colors ${isDismissed ? 'opacity-80 bg-muted/30' : ''}`}>
      <div className="flex flex-col md:flex-row">
        {/* Left sidebar: Status and Meta */}
        <div className="bg-muted/50 p-4 md:w-64 border-b md:border-b-0 md:border-r flex flex-col gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Status</div>
            {isDismissed ? (
              <Badge variant="secondary" className="bg-secondary/50">Reviewed</Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20">Pending Review</Badge>
            )}
          </div>
          
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Reported</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-sm font-medium cursor-default">
                  {formatDistanceToNow(report.createdAtMs, { addSuffix: true })}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {format(report.createdAtMs, 'PPpp')}
              </TooltipContent>
            </Tooltip>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">Reporter</div>
            <div className="text-sm font-medium">{report.reporterProfile?.name || "Unknown"}</div>
            <div className="text-xs text-muted-foreground font-mono truncate" title={report.reporterId}>
              {report.reporterId}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted-foreground">Accused User</span>
                  {isAccusedDisabled && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">DISABLED</Badge>
                  )}
                </div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {report.accusedProfile?.name || "Unknown User"}
                  {report.accusedProfile?.role && (
                    <Badge variant="outline" className="font-normal text-xs capitalize">
                      {report.accusedProfile.role}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="font-mono text-xs mt-1">
                  {report.reportedUserId}
                </CardDescription>
              </div>
              <a 
                href={firestoreUserConsoleUrl(report.reportedUserId)} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-sm bg-muted/50 px-2 py-1 rounded-md"
              >
                <span>Console</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1">
            <div className="bg-destructive/5 border border-destructive/10 rounded-md p-4">
              <div className="font-semibold text-destructive mb-2 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                {report.reason}
              </div>
              
              {report.message && (
                <div className="text-sm text-foreground/80 whitespace-pre-wrap">
                  {isExpanded || report.message.length < 150 
                    ? report.message 
                    : `${report.message.slice(0, 150)}...`}
                  
                  {report.message.length >= 150 && (
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-primary text-xs font-medium ml-2 hover:underline focus:outline-none"
                    >
                      {isExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="border-t bg-muted/10 pt-4 flex flex-wrap gap-3 justify-end">
            {!isDismissed && (
              <Button 
                variant="outline" 
                onClick={handleDismiss}
                disabled={dismissMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Dismiss Report
              </Button>
            )}
            
            {isAccusedDisabled ? (
              <Button 
                variant="outline"
                className="text-amber-600 border-amber-600/30 hover:bg-amber-500/10 hover:text-amber-700"
                onClick={handleEnable}
                disabled={enableMutation.isPending}
              >
                <UserCheck className="w-4 h-4 mr-2" />
                Re-enable Account
              </Button>
            ) : (
              <Button 
                variant="destructive"
                onClick={handleDisable}
                disabled={disableMutation.isPending}
              >
                <UserX className="w-4 h-4 mr-2" />
                Disable Account
              </Button>
            )}
          </CardFooter>
        </div>
      </div>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <div className="bg-muted/50 p-4 md:w-64 border-b md:border-b-0 md:border-r space-y-4">
          <Skeleton className="h-4 w-16 mb-2" />
          <Skeleton className="h-6 w-24" />
          <div className="pt-2">
            <Skeleton className="h-4 w-16 mb-2" />
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
        <div className="flex-1 p-6 flex flex-col justify-between space-y-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </Card>
  );
}
