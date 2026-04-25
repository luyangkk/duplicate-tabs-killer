import React from 'react';
import { useTabs } from '@/hooks/useTabs';
import { useTheme } from '@/hooks/useTheme';
import { TabInfo } from '@/utils/tabs';
import { Trash2, Copy, LayoutDashboard, ExternalLink } from 'lucide-react';

function App() {
  const { tabs, duplicates, loading, closeDuplicateTabs, closeDuplicateGroup } = useTabs();
  useTheme();

  const totalDuplicates = duplicates.reduce((acc, group) => acc + group.tabs.length - 1, 0);

  /** Opens dashboard: focus existing dashboard tab or create a new one. */
  const handleOpenDashboard = async () => {
    void chrome.runtime.sendMessage({ type: 'OPEN_DASHBOARD' }).catch(async () => {
      try {
        await chrome.runtime.openOptionsPage();
      } catch {
        const dashboardUrl = chrome.runtime.getURL('src/dashboard/index.html');
        await chrome.tabs.create({ url: dashboardUrl });
      }
    });

    window.setTimeout(() => window.close(), 0);
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
    <div className="w-[400px] h-[600px] bg-gray-50 dark:bg-gray-900 flex flex-col font-sans text-gray-800 dark:text-gray-100">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm px-6 py-4 flex justify-between items-center z-10">
        <h1 className="text-lg font-bold text-blue-600 flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Tab Killer
        </h1>
        <button
            onClick={handleOpenDashboard}
            className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Open Dashboard"
        >
            <LayoutDashboard className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 flex flex-col items-center justify-center border border-gray-100 dark:border-gray-700 shrink-0">
            {loading ? (
                <div className="animate-pulse flex flex-col items-center w-full">
                    <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-3"></div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
            ) : (
                <>
                    <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">
                        {duplicates.length > 0 ? totalDuplicates : 0}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">Duplicate Tabs Found</div>

                    {duplicates.length > 0 ? (
                        <button
                            onClick={closeDuplicateTabs}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm active:transform active:scale-95"
                        >
                            <Trash2 className="w-4 h-4" />
                            Close All Duplicates
                        </button>
                    ) : (
                        <div className="text-green-500 font-medium flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-full text-sm">
                            ✨ All Clean!
                        </div>
                    )}
                </>
            )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 shrink-0">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Tabs</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{tabs.length}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Groups</div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">{duplicates.length}</div>
            </div>
        </div>

        {/* Duplicate List Preview */}
        {duplicates.length > 0 && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 shrink-0">Duplicate Details</h3>
                <div className="overflow-y-auto flex-1 pr-1 space-y-3 pb-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                    {duplicates.map((group) => (
                        <div key={group.url} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-sm shadow-sm hover:shadow-md transition-shadow">
                            <div className="font-medium text-gray-800 dark:text-gray-100 truncate mb-1" title={group.tabs[0].title}>
                                {group.tabs[0].title}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate mb-2" title={group.url}>
                                {group.url}
                            </div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-xs font-medium">
                                    {group.tabs.length} copies
                                </span>
                                <button
                                    onClick={() => closeDuplicateGroup(group)}
                                    className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    title="Close duplicate tabs in this group"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-1">
                                {group.tabs.map((tab) => (
                                    <div
                                        key={tab.id}
                                        onClick={() => handleJumpToTab(tab)}
                                        className="flex justify-between items-center text-xs p-1.5 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-colors group/item cursor-pointer"
                                        title="Click to jump to tab"
                                    >
                                        <span className={`truncate ${tab.active ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                            Tab #{tab.id}
                                        </span>
                                        <div className="text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all opacity-0 group-hover/item:opacity-100">
                                            <ExternalLink className="w-3 h-3" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;
