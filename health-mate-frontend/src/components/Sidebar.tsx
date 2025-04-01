import { useState } from "react";
import { Switch } from "@headlessui/react";
import ChatHistory from "./ChatHistory";
import Image from "next/image";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import { v4 as uuidv4 } from "uuid";

export default function Sidebar({
  userId,
  localHistory,
  setLocalHistory,
  setCurrentHistory,
}: any) {
  const [enabled, setEnabled] = useState(true);

  const handleNewSession = () => {
    const newHistory = {
      id: uuidv4(),
      title: "",
      time: new Date().toLocaleString("ja-JP", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false, // 使用24小时制
      }),
      chats: [],
    };

    const history = JSON.parse(localStorage.getItem("history") as string);
    localStorage.setItem("history", JSON.stringify([...history, newHistory]));
    setLocalHistory([...history, newHistory]);
  };

  return (
    <aside className="w-96 p-2 flex flex-col justify-start">
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
      <div className="mt-4 border border-[#efefef] rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-[#6d6d6d] font-semibold">History</h2>
          <button
            onClick={handleNewSession}
            className="px-4 py-2 text-sm bg-[#f9f5f9] text-[#6d6d6d] rounded-lg shadow-sm hover:bg-[#c084fc] transition-all border border-[#f3c4f4]"
          >
            new chat
          </button>
        </div>
        <ChatHistory
          localHistory={localHistory}
          setCurrentHistory={setCurrentHistory}
        />
      </div>

      <div className="mx-auto mt-4">
        <Image width={120} height={60} alt="smartor" src="/logo.jpg" />
      </div>
    </aside>
  );
}
