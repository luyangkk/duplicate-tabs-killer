import React, { useState, useMemo } from 'react';
import { useTabs } from '@/hooks/useTabs';
import { useArchives } from '@/hooks/useArchives';
import { groupTabsByDomain } from '@/utils/grouping';
import { LayoutGrid, Archive as ArchiveIcon, Search, Globe, Trash2, RotateCcw, Plus, X } from 'lucide-react';
import { TabInfo } from '@/utils/tabs';

function App() {
  const { tabs, loading: tabsLoading, removeTab } = useTabs();
  const { archives, loading: archivesLoading, addArchive, removeArchive, restore } = useArchives();
  
  const [activeTab, setActiveTab] = useState<'current' | 'archives'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveName, setArchiveName] = useState('');

  const domainGroups = useMemo(() => {
    const filteredTabs = tabs.filter(t => 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.url.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return groupTabsByDomain(filteredTabs);
  }, [tabs, searchQuery]);

  const filteredArchives = useMemo(() => {
    return archives.filter(a => 
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [archives, searchQuery]);

  const handleCreateArchive = async () => {
    if (!archiveName.trim()) return;
    await addArchive(archiveName, tabs);
    setArchiveName('');
    setIsArchiveModalOpen(false);
    setActiveTab('archives');
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
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-20">
        <div className="p-6 border-b border-gray-100">
            <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
                <LayoutGrid className="w-6 h-6" />
                Tab Killer
            </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
            <button
                onClick={() => setActiveTab('current')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'current' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
                <LayoutGrid className="w-5 h-5" />
                Current Tabs
                <span className="ml-auto bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {tabs.length}
                </span>
            </button>
            <button
                onClick={() => setActiveTab('archives')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'archives' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
                <ArchiveIcon className="w-5 h-5" />
                Archives
                <span className="ml-auto bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {archives.length}
                </span>
            </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">
                    {activeTab === 'current' ? 'Current Session' : 'Saved Archives'}
                </h2>
                
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                        />
                    </div>
                    
                    {activeTab === 'current' && (
                        <button
                            onClick={() => setIsArchiveModalOpen(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <ArchiveIcon className="w-4 h-4" />
                            Archive Session
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            {activeTab === 'current' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tabsLoading ? (
                        <p className="text-gray-500">Loading tabs...</p>
                    ) : domainGroups.map((group) => (
                        <div key={group.domain} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-50 bg-gray-50 flex justify-between items-center">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {group.favicon ? (
                                        <img src={group.favicon} alt="" className="w-4 h-4" />
                                    ) : (
                                        <Globe className="w-4 h-4 text-gray-400" />
                                    )}
                                    <h3 className="font-semibold text-gray-800 truncate" title={group.domain}>
                                        {group.domain}
                                    </h3>
                                </div>
                                <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-100">
                                    {group.tabs.length}
                                </span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-2">
                                {group.tabs.map(tab => (
                                    <div key={tab.id} className="p-2 hover:bg-gray-50 rounded group flex items-center justify-between gap-2 text-sm transition-colors">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                            <div 
                                                onClick={() => handleJumpToTab(tab)}
                                                className="text-gray-600 hover:text-blue-600 truncate cursor-pointer transition-colors"
                                                title={tab.title}
                                            >
                                                {tab.title}
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (removeTab) removeTab(tab.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1 rounded hover:bg-red-50 shrink-0"
                                            title="Close Tab"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {archivesLoading ? (
                        <p className="text-gray-500">Loading archives...</p>
                    ) : filteredArchives.length === 0 ? (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            No archives found.
                        </div>
                    ) : filteredArchives.map((archive) => (
                        <div key={archive.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg mb-1">{archive.name}</h3>
                                    <p className="text-xs text-gray-400">
                                        {new Date(archive.createdAt).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => restore(archive)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Restore Session"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => removeArchive(archive.id)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete Archive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex-1">
                                <div className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4 text-gray-400" />
                                    {archive.tabs.length} tabs total
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(archive.domainCount)
                                        .sort(([,a], [,b]) => b - a)
                                        .slice(0, 3)
                                        .map(([domain, count]) => (
                                            <span key={domain} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                {domain} ({count})
                                            </span>
                                        ))
                                    }
                                    {Object.keys(archive.domainCount).length > 3 && (
                                        <span className="text-xs text-gray-400 px-1 py-1">
                                            +{Object.keys(archive.domainCount).length - 3} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Archive Modal */}
      {isArchiveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Archive Current Session</h3>
                    <button onClick={() => setIsArchiveModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Session Name</label>
                    <input
                        type="text"
                        value={archiveName}
                        onChange={(e) => setArchiveName(e.target.value)}
                        placeholder="e.g., Research for Project X"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                    <p className="mt-2 text-sm text-gray-500">
                        This will save all {tabs.length} currently open tabs.
                    </p>
                </div>
                
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => setIsArchiveModalOpen(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
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
    </div>
  );
}

export default App;
