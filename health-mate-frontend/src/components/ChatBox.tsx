import React, { useState } from "react";
import ChatIcon from "@mui/icons-material/Chat";
import Avatar from "@mui/material/Avatar";
import Markdown from "react-markdown";
import {
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";
import Image from "next/image";

const ChatBox = ({
  chat,
  autoCompleteResponse,
  setAutoCompleteResponse,
  setUserInput,
  slideValue,
  showRelatedNode,
  cancel,
}: any) => {
  const handleSelection = (event: any) => {
    setAutoCompleteResponse(event.target.value as "accept" | "reject");
    if ((event.target.value as "accept" | "reject") === "accept") {
      setUserInput(`I want to know about ${chat.content}`);
    } else {
      setUserInput("");
    }
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
          <Markdown className="text-[#012027] bg-[rgba(248,248,247,0.5)] px-2 rounded-lg">
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
          <Markdown className="text-[#012027] bg-[rgba(248,248,247,0.5)] px-2 rounded-lg">
            {chat.content}
          </Markdown>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row justify-end my-4 p-[10px] rounded-lg">
      <div className="flex flex-col text-[#012027] bg-[rgba(232,229,216,0.5)] py-2 rounded-lg">
        {chat.content.split("\n").map((paragraph: any, index: any) => (
          <Markdown
            key={`${chat.id}-paragraph${index}`}
            className="text-[#012027] p-2"
          >
            {paragraph}
          </Markdown>
        ))}
      </div>
    </div>
  );
};

export default ChatBox;
