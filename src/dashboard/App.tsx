import React, { useState, useMemo, useEffect } from 'react';
import { useTabs } from '@/hooks/useTabs';
import { useArchives } from '@/hooks/useArchives';
import { useTabPreview } from '@/hooks/useTabPreview';
import { Settings } from './Settings';
import { groupTabsByDomain, DomainGroup } from '@/utils/grouping';
import { LayoutGrid, Archive as ArchiveIcon, Search, Globe, Trash2, RotateCcw, Plus, X, Settings as SettingsIcon, Images, Copy } from 'lucide-react';
import { TabInfo } from '@/utils/tabs';
import { DomainPreviewModal } from '@/components/DomainPreviewModal';

const PreviewTooltip = ({ url, x, y }: { url: string | null, x: number, y: number }) => {
  const { preview, loading } = useTabPreview(url || undefined);
  
  if (!url) return null;

  // Calculate position to keep within viewport
  // Simple check to prevent overflow on right/bottom
  const style: React.CSSProperties = {
      left: x + 20,
      top: y + 10,
      maxWidth: '320px'
  };

  // Adjust if too close to right edge
  if (x > window.innerWidth - 350) {
      style.left = 'auto';
      style.right = window.innerWidth - x + 20;
  }
  
  // Adjust if too close to bottom
  if (y > window.innerHeight - 250) {
      style.top = 'auto';
      style.bottom = window.innerHeight - y + 10;
  }

  return (
    <div 
        className="fixed z-50 bg-white p-2 rounded-lg shadow-xl border border-gray-200 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95"
        style={style}
    >
        {loading ? (
            <div className="w-64 h-40 bg-gray-100 animate-pulse rounded flex items-center justify-center text-gray-400 text-sm">
                Loading...
            </div>
        ) : preview ? (
            <div className="space-y-2">
                <img src={preview} alt="Preview" className="w-64 h-auto rounded shadow-sm border border-gray-100 object-cover bg-gray-50" />
            </div>
        ) : (
            <div className="w-64 h-32 bg-gray-50 rounded flex flex-col items-center justify-center text-gray-400 text-xs text-center p-4 border border-dashed border-gray-200">
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
  
  const [activeTab, setActiveTab] = useState<'current' | 'archives' | 'settings'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archiveName, setArchiveName] = useState('');
  
  const [hoveredTab, setHoveredTab] = useState<{ url: string, x: number, y: number } | null>(null);
  const [previewGroup, setPreviewGroup] = useState<DomainGroup | null>(null);

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

  const livePreviewGroup = useMemo(() => {
    if (!previewGroup) return null;
    return domainGroups.find(g => g.domain === previewGroup.domain) ?? null;
  }, [previewGroup, domainGroups]);

  useEffect(() => {
    if (previewGroup && !livePreviewGroup) setPreviewGroup(null);
  }, [previewGroup, livePreviewGroup]);

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
                <Copy className="w-6 h-6" />
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
            <button
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'settings' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'text-gray-600 hover:bg-gray-100'
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
                <h2 className="text-2xl font-bold text-gray-900">
                    {activeTab === 'current' ? 'Current Session' : activeTab === 'archives' ? 'Saved Archives' : 'Settings'}
                </h2>
                
                {activeTab !== 'settings' && (
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
                )}
            </div>

            {/* Content */}
            {activeTab === 'settings' ? (
                <Settings />
            ) : activeTab === 'current' ? (
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
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => setPreviewGroup(group)}
                                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        title="View screenshot previews"
                                    >
                                        <Images className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-medium text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-100">
                                        {group.tabs.length}
                                    </span>
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto p-2">
                                {group.tabs.map(tab => (
                                    <div 
                                        key={tab.id} 
                                        className="p-2 hover:bg-gray-50 rounded group flex items-center justify-between gap-2 text-sm transition-colors relative"
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setHoveredTab({
                                                url: tab.url,
                                                x: rect.right,
                                                y: rect.top
                                            });
                                        }}
                                        onMouseLeave={() => setHoveredTab(null)}
                                    >
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

      {/* Tab Preview Tooltip */}
      {hoveredTab && (
          <PreviewTooltip
              url={hoveredTab.url}
              x={hoveredTab.x}
              y={hoveredTab.y}
          />
      )}

      {/* Domain Screenshot Gallery Modal */}
      {livePreviewGroup && (
          <DomainPreviewModal
              group={livePreviewGroup}
              onClose={() => setPreviewGroup(null)}
              onJumpToTab={handleJumpToTab}
              onCloseTab={(tabId) => removeTab && removeTab(tabId)}
          />
      )}
    </div>
  );
}

export default App;
