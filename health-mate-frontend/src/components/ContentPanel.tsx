import React, { useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import ChatBox from "./ChatBox";
import { v4 as uuidv4 } from "uuid";
import LinearProgress from "@mui/material/LinearProgress";
import { useMutation } from "@tanstack/react-query";
import { SERVER_URL } from "../constant/server";
import Selector from "./Selector";
import { ChatSession } from "../types/chat";

interface HistoryItem {
  id: string;
  type: string;
  content: string;
  time: string;
}

interface ContentPanelProps {
  data: any;
  selectedId: string | null;
  localHistory: ChatSession[];
  setLocalHistory: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  chats: any[];
  setChats: (chats: any[]) => void;
  slideValue: number;
  recommendQuery: string;
  setRecommendQuery: (query: string) => void;
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  handleMentionNode: (nodes: any[], keywordNodes: any[]) => void;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  clickedNode: any;
  currentHistory: string;
  showRelatedNode: (node: any) => void;
  cancel: () => void;
  setClickedNode: React.Dispatch<React.SetStateAction<any>>;
  localUserId: string;
}

const sendRecommendationHistory = async (currentHistory: string, localUserId: string) => {
  try {
    console.log("Sending recommendation request with userId:", localUserId); // Debug log
    const response = await fetch(`${SERVER_URL}/api/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        nodeName: currentHistory,
        type: "recommendation"
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Server error:", errorData); // Error log
      throw new Error(`Network response was not ok: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    console.log("Server response:", data); // Debug log
    return data;
  } catch (error) {
    console.error("Error in sendRecommendationHistory:", error); // Error log
    throw error;
  }
};

const sendQuestion = async ({ inputValue, clickedNode }: any) => {
  try {
    console.log("Sending question:", { inputValue, clickedNode }); // Debug log
    console.log("Server URL:", SERVER_URL); // Log the server URL being used
    
    const response = await fetch(`${SERVER_URL}/api/question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        question: inputValue,
        clickedNode,
      }),
    });

    console.log("Response status:", response.status); // Log response status
    console.log("Response headers:", Object.fromEntries(response.headers.entries())); // Log response headers

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Server error details:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
        responseText: await response.text() // Get raw response text as fallback
      });
      throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Server response:", data); // Debug log
    return data;
  } catch (error: any) {
    console.error("Error in sendQuestion:", {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause
    });
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error("Network error: Unable to connect to the server. Please check your connection.");
    }
    throw error;
  }
};

const writeChatToHistory = async (content: string, type: string, localUserId: string) => {
  try {
    const response = await fetch(`${SERVER_URL}/api/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: localUserId,
        type: type,
        content: content,
        time: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to write chat history");
    }
  } catch (error) {
    console.error("Error writing chat history:", error);
  }
};

const ContentPanel: React.FC<ContentPanelProps> = ({
  data,
  selectedId,
  localHistory,
  setLocalHistory,
  chats = [],
  setChats,
  slideValue,
  recommendQuery,
  setRecommendQuery,
  onSendMessage,
  isLoading,
  handleMentionNode,
  setSelectedId,
  clickedNode,
  currentHistory,
  showRelatedNode,
  cancel,
  setClickedNode,
  localUserId,
}) => {
  const [inputValue, setInputValue] = useState("");
  const scrollableChatBox = useRef<HTMLDivElement>(null);

  const [isInputing, setIsInputing] = useState(false);

  const [waitingResponse, setWaitingReponse] = useState(false);

  const [userInput, setUserInput] = useState("");

  const [autoCompleteResponse, setAutoCompleteResponse] = useState<
    "accept" | "reject" | null
  >(null);

  useEffect(() => {
    if (scrollableChatBox.current) {
      const lastChatBox = (scrollableChatBox.current as HTMLElement)
        .lastElementChild;
      if (lastChatBox) {
        lastChatBox.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [chats]);

  const mutation = useMutation({
    mutationFn: sendQuestion,
    onSuccess: async (successData) => {
      const { finalAnswer, searchResult, keywords } = successData;

      const answer = {
        from: "bot",
        content: finalAnswer,
        id: uuidv4(),
      };

      setChats([...chats, answer]);

      // Write both user message and bot response to history
      await writeChatToHistory(userInput, "chat", localUserId);
      await writeChatToHistory(finalAnswer, "chat", localUserId);

      const targetIds = data.nodes
        .filter((node: any) => {
          return keywords.some(
            (keyword: string) =>
              keyword.includes(node.chinese) || node.chinese.includes(keyword),
          );
        })
        .map((n: any) => n.id);

      const keywordNodes = [...targetIds];

      targetIds.forEach((id: any) => {
        data.links.forEach((link: any) => {
          if (link.source.id === id) {
            targetIds.push(link.target.id);
          }
          if (link.target.id === id) {
            targetIds.push(link.source.id);
          }
        });
      });

      const uniqueTargetIds = [...new Set(targetIds)];

      const mentionedNodes = data.nodes.filter((node: any) => {
        return uniqueTargetIds.includes(node.id);
      });

      handleMentionNode(mentionedNodes, keywordNodes);

      setUserInput("");
      setWaitingReponse(false);

      setSelectedId(null);
      setClickedNode(null);
    },
    onError: async (error: any) => {
      console.error("Error:", error);
      // Add error message to chat
      const errorMessage = {
        from: "bot",
        content: `Sorry, I encountered an error: ${error.message || "Unknown error occurred"}`,
        id: uuidv4(),
      };
      setChats([...chats, errorMessage]);
      
      // Write both user message and error response to history
      await writeChatToHistory(userInput, "chat", localUserId);
      await writeChatToHistory(errorMessage.content, "chat", localUserId);
      
      setWaitingReponse(false);
      setUserInput("");
    },
  });

  useEffect(() => {
    if (!waitingResponse) {
      if (scrollableChatBox.current) {
        const lastChatBox = (scrollableChatBox.current as HTMLElement)
          .lastElementChild;
        if (lastChatBox) {
          lastChatBox.scrollIntoView({ behavior: "smooth" });
        }
      }
      return;
    }

    sendQuestionToBot();
    if (scrollableChatBox.current) {
      (scrollableChatBox.current as HTMLElement).scrollTop = (
        scrollableChatBox.current as HTMLElement
      ).scrollHeight;
    }
  }, [waitingResponse]);

  const sendQuestionToBot = async () => {
    if (!userInput.trim()) return;
    mutation.mutate({ inputValue: userInput, clickedNode });
  };

  useEffect(() => {
    const relevantNode = data.nodes.find((node: any) => node.id === selectedId);
    setInputValue(relevantNode?.name ?? "");
  }, [selectedId]);

  const handleRecommendationClick = async () => {
    try {
      await sendRecommendationHistory(currentHistory, localUserId);
      // Add any additional recommendation logic here
    } catch (error) {
      console.error("Error recording recommendation:", error);
    }
  };

  return (
    <section className="mx-5 p-5 w-3/5 text-white border border-gray-300 rounded-lg shadow-lg ml-2.5 overflow-auto">
      <div className="flex flex-row items-center w-full">
        <span className="text-black font-bold ml-4">AI Chat</span>
      </div>
      <hr className="my-1 bg-[#d1b5d5]" />
      <div className="m-2.5 rounded-lg">
        <div className="flex flex-col justify-between pb-4 h-[calc(100vh-346px)]">
          {chats.length !== 0 ? (
            <div
              ref={scrollableChatBox}
              className="h-[calc(100vh-346px)] overflow-auto"
            >
              {chats.map((chat: any) => (
                <ChatBox
                  key={chat.id}
                  chat={chat}
                  autoCompleteResponse={autoCompleteResponse}
                  setAutoCompleteResponse={setAutoCompleteResponse}
                  setUserInput={setUserInput}
                  slideValue={slideValue}
                  showRelatedNode={showRelatedNode}
                  cancel={cancel}
                />
              ))}
              {waitingResponse ? <LinearProgress /> : null}
            </div>
          ) : (
            <div
              ref={scrollableChatBox}
              className="h-[calc(100vh-346px)] overflow-auto"
            >
              <div className="text-gray-500 text-center font-bold">
                What can I do for you?
              </div>
            </div>
          )}
        </div>
        <div className="border border-[#f6f0f6] p-4 rounded-xl flex flex-col">
          <div className="text-[#8d8d8d] my-1 flex flex-row items-center">
            <div className="min-w-48 mb-2 mr-4">
              <button
                onClick={handleRecommendationClick}
                className="w-full px-4 py-2 text-left text-md font-base border border-white rounded-lg bg-[#bf8ac1] shadow-lg focus:outline-none hover:bg-[#a67ba3] flex items-center justify-between"
              >
                <span className="text-white">Recommendation</span>
              </button>
            </div>
            <Selector
              options={[
                {
                  value: "GPT-4o mini",
                  label: "GPT-4o mini",
                  image: "/gpt.png",
                },
                {
                  value: "Deepseek V3",
                  label: "Deepseek V3",
                  image: "/deepseek.png",
                },
                {
                  value: "Claude 3.5Haiku",
                  label: "Claude 3.5Haiku",
                  image: "/claude.png",
                },
                {
                  value: "LLaMA 3.2 90b",
                  label: "LLaMA 3.2 90b",
                  image: "/llama.png",
                },
              ]}
            />
          </div>
          <ChatInput
            setChats={setChats}
            chats={chats}
            waitingResponse={waitingResponse}
            setWaitingReponse={setWaitingReponse}
            userInput={userInput}
            setUserInput={setUserInput}
            clickedNode={clickedNode}
            isInputing={isInputing}
            setIsInputing={setIsInputing}
            autoCompleteResponse={autoCompleteResponse}
            setAutoCompleteResponse={setAutoCompleteResponse}
            recommendQuery={recommendQuery}
            setRecommendQuery={setRecommendQuery}
          />
        </div>
      </div>
      <button
        onClick={() => setSelectedId(null)}
        className="text-gray-500 hover:text-gray-700"
      >
        Close
      </button>
    </section>
  );
};

export default ContentPanel;
