import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, Database, Check, Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemePreference } from '@/hooks/useTheme';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Light', icon: Sun },
  { value: 'system' as const, label: 'System', icon: Monitor },
  { value: 'dark' as const, label: 'Dark', icon: Moon },
];

interface SettingsProps {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
}

export function Settings({ theme, setTheme }: SettingsProps) {
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Theme */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-50 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Sun className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            Theme
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Choose a display theme, or follow system preferences
          </p>
        </div>
        <div className="p-6">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  theme === value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Storage */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-50 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            Storage Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage local storage usage and cached data
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-600">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Preview Image Cache</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Tab preview images stored locally. Current usage:{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-200">{cacheSize}</span>
              </p>
            </div>

            <button
              onClick={handleClearCache}
              disabled={clearing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                cleared
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-100 dark:hover:border-red-800 shadow-sm'
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
