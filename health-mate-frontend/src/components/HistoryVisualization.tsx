import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SERVER_URL } from '@/constant/server';
import { ChatSession } from "../types/chat";
import { v4 as uuidv4 } from 'uuid';

interface HistoryItem {
  id: string;
  type: string;
  content: string;
  time: string;
}

interface HistoryVisualizationProps {
  localHistory: ChatSession[];
  setLocalHistory: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  localUserId: string;
  setChats: React.Dispatch<React.SetStateAction<any[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setVisData: React.Dispatch<React.SetStateAction<any>>;
  handleMentionNode: (nodes: any[], keywordNodes: any[]) => void;
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

const HistoryVisualization: React.FC<HistoryVisualizationProps> = ({ localHistory, setLocalHistory, localUserId, setChats, setIsLoading, setVisData, handleMentionNode }) => {
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
    mutationFn: async (history: ChatSession) => {
      const response = await fetch(`${SERVER_URL}/api/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(history),
      });
      if (!response.ok) {
        throw new Error('Failed to apply history');
      }
      return response.json();
    },
    onSuccess: () => {
      // Update local history after successful mutation
      setLocalHistory(prevHistory => prevHistory.filter(item => 
        item.type === 'chat' || item.type === 'recommendation'
      ));
    },
  });

  const handleCancel = () => {
    // Only trigger delete if there are include/exclude operations
    const hasIncludeExcludeOps = operations.some(op => op.type === 'include' || op.type === 'exclude');
    if (hasIncludeExcludeOps) {
      mutation.mutate();
    }
  };

  const handleApply = async () => {
    try {
      setIsLoading(true);

      // First call apply mutation
      await applyMutation.mutateAsync({
        id: localUserId,
        content: "apply",
        time: new Date().toISOString(),
        type: "apply",
        chats: []
      });

      // Then call include_exclude API
      const response = await fetch(`${SERVER_URL}/api/include_exclude`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: localUserId,
          operation: {
            include: operations
              .filter(op => op.type === 'include')
              .map(op => op.content),
            exclude: operations
              .filter(op => op.type === 'exclude')
              .map(op => op.content)
          }
        })
      });

      const data = await response.json();
      
      if (data.finalAnswer) {
        // Add the final answer to the chatbox
        setChats(prevChats => [...prevChats, {
          id: uuidv4(),
          from: 'bot',
          content: data.finalAnswer,
          time: new Date().toISOString()
        }]);

        // Handle knowledge graph data if available
        if (data.knowledgeGraph) {
          // Create unique IDs for nodes
          const nodeMap = new Map<string, number>();
          let nextId = 1;

          // Helper function to get or create node ID
          const getNodeId = (name: string) => {
            if (!nodeMap.has(name)) {
              nodeMap.set(name, nextId++);
            }
            return nodeMap.get(name)!;
          };

          // Create nodes from unique subjects and objects
          const uniqueNodes = new Set([...data.knowledgeGraph.subject, ...data.knowledgeGraph.object]);
          const nodes = Array.from(uniqueNodes).map(name => {
            const id = getNodeId(name);
            // Find the category from the backend data
            let category = data.knowledgeGraph.cat?.[data.knowledgeGraph.object.indexOf(name)];
            
            // If category is not found, determine it based on the name
            if (!category) {
              if (name.includes('食谱的功效')) {
                category = 'Health Benefit';
              } else if (name.includes('食谱') || name.includes('菜谱')) {
                category = 'menu';
              } else {
                category = 'menu'; // Default category
              }
            } else if (category === '食谱的功效') {
              category = 'Health Benefit';
            }
            
            return {
              id,
              name,
              chinese: name,
              category,
              isShared: false,
              // Add random initial positions to help with force layout
              x: Math.random() * 500,
              y: Math.random() * 500
            };
          });

          // Create links from the triples
          const links = data.knowledgeGraph.subject.map((subject: string, index: number) => {
            const sourceId = getNodeId(subject);
            const targetId = getNodeId(data.knowledgeGraph.object[index]);
            return {
              source: sourceId,
              target: targetId,
              relation: data.knowledgeGraph.relation[index],
              isShared: false,
              index
            };
          });

          // Update visualization data
          setVisData({ nodes: [], links: [] }); // Clear existing data
          setTimeout(() => {
            setVisData({ nodes, links });
          }, 50);

          // Update mentioned nodes for highlighting
          const mentionedNodeIds = nodes.map(node => node.id);
          handleMentionNode(nodes, mentionedNodeIds);
        }

        // Clear visualization operations after successful API calls
        setLocalHistory(prevHistory => 
          prevHistory.filter(item => item.type === 'chat' || item.type === 'recommendation')
        );
      }

    } catch (error) {
      console.error('Error in handleApply:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-white/95 backdrop-blur-sm border-t border-gray-200 flex flex-col">
      <div className="flex-1 overflow-y-auto px-3 py-1.5 min-h-[100px]">
        <div className="flex flex-wrap gap-1.5">
          {operations.length === 0 ? (
            <div className="w-full text-center text-gray-500 text-sm py-4">
              Here is the interaction record panel
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