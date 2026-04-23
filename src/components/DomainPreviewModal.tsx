import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Globe, Monitor, ExternalLink, Images } from 'lucide-react';
import { DomainGroup } from '@/utils/grouping';
import { TabInfo } from '@/utils/tabs';
import { useDomainPreviews } from '@/hooks/useDomainPreviews';

interface DomainPreviewModalProps {
  group: DomainGroup;
  onClose: () => void;
  onJumpToTab: (tab: TabInfo) => void;
  onCloseTab: (tabId: number) => void;
}

interface PreviewCardProps {
  tab: TabInfo;
  preview: string | null;
  previewLoading: boolean;
  onJump: () => void;
  onClose: () => void;
  isClosing: boolean;
}

const PreviewCard = ({ tab, preview, previewLoading, onJump, onClose, isClosing }: PreviewCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer ${isClosing ? 'archive-delete-fade pointer-events-none' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onJump}
    >
      {/* Thumbnail area — 16:9 ratio */}
      <div className="relative aspect-video w-full bg-gray-50">
        {previewLoading ? (
          <div className="absolute inset-0 bg-gray-100 animate-pulse" />
        ) : preview ? (
          <img
            src={preview}
            alt={tab.title}
            className="absolute inset-0 w-full h-full object-cover bg-gray-50"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 border-b border-gray-100">
            <Monitor className="w-8 h-8 mb-1" />
            <span className="text-xs">No preview</span>
            <span className="text-[10px] mt-0.5 opacity-70">Activate tab to generate preview</span>
          </div>
        )}

        {/* Hover overlay with action buttons */}
        {isHovered && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-3">
            <button
              onClick={(e) => { e.stopPropagation(); onJump(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors shadow"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Switch to Tab
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1.5 bg-white/90 hover:bg-white text-red-500 rounded-lg transition-colors shadow"
              title="Close tab"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active tab badge */}
        {tab.active && (
          <div className="absolute top-2 left-2">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded-full shadow">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Active
            </span>
          </div>
        )}
      </div>

      {/* Tab info below thumbnail */}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug" title={tab.title}>
          {tab.title}
        </p>
        <p className="text-xs text-gray-400 mt-1 truncate" title={tab.url}>
          {tab.url}
        </p>
      </div>
    </div>
  );
};

const EmptyState = ({ hasSearch }: { hasSearch: boolean }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400">
    <Images className="w-12 h-12 mb-3 opacity-40" />
    {hasSearch ? (
      <>
        <p className="font-medium">No matching tabs found</p>
        <p className="text-sm mt-1">Try a different search term</p>
      </>
    ) : (
      <p className="font-medium">No tabs in this domain</p>
    )}
  </div>
);

export const DomainPreviewModal = ({ group, onClose, onJumpToTab, onCloseTab }: DomainPreviewModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [closingTabIds, setClosingTabIds] = useState<Record<number, true>>({});

  const urls = useMemo(() => group.tabs.map(t => t.url), [group.tabs]);
  const { previews, loading } = useDomainPreviews(urls);

  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return group.tabs;
    const q = searchQuery.toLowerCase();
    return group.tabs.filter(
      t => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)
    );
  }, [group.tabs, searchQuery]);

  /** Closes a tab with the same fade-out motion used across the dashboard. */
  const requestCloseTab = (tabId: number) => {
    if (closingTabIds[tabId]) return;
    setClosingTabIds(prev => ({ ...prev, [tabId]: true }));
    window.setTimeout(() => {
      try {
        onCloseTab(tabId);
      } finally {
        setClosingTabIds(prev => {
          if (!prev[tabId]) return prev;
          const next = { ...prev };
          delete next[tabId];
          return next;
        });
      }
    }, 420);
  };

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[80vw] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {group.favicon ? (
              <img src={group.favicon} alt="" className="w-5 h-5" />
            ) : (
              <Globe className="w-5 h-5 text-gray-400" />
            )}
            <h2 className="text-lg font-bold text-gray-900">{group.domain}</h2>
            <span className="text-sm text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
              {group.tabs.length} {group.tabs.length === 1 ? 'tab' : 'tabs'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 py-3 border-b border-gray-50 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tabs in this domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Grid body — scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredTabs.length === 0 ? (
            <div className="grid">
              <EmptyState hasSearch={!!searchQuery.trim()} />
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTabs.map(tab => (
                <PreviewCard
                  key={tab.id}
                  tab={tab}
                  preview={previews[tab.url] ?? null}
                  previewLoading={loading}
                  onJump={() => onJumpToTab(tab)}
                  onClose={() => tab.id && requestCloseTab(tab.id)}
                  isClosing={!!(tab.id && closingTabIds[tab.id])}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
