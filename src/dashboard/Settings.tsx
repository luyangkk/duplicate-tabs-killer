import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Database, Check } from 'lucide-react';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function Settings() {
  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  const calculateCacheSize = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        setCacheSize(formatBytes(bytes));
      });
    } else {
      setCacheSize('Unknown');
    }
  }, []);

  useEffect(() => {
    calculateCacheSize();
  }, [calculateCacheSize]);

  const handleClearCache = () => {
    setClearing(true);
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      // Get all keys
      chrome.storage.local.get(null, (items) => {
        const keysToRemove = Object.keys(items).filter(key => key.startsWith('preview_'));
        
        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove, () => {
            setClearing(false);
            setCleared(true);
            calculateCacheSize();
            setTimeout(() => setCleared(false), 3000);
          });
        } else {
            setClearing(false);
            setCleared(true);
            setTimeout(() => setCleared(false), 3000);
        }
      });
    } else {
      setTimeout(() => {
        setClearing(false);
        setCleared(true);
        setTimeout(() => setCleared(false), 3000);
      }, 1000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" />
            Storage Settings
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage local storage usage and cached data
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div>
              <h3 className="font-medium text-gray-900">Preview Image Cache</h3>
              <p className="text-sm text-gray-500 mt-1">
                Tab preview images stored locally. Current usage: <span className="font-semibold text-gray-700">{cacheSize}</span>
              </p>
            </div>
            
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                cleared 
                  ? 'bg-green-100 text-green-700'
                  : 'bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-100 shadow-sm'
              }`}
            >
              {clearing ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : cleared ? (
                <Check className="w-4 h-4" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              {clearing ? 'Clearing...' : cleared ? 'Cleared!' : 'Clear Cache'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
