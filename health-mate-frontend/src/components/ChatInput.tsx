import React, { useRef } from "react";
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
  setRecommendQuery,
  recommendQuery,
  userId,
}: any) => {
  const chatBotInput = useRef(null);

  const inputing = (value: any) => {
    setUserInput(value);
  };

  const sendChat = () => {
    if (!userInput.trim()) return;
    
    const question = {
      from: "user",
      content: userInput,
      id: uuidv4(),
      userId: userId,
    };
    
    // Simply append the new chat message without filtering
    setChats([...chats, question]);
    setWaitingReponse(true);
    setAutoCompleteResponse(null);
  };

  const handleKeyDown = (event: any) => {
    if (isInputing) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChat();
    } else if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
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
        }}
        value={userInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => {
          setIsInputing(true);
        }}
        onCompositionEnd={() => setIsInputing(false)}
      />

      <div className="flex flex-row items-center">
        <button
          className="px-4 py-2 h-10 text-base bg-[#bf8ac1] font-medium border border-gray-300 rounded-xl shadow-lg flex items-center m-2"
          onClick={sendChat}
          disabled={waitingResponse || !userInput.trim()}
        >
          <span className="mr-2">Send</span>
          <Image width={20} height={20} alt="send" src="/send.png" />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
