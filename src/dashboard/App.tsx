import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTabs } from '@/hooks/useTabs';
import { useArchives } from '@/hooks/useArchives';
import { useArchivedTabs } from '@/hooks/useArchivedTabs';
import { useTabPreview } from '@/hooks/useTabPreview';
import { useTheme } from '@/hooks/useTheme';
import { Settings } from './Settings';
import { groupTabsByDomain, DomainGroup } from '@/utils/grouping';
import { LayoutGrid, Archive as ArchiveIcon, Search, Globe, Trash2, RotateCcw, X, Settings as SettingsIcon, Images, Copy, Loader2, Check } from 'lucide-react';
import { closeTabs, TabInfo } from '@/utils/tabs';
import { DomainPreviewModal } from '@/components/DomainPreviewModal';

/** Clamps a number within an inclusive range. */
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Renders a screenshot preview tooltip near a hovered tab item, avoiding viewport overflow. */
const PreviewTooltip = ({
  url,
  anchorRight,
  anchorTop,
  groupLeft,
}: {
  url: string | null;
  anchorRight: number;
  anchorTop: number;
  groupLeft: number;
}) => {
  const { preview, loading } = useTabPreview(url || undefined);

  if (!url) return null;

  const tooltipWidth = 272;
  const tooltipMaxWidth = 320;
  const offsetX = 20;
  const offsetY = 10;
  const viewportPadding = 8;

  const canPlaceOnRight = window.innerWidth - anchorRight >= tooltipWidth + offsetX + viewportPadding;
  const rawLeft = canPlaceOnRight ? anchorRight + offsetX : groupLeft - tooltipWidth - offsetX;
  const left = clamp(rawLeft, viewportPadding, Math.max(viewportPadding, window.innerWidth - tooltipWidth - viewportPadding));

  const style: React.CSSProperties = {
    left,
    top: anchorTop + offsetY,
    maxWidth: `${tooltipMaxWidth}px`,
  };

  if (anchorTop > window.innerHeight - 250) {
    style.top = 'auto';
    style.bottom = window.innerHeight - anchorTop + offsetY;
  }

  return (
    <div
        className="fixed z-50 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95"
        style={style}
    >
        {loading ? (
            <div className="w-64 h-40 bg-gray-100 dark:bg-gray-700 animate-pulse rounded flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                Loading...
            </div>
        ) : preview ? (
            <div className="space-y-2">
                <img src={preview} alt="Preview" className="w-64 h-auto rounded shadow-sm border border-gray-100 dark:border-gray-700 object-cover bg-gray-50 dark:bg-gray-700" />
            </div>
        ) : (
            <div className="w-64 h-32 bg-gray-50 dark:bg-gray-700 rounded flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 text-xs text-center p-4 border border-dashed border-gray-200 dark:border-gray-600">
                <Globe className="w-8 h-8 mb-2 opacity-50" />
                <span>No preview available yet</span>
                <span className="text-[10px] mt-1 opacity-75">Activate tab to generate preview</span>
            </div>
        )}
    </div>
  );
};

