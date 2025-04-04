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
  selectedId: number | null;
  localHistory: any[];
  setLocalHistory: React.Dispatch<React.SetStateAction<any[]>>;
  chats: any[];
  setChats: React.Dispatch<React.SetStateAction<any[]>>;
  slideValue: number;
  recommendQuery: string;
  setRecommendQuery: React.Dispatch<React.SetStateAction<string>>;
  onSendMessage: () => void;
  isLoading: boolean;
  handleMentionNode: (nodes: any[], keywordNodes: any[]) => void;
  setSelectedId: React.Dispatch<React.SetStateAction<number | null>>;
  clickedNode: any;
  currentHistory: string;
  showRelatedNode: (slide: number) => void;
  cancel: () => void;
  setClickedNode: React.Dispatch<React.SetStateAction<any>>;
  localUserId: string;
  setVisData: React.Dispatch<React.SetStateAction<any>>;
}

interface KnowledgeGraphNode {
  id: number;
  name: string;
}

interface KnowledgeGraphEdge {
  [0]: number;  // source
  [1]: number;  // target
  [2]: string;  // relation
}

interface KnowledgeGraphResponse {
  subject: string[];
  relation: string[];
  object: string[];
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
        type: "recommendation",
        userId: localUserId
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

const sendQuestion = async ({ inputValue, userId }: any) => {
  try {
    console.log("Sending question:", { inputValue, userId }); // Debug log
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
        userId: userId,
      }),
    });

    console.log("Response status:", response.status); // Log response status
    console.log("Response headers:", Object.fromEntries(response.headers.entries())); // Log response headers

    if (!response.ok) {
      let errorData;
      let errorText;
      
      // Try to get the error response as text first
      try {
        const responseClone = response.clone();
        errorText = await responseClone.text();
        
        // Try to parse the text as JSON
        try {
          errorData = JSON.parse(errorText);
        } catch (jsonError) {
          // If JSON parsing fails, use the text as error message
          errorData = { error: errorText || 'Unknown error occurred' };
        }
      } catch (textError: any) {
        // If text reading fails, create a basic error object
        errorData = { 
          error: `Server error: ${response.status} ${response.statusText}`,
          details: textError?.message || 'Failed to read error response'
        };
      }

      // Log detailed error information
      console.error("Server error details:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
        headers: Object.fromEntries(response.headers.entries()),
        url: response.url
      });
      
      // Throw a more informative error
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
    const historyData = {
      id: localUserId,
      type: type,
      content: content,
      time: new Date().toISOString(),
    };

    const response = await fetch(`${SERVER_URL}/api/history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(historyData),
    });

    if (!response.ok) {
      throw new Error("Failed to write chat history");
    }

    const responseData = await response.json();
    console.log("History write response:", responseData); // Debug log
  } catch (error) {
    console.error("Error writing chat history:", error);
  }
};

const ContentPanel: React.FC<ContentPanelProps> = ({
  data,
  selectedId,
  localHistory,
  setLocalHistory,
  chats,
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
  setVisData
}) => {
  const [inputValue, setInputValue] = useState("");
  const scrollableChatBox = useRef<HTMLDivElement>(null);

  const [isInputing, setIsInputing] = useState(false);

  const [waitingResponse, setWaitingReponse] = useState(false);

  const [userInput, setUserInput] = useState("");

  const [autoCompleteResponse, setAutoCompleteResponse] = useState<
    "accept" | "reject" | null
  >(null);

  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);

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
    mutationFn: (variables: { inputValue: string }) => sendQuestion({ inputValue: variables.inputValue, userId: localUserId }),
    onSuccess: async (successData) => {
      const { finalAnswer, knowledgeGraph } = successData;

      const answer = {
        from: "bot",
        content: finalAnswer,
        id: uuidv4(),
        time: new Date().toISOString(),
      };

      setChats(prevChats => [...prevChats, answer]);

      // Write both user message and bot response to history
      await writeChatToHistory(userInput, "chat", localUserId);
      await writeChatToHistory(finalAnswer, "chat", localUserId);

      // Process knowledge graph data if available
      if (knowledgeGraph) {
        // Create unique IDs for nodes
        const nodeMap = new Map<string, number>();
        let nextId = 1;

        // Helper function to get or create node ID
        const getNodeId = (name: string) => {
          if (!nodeMap.has(name)) {
            nodeMap.set(name, nextId++);
          }
          return nodeMap.get(name)!;
        };

        // Create nodes from unique subjects and objects
        const uniqueNodes = new Set([...knowledgeGraph.subject, ...knowledgeGraph.object]);
        const nodes = Array.from(uniqueNodes).map(name => {
          const id = getNodeId(name);
          // Find the category from the backend data
          let category = knowledgeGraph.cat?.[knowledgeGraph.object.indexOf(name)];
          
          // If category is not found, determine it based on the name
          if (!category) {
            if (name.includes('食谱的功效')) {
              category = 'Health Benefit';
            } else if (name.includes('食谱') || name.includes('菜谱')) {
              category = 'menu';
            } else {
              category = 'menu'; // Default category
            }
          } else if (category === '食谱的功效') {
            category = 'Health Benefit';
          }
          
          return {
            id,
            name,
            chinese: name,
            category,
            isShared: false,
            // Add random initial positions to help with force layout
            x: Math.random() * 500,
            y: Math.random() * 500
          };
        });

        // Create links from the triples
        const links = knowledgeGraph.subject.map((subject: string, index: number) => {
          const sourceId = getNodeId(subject);
          const targetId = getNodeId(knowledgeGraph.object[index]);
          return {
            source: sourceId,
            target: targetId,
            relation: knowledgeGraph.relation[index],
            isShared: false,
            index
          };
        });

        // Create new visualization data
        const newVisData = { 
          nodes,
          links
        };

        // Update visualization data
        if (typeof setVisData === 'function') {
          // First clear the existing data
          setVisData({ nodes: [], links: [] });
          
          // Then set the new data after a brief delay to ensure clean transition
          setTimeout(() => {
            setVisData(newVisData);
          }, 50);
        } else {
          console.error('setVisData is not a function');
        }
        
        // Update mentioned nodes for highlighting
        const mentionedNodeIds = nodes.map(node => node.id);
        handleMentionNode(nodes, mentionedNodeIds);
      }

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
        time: new Date().toISOString(),
      };
      setChats(prevChats => [...prevChats, errorMessage]);
      
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
    mutation.mutate({ inputValue: userInput });
  };

  useEffect(() => {
    const relevantNode = data.nodes.find((node: any) => node.id === selectedId);
    setInputValue(relevantNode?.name ?? "");
  }, [selectedId]);

  const handleRecommendationClick = async () => {
    try {
      if (!localUserId) {
        console.error("User ID is not available.");
        return;
      }

      setIsRecommendationLoading(true);

      const response = await fetch(`${SERVER_URL}/api/recommend`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: localUserId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Recommendation API Response:", data); // Debug log

      if (!data || !data.recommendationQuery) {
        throw new Error("No recommendation query received");
      }

      // Create a new chat message for the recommendation
      const recommendationMessage = {
        from: "bot",
        content: data.recommendationQuery,
        id: uuidv4(),
        time: new Date().toISOString(),
      };

      // Update the chat history with the new recommendation message
      setChats(prevChats => [...prevChats, recommendationMessage]);

      // Write the recommendation to history with proper format
      const historyData = {
        id: localUserId,
        type: "recommendation",
        content: data.recommendationQuery,
        time: new Date().toISOString(),
      };

      await writeChatToHistory(historyData.content, historyData.type, historyData.id);
    } catch (error: any) {
      console.error("Error recording recommendation:", error);
      // Add error message to chat
      const errorMessage = {
        from: "bot",
        content: "Would you like to explore some healthy recipes?",
        id: uuidv4(),
        time: new Date().toISOString(),
      };
      setChats(prevChats => [...prevChats, errorMessage]);
    } finally {
      setIsRecommendationLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    setIsSubmitting(true);
    const userMessage = message;
    setMessage("");

    // Add user message to chat
    const newChat = {
      from: "user",
      content: userMessage,
      time: new Date().toISOString(),
    };
    setChats(prevChats => [...prevChats, newChat]);

    try {
      const response = await fetch(`${SERVER_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage,
          userId: localUserId,
        }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      
      // Add AI response to chat
      const aiChat = {
        from: "ai",
        content: data.finalAnswer,
        time: new Date().toISOString(),
      };
      setChats(prevChats => [...prevChats, aiChat]);

      // Process knowledge graph data
      if (data.knowledgeGraph) {
        // Create unique IDs for nodes
        const nodeMap = new Map<string, number>();
        let nextId = 1;

        // Helper function to get or create node ID
        const getNodeId = (name: string) => {
          if (!nodeMap.has(name)) {
            nodeMap.set(name, nextId++);
          }
          return nodeMap.get(name)!;
        };

        // Create nodes from unique subjects and objects
        const uniqueNodes = new Set([...data.knowledgeGraph.subject, ...data.knowledgeGraph.object]);
        const nodes = Array.from(uniqueNodes).map(name => {
          const id = getNodeId(name);
          // Find the category from the backend data
          let category = data.knowledgeGraph.cat?.[data.knowledgeGraph.object.indexOf(name)];
          
          // If category is not found, determine it based on the name
          if (!category) {
            if (name.includes('食谱的功效')) {
              category = 'Health Benefit';
            } else if (name.includes('食谱') || name.includes('菜谱')) {
              category = 'menu';
            } else {
              category = 'menu'; // Default category
            }
          } else if (category === '食谱的功效') {
            category = 'Health Benefit';
          }
          
          return {
            id,
            name,
            chinese: name,
            category,
            isShared: false,
            // Add random initial positions to help with force layout
            x: Math.random() * 500,
            y: Math.random() * 500
          };
        });

        // Create links from the triples
        const links = data.knowledgeGraph.subject.map((subject: string, index: number) => {
          const sourceId = getNodeId(subject);
          const targetId = getNodeId(data.knowledgeGraph.object[index]);
          return {
            source: sourceId,
            target: targetId,
            relation: data.knowledgeGraph.relation[index],
            isShared: false,
            index
          };
        });

        // Create new visualization data
        const newVisData = { 
          nodes,
          links
        };

        // Update visualization data
        if (typeof setVisData === 'function') {
          // First clear the existing data
          setVisData({ nodes: [], links: [] });
          
          // Then set the new data after a brief delay to ensure clean transition
          setTimeout(() => {
            setVisData(newVisData);
          }, 50);
        } else {
          console.error('setVisData is not a function');
        }
        
        // Update mentioned nodes for highlighting
        const mentionedNodeIds = nodes.map(node => node.id);
        handleMentionNode(nodes, mentionedNodeIds);
      }

    } catch (error) {
      console.error("Error:", error);
      const errorChat = {
        from: "ai",
        content: "Sorry, there was an error processing your request.",
        time: new Date().toISOString(),
      };
      setChats(prevChats => [...prevChats, errorChat]);
    } finally {
      setIsSubmitting(false);
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
              {(waitingResponse || isRecommendationLoading) ? <LinearProgress /> : null}
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
                <span className="text-white">Query Generation</span>
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
            setRecommendQuery={setRecommendQuery}
            recommendQuery={recommendQuery}
            userId={localUserId}
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
