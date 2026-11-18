import React, { useState } from "react";
import ChatIcon from "@mui/icons-material/Chat";
import Avatar from "@mui/material/Avatar";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import Image from "next/image";

interface ChatBoxProps {
  chat: {
    id: string;
    from: string;
    content: string;
    time?: string;
  };
  autoCompleteResponse: "accept" | "reject" | null;
  setAutoCompleteResponse: (value: "accept" | "reject" | null) => void;
  setUserInput: (value: string) => void;
  slideValue: number;
  showRelatedNode: (slide: number) => void;
  cancel: () => void;
}

const ChatBox: React.FC<ChatBoxProps> = ({
  chat,
  autoCompleteResponse,
  setAutoCompleteResponse,
  setUserInput,
  slideValue,
  showRelatedNode,
  cancel,
}) => {
  const handleSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAutoCompleteResponse(event.target.value as "accept" | "reject");
    if ((event.target.value as "accept" | "reject") === "accept") {
      setUserInput(`I want to know about ${chat.content}`);
    } else {
      setUserInput("");
    }
  };

  const components = {
    h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h1 className="text-2xl font-bold my-2" {...props} />,
    h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h2 className="text-xl font-bold my-2" {...props} />,
    h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className="text-lg font-bold my-2" {...props} />,
    p: (props: React.HTMLAttributes<HTMLParagraphElement>) => <p className="my-2" {...props} />,
    strong: (props: React.HTMLAttributes<HTMLElement>) => <strong className="font-bold" {...props} />,
  };

  if (chat.from === "auto-complete") {
    return (
      <div className="flex flex-row justify-start my-4 p-[10px] rounded-lg z-10">
        <div className="mr-1">
          <Avatar
            sx={{ width: 30, height: 30 }}
            className="bg-white border border-[rgba(248,230,247)]"
          >
            <Image width={25} height={25} src="/chat.png" alt="ai" />
          </Avatar>
        </div>
        <div className="flex flex-col">
          <Markdown 
            className="text-[#012027] bg-[rgba(248,248,247,0.5)] px-2 rounded-lg"
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {`Do you want to know about ${chat.content}?`}
          </Markdown>
          <div className="flex flex-row justify-center">
            <FormControl component="fieldset" className="mt-2">
              <RadioGroup
                value={autoCompleteResponse}
                onChange={handleSelection}
                row
              >
                <FormControlLabel
                  value="accept"
                  control={<Radio />}
                  label="Accept"
                  className="text-black"
                />
                <FormControlLabel
                  value="reject"
                  control={<Radio />}
                  label="Reject"
                  className="text-black"
                />
              </RadioGroup>
            </FormControl>
          </div>
        </div>
      </div>
    );
  }

  if (chat.from === "bot") {
    return (
      <div className="flex flex-row justify-start my-4 p-[10px] rounded-lg z-10">
        <div className="mr-1">
          <Avatar
            sx={{ width: 30, height: 30 }}
            className="bg-white border border-[rgba(248,230,247)]"
          >
            <Image width={25} height={25} src="/chat.png" alt="ai" />
          </Avatar>
        </div>
        <div className="flex flex-col">
          <Markdown 
            className="text-[#012027] bg-[rgba(248,248,247,0.5)] px-2 rounded-lg"
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {chat.content}
          </Markdown>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row justify-end my-4 p-[10px] rounded-lg">
      <div className="flex flex-col text-[#012027] bg-[rgba(232,229,216,0.5)] py-2 rounded-lg">
        {chat.content.split("\n").map((paragraph: string, index: number) => (
          <Markdown
            key={`${chat.id}-paragraph${index}`}
            className="text-[#012027] p-2"
            remarkPlugins={[remarkGfm]}
            components={components}
          >
            {paragraph}
          </Markdown>
        ))}
      </div>
    </div>
  );
};

export default ChatBox;
