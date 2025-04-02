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
  setVisData: (data: any) => void;
  currentHistory: string;
  localHistory: any[];
  setLocalHistory: (history: any[]) => void;
  localUserId: string;
}

const includeRecipe = async ({ nodeName, type, localUserId, localHistory, setLocalHistory }: any) => {
  try {
    // Send the include/exclude operation to server
    const response = await fetch(`${SERVER_URL}/api/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: localUserId,
        content: nodeName,
        type: type,
        time: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update history');
    }

    // Only update local history if the server request was successful
    const newHistory = [...localHistory];
    newHistory.push({
      id: localUserId,
      content: nodeName,
      type: type,
      time: new Date().toISOString(),
    });
    setLocalHistory(newHistory);
  } catch (error) {
    console.error('Error updating history:', error);
  }
};

const NodeTooltip = ({
  x,
  y,
  title,
  content,
  setTooltipProps,
  setVisData,
  currentHistory,
  localHistory,
  setLocalHistory,
  localUserId,
}: TooltipProps) => {
  const mutation = useMutation({
    mutationFn: includeRecipe,
    onSuccess: () => {
      // Close tooltip after successful operation
      setTooltipProps(null);
    },
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
          onClick={() => mutation.mutate({ nodeName: title, type: "include", localUserId, localHistory, setLocalHistory })}
          className="w-full py-1 my-1 text-sm bg-[#f9f5f9] text-[#6d6d6d] rounded-lg shadow-sm hover:bg-[#c084fc] transition-all border border-[#f3c4f4]"
          disabled={mutation.isPending}
        >
          Include
        </button>
        <button
          onClick={() => mutation.mutate({ nodeName: title, type: "exclude", localUserId, localHistory, setLocalHistory })}
          className="w-full py-1 my-1 text-sm bg-[#f9f5f9] text-[#6d6d6d] rounded-lg shadow-sm hover:bg-[#c084fc] transition-all border border-[#f3c4f4]"
          disabled={mutation.isPending}
        >
          Exclude
        </button>
      </div>
    </div>
  );
};

export default NodeTooltip;