function App() {
  const { tabs, loading: tabsLoading, removeTab } = useTabs();
  const { archives, loading: archivesLoading, addArchive, removeArchive, restore } = useArchives();
  const { archivedTabs, archivedUrlSet, loading: archivedTabsLoading, archiveTab, removeArchivedTab, restoreTab } = useArchivedTabs();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'current' | 'archives' | 'settings'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveName, setArchiveName] = useState('');
  const [archiveTabs, setArchiveTabs] = useState<TabInfo[] | null>(null);
  const [archiveTitle, setArchiveTitle] = useState('');
  const [archiveContext, setArchiveContext] = useState<'session' | 'domain'>('session');
  const [frozenDomainOrder, setFrozenDomainOrder] = useState<string[] | null>(null);
  const [deletingArchiveIds, setDeletingArchiveIds] = useState<Record<string, true>>({});
  const [deletingArchivedTabIds, setDeletingArchivedTabIds] = useState<Record<string, true>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const successToastTimerRef = useRef<number | null>(null);

  const [hoveredTab, setHoveredTab] = useState<{ url: string, anchorRight: number, anchorTop: number, groupLeft: number } | null>(null);
  const [previewGroup, setPreviewGroup] = useState<DomainGroup | null>(null);
  const [archivingTabIds, setArchivingTabIds] = useState<Record<number, true>>({});
  const [closingTabIds, setClosingTabIds] = useState<Record<number, true>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const domainGroupsSorted = useMemo(() => {
    const filteredTabs = tabs.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.url.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return groupTabsByDomain(filteredTabs);
  }, [tabs, searchQuery]);

  /** Freezes current domain group order to prevent reordering during batch operations. */
  const freezeDomainOrderIfNeeded = () => {
    if (frozenDomainOrder) return;
    setFrozenDomainOrder(domainGroupsSorted.map(g => g.domain));
  };

  const displayDomainGroups = useMemo(() => {
    if (!frozenDomainOrder) return domainGroupsSorted;
    const orderIndex = new Map(frozenDomainOrder.map((d, i) => [d, i] as const));
    return [...domainGroupsSorted].sort((a, b) => {
      const ia = orderIndex.get(a.domain);
      const ib = orderIndex.get(b.domain);
      if (ia === undefined && ib === undefined) return 0;
      if (ia === undefined) return 1;
      if (ib === undefined) return -1;
      return ia - ib;
    });
  }, [domainGroupsSorted, frozenDomainOrder]);

  const maxDomainGroupTabs = useMemo(() => {
    if (domainGroupsSorted.length === 0) return 0;
    return Math.max(...domainGroupsSorted.map(g => g.tabs.length));
  }, [domainGroupsSorted]);

  /** Opens archive modal with a target tabs list and context. */
  const openArchiveModal = (nextArchiveTabs: TabInfo[], nextTitle: string, nextName: string, nextContext: 'session' | 'domain') => {
    setArchiveTabs(nextArchiveTabs);
    setArchiveTitle(nextTitle);
    setArchiveName(nextName);
    setArchiveContext(nextContext);
    setIsArchiveModalOpen(true);
  };

  /** Shows a transient success toast message. */
  const showSuccessToast = (message: string) => {
    if (successToastTimerRef.current) window.clearTimeout(successToastTimerRef.current);
    setSuccessToast(message);
    successToastTimerRef.current = window.setTimeout(() => {
      setSuccessToast(null);
      successToastTimerRef.current = null;
    }, 2200);
  };

  /** Closes tabs that were archived; intentionally keeps extension pages open. */
  const closeArchivedTabs = async (tabsToClose: TabInfo[]) => {
    const tabIdsToClose = tabsToClose
      .filter(t => typeof t.id === 'number' && !t.url?.startsWith('chrome-extension://'))
      .map(t => t.id);

    await closeTabs(tabIdsToClose);
  };

  /** Archives a single tab and then closes it after the fade-out animation. */
  const archiveSingleTab = async (tab: TabInfo) => {
    if (!tab.id) return;
    if (archivedUrlSet.has(tab.url)) return;

    freezeDomainOrderIfNeeded();

    setArchivingTabIds(prev => (prev[tab.id] ? prev : { ...prev, [tab.id]: true }));
    try {
      await archiveTab(tab);
      showSuccessToast(`Archived 1 tab`);
      window.setTimeout(async () => {
        await closeArchivedTabs([tab]);
        setArchivingTabIds(prev => {
          if (!prev[tab.id]) return prev;
          const next = { ...prev };
          delete next[tab.id];
          return next;
        });
      }, 420);
    } catch (error) {
      console.error('Failed to archive tab:', error);
      setArchivingTabIds(prev => {
        if (!prev[tab.id]) return prev;
        const next = { ...prev };
        delete next[tab.id];
        return next;
      });
    }
  };

  /** Closes a single tab with the same fade-out motion as archiving. */
  const closeSingleTabAnimated = async (tab: TabInfo) => {
    if (!tab.id) return;
    if (closingTabIds[tab.id]) return;

    freezeDomainOrderIfNeeded();

    setClosingTabIds(prev => ({ ...prev, [tab.id]: true }));
    window.setTimeout(async () => {
      try {
        if (removeTab) await removeTab(tab.id);
      } finally {
        setClosingTabIds(prev => {
          if (!prev[tab.id]) return prev;
          const next = { ...prev };
          delete next[tab.id];
          return next;
        });
      }
    }, 420);
  };

  /** Triggers a fade-out animation, then deletes the archive after the animation finishes. */
  const requestDeleteArchive = (archiveId: string) => {
    setDeletingArchiveIds(prev => (prev[archiveId] ? prev : { ...prev, [archiveId]: true }));

    window.setTimeout(async () => {
      try {
        await removeArchive(archiveId);
      } catch (error) {
        console.error('Failed to delete archive:', error);
      } finally {
        setDeletingArchiveIds(prev => {
          if (!prev[archiveId]) return prev;
          const next = { ...prev };
          delete next[archiveId];
          return next;
        });
      }
    }, 420);
  };

  /** Triggers a fade-out animation, then removes an archived single tab record. */
  const requestDeleteArchivedTab = (id: string) => {
    setDeletingArchivedTabIds(prev => (prev[id] ? prev : { ...prev, [id]: true }));

    window.setTimeout(async () => {
      try {
        await removeArchivedTab(id);
      } catch (error) {
        console.error('Failed to delete archived tab:', error);
      } finally {
        setDeletingArchivedTabIds(prev => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    }, 420);
  };

  const filteredArchives = useMemo(() => {
    return archives.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [archives, searchQuery]);

  const archivesCounts = useMemo(() => {
    const domains = new Set<string>();
    let tabsCount = 0;

    for (const archive of archives) {
      tabsCount += archive.tabs.length;
      const domainKeys = Object.keys(archive.domainCount ?? {});

      if (domainKeys.length > 0) {
        for (const domain of domainKeys) {
          if (domain && domain !== 'unknown') domains.add(domain);
        }
      } else {
        for (const tab of archive.tabs) {
          try {
            const domain = new URL(tab.url).hostname;
            if (domain && domain !== 'unknown') domains.add(domain);
          } catch {
            void 0;
          }
        }
      }
    }

    tabsCount += archivedTabs.length;

    return { domainsCount: domains.size, tabsCount };
  }, [archives, archivedTabs]);

  const filteredArchivedTabs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return archivedTabs;
    return archivedTabs.filter(t => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q));
  }, [archivedTabs, searchQuery]);

  const livePreviewGroup = useMemo(() => {
    if (!previewGroup) return null;
    return displayDomainGroups.find(g => g.domain === previewGroup.domain) ?? null;
  }, [previewGroup, displayDomainGroups]);

  useEffect(() => {
    if (previewGroup && !livePreviewGroup) setPreviewGroup(null);
  }, [previewGroup, livePreviewGroup]);

  useEffect(() => {
    return () => {
      if (successToastTimerRef.current) window.clearTimeout(successToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f';
      if (!isFindShortcut) return;
      if (activeTab === 'settings') return;
      if (isArchiveModalOpen || previewGroup) return;

      event.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, isArchiveModalOpen, previewGroup]);

  const handleCreateArchive = async () => {
    if (!archiveName.trim()) return;
    freezeDomainOrderIfNeeded();
    const tabsToArchive = archiveTabs ?? tabs;
    await addArchive(archiveName, tabsToArchive);
    await closeArchivedTabs(tabsToArchive);
    if (archiveContext === 'domain') {
      showSuccessToast(`Archived ${tabsToArchive.length} tabs from "${archiveName}"`);
    } else {
      showSuccessToast(`Archived "${archiveName}" (${tabsToArchive.length} tabs)`);
    }
    setArchiveName('');
    setArchiveTabs(null);
    setArchiveTitle('');
    setArchiveContext('session');
    setIsArchiveModalOpen(false);
  };

  const handleJumpToTab = async (tab: TabInfo) => {
    if (tab.id) {
        await chrome.tabs.update(tab.id, { active: true });
    }
    if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans">
      {successToast && (
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-lg rounded-xl px-4 py-2 text-sm text-gray-700 dark:text-gray-200 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col z-20">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700">
            <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
                <Copy className="w-6 h-6" />
                Tab Killer
            </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
            <button
                onClick={() => setActiveTab('current')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'current'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
                <LayoutGrid className="w-5 h-5" />
                Current Tabs
                <span className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full text-xs">
                    {tabs.length}
                </span>
            </button>
            <button
                onClick={() => setActiveTab('archives')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'archives'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
                <ArchiveIcon className="w-5 h-5" />
                Archives
                <span
                    className="ml-auto bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full text-xs"
                    title={`${archivesCounts.domainsCount} domains / ${archivesCounts.tabsCount} tabs`}
                >
                    {archivesCounts.domainsCount}/{archivesCounts.tabsCount}
                </span>
            </button>
            <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'settings'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
            >
                <SettingsIcon className="w-5 h-5" />
                Settings
            </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {activeTab === 'current' ? 'Current Session' : activeTab === 'archives' ? 'Saved Archives' : 'Settings'}
                </h2>

                {activeTab !== 'settings' && (
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key !== 'Escape') return;
                              if (!searchQuery.trim()) return;
                              e.preventDefault();
                              setSearchQuery('');
                            }}
                            ref={searchInputRef}
                            className="pl-10 pr-10 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        {searchQuery.trim().length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    searchInputRef.current?.focus();
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Clear"
                                aria-label="Clear"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {activeTab === 'current' && (
                        <button
                            onClick={() => openArchiveModal(tabs, 'Archive Current Session', '', 'session')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <ArchiveIcon className="w-4 h-4" />
                            Archive Session
                        </button>
                    )}
                </div>
                )}
            </div>

            {/* Content */}
            {activeTab === 'settings' ? (
                <Settings theme={theme} setTheme={setTheme} />
            ) : activeTab === 'current' ? (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 [column-fill:_balance]">
                    {tabsLoading ? (
                        <p className="text-gray-500 dark:text-gray-400">Loading tabs...</p>
                    ) : displayDomainGroups.map((group) => (
                        <div key={group.domain} data-domain-group={group.domain} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden mb-6 break-inside-avoid">
                            <div className="p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center">
                                <button
                                    type="button"
                                    onClick={() => setPreviewGroup(group)}
                                    className="flex items-center gap-2 overflow-hidden text-left hover:opacity-90 transition-opacity"
                                    title="View screenshot previews"
                                >
                                    {group.favicon ? (
                                        <img src={group.favicon} alt="" className="w-4 h-4" />
                                    ) : (
                                        <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                    )}
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate" title={group.domain}>
                                        {group.domain}
                                    </h3>
                                </button>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => openArchiveModal(group.tabs, 'Archive Domain', group.domain, 'domain')}
                                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="Archive this domain"
                                    >
                                        <ArchiveIcon className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => setPreviewGroup(group)}
                                        className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="View screenshot previews"
                                    >
                                        <Images className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-600">
                                        {group.tabs.length}
                                    </span>
                                </div>
                            </div>
                            <div
                                className={`overflow-y-auto p-2 ${group.tabs.length === maxDomainGroupTabs ? 'max-h-[calc(100vh-260px)]' : 'max-h-[360px]'}`}
                            >
                                {group.tabs.map(tab => (
                                    <div
                                        key={tab.id}
                                        className={`p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded group flex items-center justify-between gap-2 text-sm transition-colors relative ${(archivingTabIds[tab.id] || closingTabIds[tab.id]) ? 'archive-delete-fade' : ''}`}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const groupEl = e.currentTarget.closest<HTMLElement>('[data-domain-group]');
                                            const groupRect = groupEl?.getBoundingClientRect();
                                            setHoveredTab({
                                                url: tab.url,
                                                anchorRight: rect.right,
                                                anchorTop: rect.top,
                                                groupLeft: groupRect?.left ?? rect.left,
                                            });
                                        }}
                                        onMouseLeave={() => setHoveredTab(null)}
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                            <div
                                                onClick={() => handleJumpToTab(tab)}
                                                className="text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 truncate cursor-pointer transition-colors"
                                                title={tab.title}
                                            >
                                                {tab.title}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void archiveSingleTab(tab);
                                                }}
                                                className={`opacity-0 group-hover:opacity-100 transition-all p-1 rounded shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${archivedUrlSet.has(tab.url) ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' : 'text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                                                title={archivedUrlSet.has(tab.url) ? 'Archived' : 'Archive tab'}
                                                aria-label={archivedUrlSet.has(tab.url) ? 'Archived' : 'Archive tab'}
                                                disabled={archivedUrlSet.has(tab.url) || !!archivingTabIds[tab.id]}
                                            >
                                                {archivedUrlSet.has(tab.url) ? (
                                                    <Check className="w-3 h-3" />
                                                ) : (
                                                    <ArchiveIcon className="w-3 h-3" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void closeSingleTabAnimated(tab);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-500 hover:text-red-500 transition-all p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                title="Close Tab"
                                                aria-label="Close Tab"
                                                disabled={!!archivingTabIds[tab.id] || !!closingTabIds[tab.id]}
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="col-span-full">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Archived Domains</h3>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{archivesLoading ? '...' : filteredArchives.length}</span>
                        </div>
                    </div>
                    {archivesLoading ? (
                        <p className="text-gray-500 dark:text-gray-400">Loading archives...</p>
                    ) : filteredArchives.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
                            No archives found.
                        </div>
                    ) : filteredArchives.map((archive) => (
                        <div
                            key={archive.id}
                            data-archive-card={archive.id}
                            className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col h-full ${deletingArchiveIds[archive.id] ? 'archive-delete-fade pointer-events-none' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg mb-1">{archive.name}</h3>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        {new Date(archive.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => restore(archive)}
                                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Restore Session"
                                        disabled={!!deletingArchiveIds[archive.id]}
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => requestDeleteArchive(archive.id)}
                                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Delete Archive"
                                        disabled={!!deletingArchiveIds[archive.id]}
                                    >
                                        {deletingArchiveIds[archive.id] ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1">
                                <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                    {archive.tabs.length} tabs total
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(archive.domainCount)
                                        .sort(([,a], [,b]) => b - a)
                                        .slice(0, 3)
                                        .map(([domain, count]) => (
                                            <span key={domain} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded inline-flex items-center gap-1.5">
                                                {archive.domainFavicons?.[domain] ? (
                                                    <img src={archive.domainFavicons[domain]} alt="" className="w-3 h-3" />
                                                ) : (
                                                    <Globe className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                                                )}
                                                {domain} ({count})
                                            </span>
                                        ))
                                    }
                                    {Object.keys(archive.domainCount).length > 3 && (
                                        <span className="text-xs text-gray-400 dark:text-gray-500 px-1 py-1">
                                            +{Object.keys(archive.domainCount).length - 3} more
                                        </span>
                                    )}
                                </div>
                            </div>

                            {deletingArchiveIds[archive.id] && (
                                <div className="absolute inset-0 z-10 pointer-events-none">
                                    <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40" />
                                    <div className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-white/80 dark:bg-gray-800/80 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 shadow-sm border border-gray-100 dark:border-gray-700">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                                        Deleting…
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {archivedTabsLoading ? (
                        <p className="text-gray-500 dark:text-gray-400">Loading archived tabs...</p>
                    ) : filteredArchivedTabs.length === 0 ? null : (
                        <div className="col-span-full mt-2">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Archived Tabs</h3>
                                <span className="text-xs text-gray-400 dark:text-gray-500">{filteredArchivedTabs.length}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredArchivedTabs.map(t => (
                                    <div
                                        key={t.id}
                                        className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex flex-col ${deletingArchivedTabIds[t.id] ? 'archive-delete-fade pointer-events-none' : ''}`}
                                    >
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    {t.favIconUrl ? (
                                                        <img src={t.favIconUrl} alt="" className="w-4 h-4" />
                                                    ) : (
                                                        <Globe className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                                    )}
                                                    <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate" title={t.title}>{t.title}</p>
                                                </div>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 truncate" title={t.url}>{t.domain}</p>
                                            </div>
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => restoreTab(t)}
                                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                    title="Restore Tab"
                                                    aria-label="Restore Tab"
                                                    disabled={!!deletingArchivedTabIds[t.id]}
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => requestDeleteArchivedTab(t.id)}
                                                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                                    title="Delete Archived Tab"
                                                    aria-label="Delete Archived Tab"
                                                    disabled={!!deletingArchivedTabIds[t.id]}
                                                >
                                                    {deletingArchivedTabIds[t.id] ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 truncate" title={t.url}>{t.url}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Archive Modal */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{archiveTitle || 'Archive'}</h3>
                    <button
                        onClick={() => {
                            setIsArchiveModalOpen(false);
                            setArchiveTabs(null);
                            setArchiveTitle('');
                        }}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Session Name</label>
                    <input
                        type="text"
                        value={archiveName}
                        onChange={(e) => setArchiveName(e.target.value)}
                        placeholder="e.g., Research for Project X"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                        autoFocus
                    />
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        This will save {archiveTabs?.length ?? tabs.length} tabs.
                    </p>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => {
                            setIsArchiveModalOpen(false);
                            setArchiveTabs(null);
                            setArchiveTitle('');
                        }}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreateArchive}
                        disabled={!archiveName.trim()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Save Archive
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Tab Preview Tooltip */}
      {hoveredTab && (
          <PreviewTooltip
              url={hoveredTab.url}
              anchorRight={hoveredTab.anchorRight}
              anchorTop={hoveredTab.anchorTop}
              groupLeft={hoveredTab.groupLeft}
          />
      )}

      {/* Domain Screenshot Gallery Modal */}
      {livePreviewGroup && (
          <DomainPreviewModal
              group={livePreviewGroup}
              onClose={() => setPreviewGroup(null)}
              onJumpToTab={handleJumpToTab}
              onCloseTab={(tabId) => removeTab && removeTab(tabId)}
              onBeforeCloseTab={freezeDomainOrderIfNeeded}
          />
      )}
    </div>
  );
}

export default App;
