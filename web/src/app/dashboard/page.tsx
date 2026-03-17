'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStats, getScrapeRuns, getSources, triggerScrape, stopScrape, getScrapeStatus } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Loader2, Database, Activity, Server, Clock, Play, Square, RefreshCw, MinusCircle } from 'lucide-react';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [scrapeTriggered, setScrapeTriggered] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sourceFilter, setSourceFilter] = useState('');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: scrapeTriggered ? 10000 : false,
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['scrape-runs'],
    queryFn: () => getScrapeRuns(20),
    refetchInterval: scrapeTriggered ? 5000 : false,
  });

  const { data: sources, isLoading: sourcesLoading } = useQuery({
    queryKey: ['sources'],
    queryFn: getSources,
    refetchInterval: scrapeTriggered ? 10000 : false,
  });

  const { data: scrapeStatus } = useQuery({
    queryKey: ['scrape-status'],
    queryFn: getScrapeStatus,
    refetchInterval: scrapeTriggered ? 3000 : 15000,
  });

  const isRunning = scrapeStatus?.running ?? false;

  // Auto-stop polling when scrape completes
  if (scrapeTriggered && !isRunning) {
    setTimeout(() => {
      setScrapeTriggered(false);
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['scrape-runs'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    }, 2000);
  }

  const handleRunScrape = async () => {
    try {
      await triggerScrape();
      setScrapeTriggered(true);
      setShowConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['scrape-status'] });
      queryClient.invalidateQueries({ queryKey: ['scrape-runs'] });
    } catch (err: any) {
      if (err?.message?.includes('409')) {
        setScrapeTriggered(true);
      }
      setShowConfirm(false);
    }
  };

  const handleStopScrape = async () => {
    try {
      await stopScrape();
      setScrapeTriggered(false);
      queryClient.invalidateQueries({ queryKey: ['scrape-status'] });
      queryClient.invalidateQueries({ queryKey: ['scrape-runs'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    } catch {
      // ignore
    }
  };

  // Filter runs by source
  const filteredRuns = useMemo(() => {
    if (!runs) return [];
    if (!sourceFilter) return runs;
    return runs.filter((r) => (r.source ?? 'all') === sourceFilter);
  }, [runs, sourceFilter]);

  // Get unique sources from runs
  const runSources = useMemo(() => {
    if (!runs) return [];
    const set = new Set(runs.map((r) => r.source ?? 'all'));
    return Array.from(set).sort();
  }, [runs]);

  const isLoading = statsLoading || runsLoading || sourcesLoading;

  const inactiveCount = stats ? stats.total - stats.active : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main id="main-content" className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <>
                <span className="flex items-center gap-2 px-3 py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Scraping...
                </span>
                <button
                  onClick={handleStopScrape}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <Play className="w-4 h-4" />
                Run Scrapers
              </button>
            )}
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {stats && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={<Database className="w-5 h-5 text-blue-600" />}
                label="Total Listings"
                value={stats.total}
                tooltip="All listings ever scraped, including inactive"
              />
              <StatCard
                icon={<Activity className="w-5 h-5 text-green-600" />}
                label="Active Listings"
                value={stats.active}
                tooltip="Listings seen in the last scrape cycle"
              />
              <StatCard
                icon={<MinusCircle className="w-5 h-5 text-gray-500" />}
                label="Inactive"
                value={inactiveCount}
                tooltip="Listings no longer found in recent scrapes"
              />
              <StatCard
                icon={<Server className="w-5 h-5 text-purple-600" />}
                label="Sources"
                value={Object.keys(stats.bySource).length}
                tooltip="Number of active data sources"
              />
            </div>

            {/* Source health */}
            {sources && sources.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-8">
                <h2 className="font-semibold mb-3">Sources</h2>
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div
                      key={source.name}
                      className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-sm font-medium">{source.name}</span>
                      <span className="text-sm text-gray-500">
                        {source.active_listings} active listings
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent scrape runs */}
            {runs && runs.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold">Recent Scrape Runs</h2>
                  <div className="flex items-center gap-2">
                    <label htmlFor="source-filter" className="sr-only">Filter by source</label>
                    <select
                      id="source-filter"
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="px-2 py-1 border border-gray-300 rounded text-xs bg-white"
                    >
                      <option value="">All sources</option>
                      {runSources.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-2 font-medium">Started</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Source</th>
                        <th className="pb-2 font-medium">New</th>
                        <th className="pb-2 font-medium">Updated</th>
                        <th className="pb-2 font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRuns.map((run) => (
                        <tr key={run.id} className="border-b border-gray-50">
                          <td className="py-2 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-gray-400" />
                            {new Date(run.started_at).toLocaleString()}
                          </td>
                          <td className="py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                run.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : run.status === 'failed'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {run.status}
                            </span>
                          </td>
                          <td className="py-2">{run.source ?? 'all'}</td>
                          <td className="py-2">{run.new_listings}</td>
                          <td className="py-2">{run.updated_listings}</td>
                          <td className="py-2">{run.errors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      <ConfirmDialog
        open={showConfirm}
        title="Run Scrapers"
        message="Are you sure you want to run all scrapers? This may take several minutes."
        confirmLabel="Run Scrapers"
        onConfirm={handleRunScrape}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tooltip?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4" title={tooltip}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <div className="text-2xl font-bold">{value.toLocaleString()}</div>
          <div className="text-sm text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
