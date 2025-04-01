import React from "react";

const ChatHistory = ({ localHistory, setCurrentHistory }: any) => {
  const handleClick = (id: string) => {
    setCurrentHistory(id);
  };

  return (
    <ul className="space-y-4 text-sm text-gray-700 h-[450px] overflow-auto">
      {localHistory.length > 0 &&
        localHistory.map((history: any, index: any) => (
          <li
            key={history.time}
            className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md cursor-pointer transition duration-200"
            onClick={() => handleClick(history.id)}
          >
            <div className="text-xs text-[#a6a6a6]">{history.time}</div>
            <div className="text-[#292929] font-semibold line-clamp-3">
              {history.title ? history.title : `History ${history.id}`}
            </div>
          </li>
        ))}
    </ul>
  );
};

export default ChatHistory;
