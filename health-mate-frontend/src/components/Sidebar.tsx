import { useState } from "react";
import { Switch } from "@headlessui/react";
import ChatHistory from "./ChatHistory";
import Image from "next/image";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { v4 as uuidv4 } from "uuid";
import { SERVER_URL } from "../constant/server";
import AddIcon from "@mui/icons-material/Add";
import { ChatSession } from "../types/chat";

interface SidebarProps {
  userId: string;
  localHistory: ChatSession[];
  setLocalHistory: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  setCurrentHistory: (id: string) => void;
  onClearVisualization: () => void;
}

export default function Sidebar({
  userId,
  localHistory,
  setLocalHistory,
  setCurrentHistory,
  onClearVisualization,
}: SidebarProps) {
  const [enabled, setEnabled] = useState(true);

  const handleNewSession = async () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      type: "chat",
      content: "New chat session",
      time: new Date().toISOString(),
      chats: []
    };
    
    // Write the new session to history file
    try {
      const response = await fetch(`${SERVER_URL}/api/history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newSession,
          id: userId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to write history");
      }
    } catch (error) {
      console.error("Error writing history:", error);
    }
    
    // Add the new session to existing history instead of replacing it
    setLocalHistory((prevHistory: ChatSession[]) => {
      // Filter out all non-chat operations (include/exclude/cancel/apply)
      const chatSessions = prevHistory.filter(item => 
        item.type === "chat" || item.type === "recommendation"
      );
      return [...chatSessions, newSession];
    });
    setCurrentHistory(newSession.id);
    onClearVisualization();
  };

  return (
    <aside className="w-96 p-2 flex flex-col h-full">
      <div className="flex flex-col flex-1">
        {/* 登录按钮 */}
        <div className="bg-[#f9f5f9] py-4 px-1 rounded-xl flex flex-col items-center space-x-3 border border-[#f3c4f4]">
          <div className="flex flex-row justify-start items-start w-full">
            <div className="w-8 h-8 bg-[#f3c4f4] flex flex-row mr-2 mb-4 items-center justify-center rounded-full">
              <AccountCircleIcon />
            </div>
            <span className="text-[#7c7a7c] font-semibold leading-8">
              user-{userId}
            </span>
          </div>
        </div>

        {/* 历史记录 */}
        <div className="mt-4 border border-[#efefef] rounded-xl p-4 flex-1">
          <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 py-2">
            <h2 className="text-[#bf8ac1] font-semibold">Chat History</h2>
            <button
              onClick={handleNewSession}
              className="p-2 text-white rounded-lg hover:bg-[#a67aa8] transition-all flex items-center gap-2 bg-[#bf8ac1] font-medium shadow-lg"
              title="New chat"
            >
              <AddIcon fontSize="small" />
              <span className="text-base">New Chat</span>
            </button>
          </div>
          <ChatHistory
            localHistory={localHistory}
            setCurrentHistory={setCurrentHistory}
            localUserId={userId}
            setLocalHistory={setLocalHistory}
          />
        </div>
      </div>

      {/* Logo at the bottom */}
      <div className="mt-auto pt-4 flex justify-center">
        <Image width={120} height={60} alt="smartor" src="/logo.jpg" />
      </div>
    </aside>
  );
}
