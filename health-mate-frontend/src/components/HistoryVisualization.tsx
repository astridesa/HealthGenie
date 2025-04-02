import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SERVER_URL } from '@/constant/server';

interface HistoryItem {
  id: string;
  type: string;
  content: string;
  time: string;
}

interface HistoryVisualizationProps {
  localHistory: HistoryItem[];
  setLocalHistory: (history: HistoryItem[]) => void;
  localUserId: string;
}

const fetchHistory = async (userId: string) => {
  const response = await fetch(`${SERVER_URL}/api/history?id=${userId}`);
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  const data = await response.json();
  return data.history;
};

const deleteLastHistory = async (userId: string) => {
  const response = await fetch(`${SERVER_URL}/api/history`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: userId,
      time: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  return response.json();
};

const applyHistory = async (userId: string) => {
  const response = await fetch(`${SERVER_URL}/api/history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: userId,
      type: 'apply',
      content: '',
      time: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  return response.json();
};

const HistoryVisualization: React.FC<HistoryVisualizationProps> = ({ localHistory, setLocalHistory, localUserId }) => {
  // Fetch history from server
  const { data: serverHistory } = useQuery({
    queryKey: ['history', localUserId],
    queryFn: () => fetchHistory(localUserId),
    enabled: !!localUserId,
  });

  // Update local history when server history changes
  useEffect(() => {
    if (serverHistory) {
      // Filter out any operations that are not include/exclude
      const filteredHistory = serverHistory
        .filter((item: HistoryItem) => 
          item.type === 'include' || item.type === 'exclude'
        )
        .map((item: HistoryItem) => ({
          ...item,
          time: new Date(item.time).toISOString()
        }));

      // Update local history with filtered operations
      setLocalHistory(filteredHistory);
    }
  }, [serverHistory, setLocalHistory]);

  // Map operations for display
  const operations = localHistory
    .filter((item: HistoryItem) => item.type === 'include' || item.type === 'exclude')
    .map((item: HistoryItem) => ({
      type: item.type,
      content: item.content,
      time: item.time
    }));

  const mutation = useMutation({
    mutationFn: () => deleteLastHistory(localUserId),
    onSuccess: () => {
      // Update local history after successful server response
      const newHistory = localHistory.filter((_, index) => index < localHistory.length - 1);
      setLocalHistory(newHistory);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => applyHistory(localUserId),
    onSuccess: () => {
      // Only clear visualization operations (include/exclude), keep chat sessions
      const chatSessions = localHistory.filter(item => 
        item.type === 'chat' || item.type === 'recommendation'
      );
      setLocalHistory(chatSessions);
    },
  });

  const handleCancel = () => {
    if (operations.length > 0) {
      mutation.mutate();
    }
  };

  const handleApply = () => {
    // Only clear visualization operations (include/exclude), keep chat sessions
    const chatSessions = localHistory.filter(item => 
      item.type === 'chat' || item.type === 'recommendation'
    );
    setLocalHistory(chatSessions);
    // Then trigger the mutation
    applyMutation.mutate();
  };

  return (
    <div className="h-full bg-white/95 backdrop-blur-sm border-t border-gray-200 flex flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-1.5 min-h-[100px]">
        <div className="flex flex-wrap gap-1.5">
          {operations.length === 0 ? (
            <div className="w-full text-center text-gray-500 text-sm py-4">
              Here is the operation record panel
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {operations.map((op, index) => (
                <motion.div
                  key={`${op.time}-${index}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center space-x-1.5 px-1.5 py-0.5"
                >
                  <span className={`px-1.5 py-0.5 rounded text-sm ${
                    op.type === 'include' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {op.type === 'include' ? 'Include' : 'Exclude'}
                  </span>
                  <span className="text-gray-700 text-sm">{op.content}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
      <div className="flex justify-between px-3 py-2 border-t border-gray-200 bg-white">
        <button
          onClick={handleCancel}
          disabled={mutation.isPending || operations.length === 0}
          className={`px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors shadow-sm ${
            (mutation.isPending || operations.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Cancel Last
        </button>
        <button
          onClick={handleApply}
          disabled={applyMutation.isPending || operations.length === 0}
          className={`px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors shadow-sm ${
            (applyMutation.isPending || operations.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          Apply
        </button>
      </div>
    </div>
  );
};

export default HistoryVisualization; 