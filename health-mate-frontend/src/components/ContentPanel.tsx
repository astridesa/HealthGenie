import React, { useEffect, useRef, useState } from "react";
import ChatInput from "./ChatInput";
import ChatBox from "./ChatBox";
import { v4 as uuidv4 } from "uuid";
import LinearProgress from "@mui/material/LinearProgress";
import { useMutation } from "@tanstack/react-query";
import { SERVER_URL } from "../constant/server";
import Selector from "./Selector";

const sendRecommendationHistory = async (currentHistory: string, localUserId: string) => {
  try {
    console.log("Sending recommendation history with userId:", localUserId); // Debug log
    const response = await fetch(`${SERVER_URL}/api/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        id: localUserId,
        content: "Get personalized recommendation",
        type: "recommendation",
        time: new Date().toISOString(),
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

const sendQuestion = async ({ inputValue, clickedNode, history }: any) => {
  const response = await fetch(`${SERVER_URL}/api/question`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      question: `${inputValue}.`,
      clickedNode,
      history,
    }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  return response.json();
};

const ContentPanel = ({
  data,
  selectedId,
  handleMentionNode,
  setSelectedId,
  clickedNode,
  currentHistory,
  localHistory,
  setLocalHistory,
  chats,
  setChats,
  slideValue,
  showRelatedNode,
  cancel,
  setClickedNode,
  localUserId,
  recommendQuery,
  setRecommendQuery,
}: any) => {
  const scrollableChatBox = useRef(null);

  const [inputValue, setInputValue] = useState("");

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
    onSuccess: (successData) => {
      const { finalAnswer, searchResult, keywords } = successData;

      const answer = {
        from: "bot",
        content: finalAnswer,
        id: uuidv4(),
      };

      setChats([...chats, answer]);

      const localHistories = JSON.parse(
        localStorage.getItem("history") as string,
      );

      localHistories.forEach((local: any) => {
        if (local.id === currentHistory) {
          local.chats.push(answer);
        }
      });

      localStorage.setItem("history", JSON.stringify(localHistories));

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

      // targetIds.forEach((id: any) => {
      //   data.links.forEach((link: any) => {
      //     if (link.source.id === id) {
      //       targetIds.push(link.target.id);
      //     }
      //     if (link.target.id === id) {
      //       targetIds.push(link.source.id);
      //     }
      //   });
      // });

      const uniqueTargetIds = [...new Set(targetIds)];

      const mentionedNodes = data.nodes.filter((node: any) => {
        return uniqueTargetIds.includes(node.id);
      });

      handleMentionNode(mentionedNodes, keywordNodes);

      setUserInput("");
      setWaitingReponse(false);

      setSelectedId(-1);
      setClickedNode(null);
    },
    onError: (error) => {
      console.error("Error:", error);
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
    const history = {
      id: localUserId,
      type: "chat",
      content: userInput,
      time: new Date().toISOString(),
    };
    mutation.mutate({ inputValue: userInput, clickedNode, history });
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
            currentHistory={currentHistory}
            localHistory={localHistory}
            setLocalHistory={setLocalHistory}
            recommendQuery={recommendQuery}
            setRecommendQuery={setRecommendQuery}
          />
        </div>
      </div>
    </section>
  );
};

export default ContentPanel;
