'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStats, getScrapeRuns, getSources, triggerScrape, getScrapeStatus } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { Loader2, Database, Activity, Server, Clock, Play, RefreshCw } from 'lucide-react';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [scrapeTriggered, setScrapeTriggered] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: scrapeTriggered ? 10000 : false,
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['scrape-runs'],
    queryFn: () => getScrapeRuns(10),
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
    // Small delay to let final stats update
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
      queryClient.invalidateQueries({ queryKey: ['scrape-status'] });
      queryClient.invalidateQueries({ queryKey: ['scrape-runs'] });
    } catch (err: any) {
      if (err?.message?.includes('409')) {
        setScrapeTriggered(true);
      }
    }
  };

  const isLoading = statsLoading || runsLoading || sourcesLoading;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <button
            onClick={handleRunScrape}
            disabled={isRunning}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRunning
                ? 'bg-yellow-100 text-yellow-700 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Scrapers
              </>
            )}
          </button>
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {stats && (
          <>
            {/* Stats cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <StatCard
                icon={<Database className="w-5 h-5 text-blue-600" />}
                label="Total Listings"
                value={stats.total}
              />
              <StatCard
                icon={<Activity className="w-5 h-5 text-green-600" />}
                label="Active Listings"
                value={stats.active}
              />
              <StatCard
                icon={<Server className="w-5 h-5 text-purple-600" />}
                label="Sources"
                value={Object.keys(stats.bySource).length}
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
                <h2 className="font-semibold mb-3">Recent Scrape Runs</h2>
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
                      {runs.map((run) => (
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
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
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
