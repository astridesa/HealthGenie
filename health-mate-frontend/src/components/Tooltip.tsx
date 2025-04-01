import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation } from "@tanstack/react-query";
import { SERVER_URL } from "@/constant/server";
import { v4 as uuidv4 } from "uuid";

interface TooltipProps {
  x: number;
  y: number;
  title: string;
  content: string;
  setTooltipProps: (props: any) => void;
  setChats: (chats: any) => void;
  setRecommendQuery: (query: string) => void;
  setVisData: (data: any) => void;
  currentHistory: string;
  localHistory: any[];
  setLocalHistory: (history: any[]) => void;
}

const includeRecipe = async ({ nodeName, type, currentHistory }: any) => {
  // First send the include/exclude information to history
  await fetch(`${SERVER_URL}/api/history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: currentHistory,
      content: nodeName,
      type: type,
      time: new Date().toISOString(),
    }),
  });

  // Then make the recommend API call
  console.log("Sending request to /api/recommend with:", { nodeName, type });
  const response = await fetch(`${SERVER_URL}/api/recommend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nodeName,
      type,
    }),
  });
  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  const data = await response.json();
  console.log("Received response:", data);
  return data;
};

const NodeTooltip = ({
  x,
  y,
  title,
  content,
  setTooltipProps,
  setChats,
  setRecommendQuery,
  setVisData,
  currentHistory,
  localHistory,
  setLocalHistory,
}: TooltipProps) => {
  const mutation = useMutation({
    mutationFn: includeRecipe,
    onSuccess: (successData) => {
      const { finalAnswer, recommendQuery, nodes, links } = successData;
      
      // Add new chat message
      const newChat = {
        from: "bot",
        content: finalAnswer,
        id: uuidv4(),
      };
      
      setChats((prevChats: any) => [...prevChats, newChat]);
      
      // Update recommend query
      setRecommendQuery(recommendQuery);
      
      // Update visualization
      if (nodes && links) {
        setVisData({ nodes, links });
      }
      
      // Update history in localStorage
      const updatedHistory = localHistory.map((history: any) => {
        if (history.id === currentHistory) {
          return {
            ...history,
            chats: [...history.chats, newChat],
          };
        }
        return history;
      });
      
      setLocalHistory(updatedHistory);
      localStorage.setItem("history", JSON.stringify(updatedHistory));
      
      // Close tooltip
      setTooltipProps(null);
    },
    onError: (error) => {
      console.error("Mutation error:", error);
    }
  });
  return (
    <div
      className="absolute bg-white shadow-lg rounded-xs w-48 border border-[#f3c4f4] rounded-lg flex flex-col items-center z-50 p-3"
      style={{
        left: `${x + 20}px`,
        top: `${y}px`,
      }}
    >
      <div className="font-bold w-full relative mb-2">
        <p>{title}</p>
        <CloseIcon
          className="hover:cursor-pointer absolute -right-2 -top-2"
          onClick={() => setTooltipProps(null)}
          sx={{ color: "red" }}
        />
      </div>
      <div className="text-sm w-full">
        Do you want a new recipe that <em className="font-bold">include</em>{" "}
        {content} or <em className="font-bold">exclude</em> {content}
      </div>
      <div className="flex flex-col items-center w-full">
        <button
          onClick={() => mutation.mutate({ nodeName: title, type: "include", currentHistory })}
          className="w-full py-1 my-1 text-sm bg-[#f9f5f9] text-[#6d6d6d] rounded-lg shadow-sm hover:bg-[#c084fc] transition-all border border-[#f3c4f4]"
        >
          Include
        </button>
        <button
          onClick={() => mutation.mutate({ nodeName: title, type: "exclude", currentHistory })}
          className="w-full py-1 my-1 text-sm bg-[#f9f5f9] text-[#6d6d6d] rounded-lg shadow-sm hover:bg-[#c084fc] transition-all border border-[#f3c4f4]"
        >
          Exclude
        </button>
      </div>
    </div>
  );
};

export default NodeTooltip;
