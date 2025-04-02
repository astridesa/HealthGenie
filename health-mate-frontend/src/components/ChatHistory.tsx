import React from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import { useMutation } from "@tanstack/react-query";
import { SERVER_URL } from "../constant/server";

interface ChatHistoryProps {
  localHistory: any[];
  setCurrentHistory: (id: string) => void;
  localUserId: string;
  setLocalHistory: (history: any[]) => void;
  onNewChat: () => void;
}

const ChatHistory = ({ localHistory, setCurrentHistory, localUserId, setLocalHistory, onNewChat }: ChatHistoryProps) => {
  const handleClick = (id: string) => {
    setCurrentHistory(id);
  };

  const deleteMutation = useMutation({
    mutationFn: async (historyId: string) => {
      const response = await fetch(`${SERVER_URL}/api/history`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: localUserId,
          time: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete chat history");
      }

      return response.json();
    },
    onSuccess: (_, historyId) => {
      const updatedHistory = localHistory.filter((item: any) => item.time !== historyId);
      setLocalHistory(updatedHistory);
    },
  });

  const handleDelete = (e: React.MouseEvent, time: string) => {
    e.stopPropagation();
    deleteMutation.mutate(time);
  };

  // Filter out operation history (include/exclude/cancel/apply)
  const chatHistory = localHistory.filter((history: any) => 
    history.type === "chat" || history.type === "recommendation"
  );

  return (
    <div className="flex flex-col h-full">
      <ul className="space-y-4 text-sm text-gray-700 flex-1 overflow-y-auto">
        {chatHistory.length > 0 &&
          chatHistory.map((history: any, index: any) => (
            <li
              key={history.time}
              className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md cursor-pointer transition duration-200 relative group"
              onClick={() => handleClick(history.id)}
            >
              <div className="text-xs text-[#a6a6a6]">{history.time}</div>
              <div className="text-[#292929] font-semibold line-clamp-3">
                {history.content}
              </div>
              <button
                onClick={(e) => handleDelete(e, history.time)}
                className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                title="Delete chat"
              >
                <DeleteIcon fontSize="small" />
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
};

export default ChatHistory;
