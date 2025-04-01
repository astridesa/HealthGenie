import React, { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";

const ChatInput = ({
  setChats,
  chats,
  waitingResponse,
  setWaitingReponse,
  userInput,
  setUserInput,
  clickedNode,
  isInputing,
  setIsInputing,
  autoCompleteResponse,
  setAutoCompleteResponse,
  currentHistory,
  localHistory,
  setLocalHistory,
  setRecommendQuery,
  recommendQuery,
}: any) => {
  const chatBotInput = useRef(null);

  const inputing = (value: any) => {
    setUserInput(value);
  };

  // const autoCompleteChat = () => {
  //   if (
  //     clickedNode &&
  //     chats.length > 0 &&
  //     chats[chats.length - 1].from !== "auto-complete"
  //   ) {
  //     setChats([
  //       ...chats,
  //       {
  //         from: "auto-complete",
  //         content: clickedNode.name,
  //         id: uuidv4(),
  //       },
  //     ]);
  //   }
  // };

  const sendChat = () => {
    const question = {
      from: "user",
      content: userInput,
      id: uuidv4(),
    };
    setChats([
      ...chats.filter(
        (chat: any) =>
          chat.from !== "auto-complete" && chat.from !== "slidebar",
      ),
      question,
    ]);

    setWaitingReponse(true);
    setAutoCompleteResponse(null);
    const localHistories = JSON.parse(
      localStorage.getItem("history") as string,
    );

    localHistories.forEach((local: any) => {
      if (local.id === currentHistory) {
        local.chats.push(question);

        if (local.chats.length < 2) {
          local.title = question.content;
        }
      }
    });

    const copylocalHistory = [...localHistory];

    copylocalHistory.forEach((c: any) => {
      if (c.id === currentHistory && c.chats.length < 2) {
        c.title = question.content;
        return;
      }
    });
    setLocalHistory(copylocalHistory);

    localStorage.setItem("history", JSON.stringify(localHistories));
  };

  const handleKeyDown = (event: any) => {
    if (isInputing) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      // Handle Enter key press (e.g., send message)
      sendChat();
      // Perform your action here, e.g., submit the form or send a message
    } else if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      // Handle Shift + Enter key press (e.g., insert newline)
      setUserInput(`${userInput}\n`);
    }
  };

  return (
    <div className="flex flex-col items-end border border-[rgb(229, 231, 235)] rounded-[10px] bg-gradient-to-tr from-neutral-50 to-neutral-200">
      <textarea
        placeholder={
          waitingResponse
            ? "Waiting for response..."
            : "Ask question to chat bot"
        }
        className="border-0 block w-full resize-none bg-transparent outline-none focus:outline-none box-border p-4 text-black min-h-24"
        ref={chatBotInput}
        onInput={(event) => {
          if (recommendQuery) {
            inputing(recommendQuery);
            setRecommendQuery("");
          } else {
            inputing((event.target as any).value);
          }

          // autoCompleteChat();
        }}
        value={userInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          setIsInputing(true);
          // autoCompleteChat();
        }}
        onCompositionEnd={() => setIsInputing(false)}
      />

      <div className="flex flex-row items-center">
        <button
          className="px-4 py-2 h-10 text-base bg-[#bf8ac1] font-medium border border-gray-300 rounded-xl shadow-lg flex items-center m-2"
          onClick={sendChat}
          disabled={waitingResponse}
        >
          {/* 按钮文本 */}
          <span className="mr-2">Send</span>

          {/* 后面的图标 */}
          <Image width={20} height={20} alt="send" src="/send.png" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
