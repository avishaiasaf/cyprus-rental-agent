'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  type WebhookSubscription,
} from '@/lib/api';
import { Navbar } from '@/components/navbar';
import {
  Loader2,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react';

export default function WebhooksPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: webhooks, isLoading, error } = useQuery({
    queryKey: ['webhooks'],
    queryFn: getWebhooks,
  });

  const toggleMutation = useMutation({
    mutationFn: (wh: WebhookSubscription) =>
      updateWebhook(wh.id, { is_active: !wh.is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Webhook
          </button>
        </div>

        {showCreate && (
          <CreateWebhookForm
            onCreated={() => {
              setShowCreate(false);
              queryClient.invalidateQueries({ queryKey: ['webhooks'] });
            }}
          />
        )}

        {isLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-red-500">
            Failed to load webhooks.
          </div>
        )}

        {webhooks && webhooks.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            No webhooks configured yet.
          </div>
        )}

        {webhooks && webhooks.length > 0 && (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">
                        {wh.name || 'Unnamed'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          wh.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {wh.is_active ? 'Active' : 'Disabled'}
                      </span>
                      {wh.failure_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-amber-600">
                          <AlertCircle className="w-3 h-3" />
                          {wh.failure_count} failures
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate mb-1">
                      {wh.url}
                    </div>
                    {Object.keys(wh.filters).length > 0 && (
                      <div className="text-xs text-gray-400">
                        Filters: {JSON.stringify(wh.filters)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleMutation.mutate(wh)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title={wh.is_active ? 'Disable' : 'Enable'}
                    >
                      {wh.is_active ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this webhook?')) {
                          deleteMutation.mutate(wh.id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CreateWebhookForm({ onCreated }: { onCreated: () => void }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [filtersJson, setFiltersJson] = useState('{}');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      let filters: Record<string, unknown> = {};
      try {
        filters = JSON.parse(filtersJson);
      } catch {
        throw new Error('Invalid JSON in filters');
      }
      return createWebhook({ url, name, filters });
    },
    onSuccess: onCreated,
    onError: (err) => setError(err.message),
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <h2 className="font-semibold mb-3">Create Webhook</h2>
      <div className="space-y-3">
        <input
          type="text"
          placeholder="Webhook name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <input
          type="url"
          placeholder="https://example.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          required
        />
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            Filters (JSON) - e.g. {`{"listing_type":"rent","district":"limassol"}`}
          </label>
          <textarea
            value={filtersJson}
            onChange={(e) => setFiltersJson(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
            rows={3}
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={() => mutation.mutate()}
            disabled={!url || mutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
          <button
            onClick={onCreated}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
