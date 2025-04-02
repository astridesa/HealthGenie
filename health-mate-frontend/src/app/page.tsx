"use client"; // This is a client component
import { useCallback, useEffect, useState } from "react";
import Visualization from "@/components/Visualization";
import ContentPanel from "@/components/ContentPanel";
import "./index.css";
import { UNION_ANNOTATION_DATA } from "@/data/livescore";
import { nodes, links } from "@/data/data";
import {
  generateSelectedDataset,
  generateMentionedDataset,
} from "@/utils/utils";
import SideBar from "@/components/Sidebar";
import { v4 as uuidv4 } from "uuid";
import HistoryVisualization from "@/components/HistoryVisualization";
import ChatInput from "@/components/ChatInput";
import NodeTooltip from "@/components/Tooltip";

interface HistoryItem {
  id: string;
  type: string;
  content: string;
  time: string;
  title?: string;
  chats?: any[];
}

const App = () => {
  // const DATA_SOURCE = UNION_ANNOTATION_DATA;
  const DATA_SOURCE = {
    nodes,
    links,
  };

  const [slideValue, setSlideValue] = useState(5);

  const [localUserId, setLocalUserId] = useState<string>("");

  const [localHistory, setLocalHistory] = useState<HistoryItem[]>([]);

  const [currentHistory, setCurrentHistory] = useState("");

  const [selectedId, setSelectedId] = useState<any>();

  const [visData, setVisData] = useState({ nodes, links });
  const [isOverview, setIsOverview] = useState(true);

  const [clickedNode, setClickedNode] = useState<any>();

  const [mentionedNodes, setMentionedNodes] = useState([]);

  const [keywordNodes, setKeywordNodes] = useState([]);

  const [chats, setChats] = useState<any>([]);

  const [isInitialized, setIsInitialized] = useState(false);

  const [relatedNodes, setRelatedNodes] = useState<any>([]);

  const [recommendQuery, setRecommendQuery] = useState<string>("");

  const [tooltipProps, setTooltipProps] = useState<any>(null);

  const [graphHeight, setGraphHeight] = useState(80); // percentage of viewport height

  const handleClearVisualization = () => {
    // Reset visualization data to initial state
    setVisData({ nodes, links });
    setIsOverview(true);
    setSelectedId(null);
    setClickedNode(null);
    setMentionedNodes([]);
    setKeywordNodes([]);
    setRelatedNodes([]);
  };

  const handleClickedNode = useCallback((clickedNode: number) => {
    const node = nodes.find((node: any) => node.id === clickedNode);
    setClickedNode(node);
  }, []);

  const handleMentionNode = (nodes: any, keywordNodes: any) => {
    if (nodes.length === 0) {
      setMentionedNodes(nodes);
      setVisData(DATA_SOURCE);
      return;
    }
    setMentionedNodes(nodes);
    setKeywordNodes(keywordNodes);
    setVisData(generateMentionedDataset(nodes, DATA_SOURCE));
    setIsOverview(false);
  };

  const showRelatedNode = (slide: number) => {
    setSlideValue(slide);

    const excludeNodes = relatedNodes.nodes.filter(
      (node: any) => node.id !== clickedNode.id,
    );

    const filteredNodes = excludeNodes.slice(
      0,
      Math.floor((slide / 5) * excludeNodes.length),
    );

    const includedNodes = [
      ...filteredNodes,
      ...relatedNodes.nodes.filter((node: any) => node.id === clickedNode.id),
    ];

    const filteredNodeIds = includedNodes.map(
      (filteredNode: any) => filteredNode.id,
    );

    const filterLink = relatedNodes.links.filter((link: any) => {
      return (
        filteredNodeIds.includes(link.source.id) &&
        filteredNodeIds.includes(link.target.id)
      );
    });

    setVisData({
      nodes: includedNodes,
      links: filterLink,
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const userId = localStorage.getItem("userId");
      const history = localStorage.getItem("history");

      if (userId) {
        setLocalUserId(JSON.parse(userId));
      } else {
        const userId = uuidv4();
        localStorage.setItem("userId", JSON.stringify(userId));
        setLocalUserId(userId);
      }

      if (!history) {
        const initialHistory = [
          {
            id: uuidv4(),
            title: "",
            time: new Date().toLocaleString("ja-JP", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false, // 使用24小时制
            }),
            chats: [],
          },
        ];
        localStorage.setItem("history", JSON.stringify(initialHistory));

        setLocalHistory(initialHistory as any);
        setCurrentHistory(initialHistory[0].id as string);
      } else {
        setLocalHistory(JSON.parse(history));
        setCurrentHistory(JSON.parse(history)[0].id);
      }

      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    const hist = JSON.parse(localStorage.getItem("history") as string);

    if (currentHistory) {
      const usingHistory = hist.find((hi: any) => hi.id === currentHistory);
      if (usingHistory) {
        setChats(usingHistory.chats || []);
      } else {
        setChats([]);
      }
    }
  }, [currentHistory, isInitialized]);

  const cancel = () => {
    const targetIds: any[] = [...keywordNodes];

    targetIds.forEach((id: number) => {
      links.forEach((link: any) => {
        if (link.source.id === id) {
          targetIds.push(link.target.id);
        }
        if (link.target.id === id) {
          targetIds.push(link.source.id);
        }
      });
    });

    const uniqueTargetIds = [...new Set(targetIds)];

    const mentionedNodes = nodes.filter((node: any) => {
      return uniqueTargetIds.includes(node.id);
    });

    handleMentionNode(mentionedNodes, keywordNodes);

    setChats((prevChats: any) => {
      return [
        ...prevChats.filter(
          (chat: any) =>
            chat.from !== "auto-complete" && chat.from !== "slidebar",
        ),
      ];
    });
    setClickedNode(null);
  };

  const addSlideBarChat = (nodeId: number, nodeName: string) => {
    const related = [nodeId];

    DATA_SOURCE.links.forEach((link: any) => {
      if (link.source.id === nodeId) {
        related.push(link.target.id);
      }
      if (link.target.id === nodeId) {
        related.push(link.source.id);
      }
    });

    setRelatedNodes(generateSelectedDataset(nodeId, DATA_SOURCE));
  };

  const handleDrag = (e: React.MouseEvent) => {
    const startY = e.clientY;
    const startHeight = graphHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.max(20, Math.min(90, startHeight + (deltaY / window.innerHeight) * 100));
      setGraphHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <section className="m-1 pb-2 rounded-xl border-4 h-screen overflow-hidden">
      <div className="flex flex-row justify-start w-full h-full">
        <SideBar
          userId={localUserId}
          localHistory={localHistory}
          setLocalHistory={setLocalHistory}
          setCurrentHistory={setCurrentHistory}
          onClearVisualization={handleClearVisualization}
        />

        <div className="flex-1 flex flex-col h-full">
          <div className="relative" style={{ height: `${graphHeight}%` }}>
            <Visualization
              visData={visData}
              setVisData={setVisData}
              setChats={setChats}
              setRecommendQuery={setRecommendQuery}
              currentHistory={currentHistory}
              localHistory={localHistory}
              setLocalHistory={setLocalHistory}
              isOverview={isOverview}
              selectedId={selectedId}
              keywordNodes={keywordNodes}
              handleClickedNode={handleClickedNode}
              clickedNode={clickedNode}
              addSlideBarChat={addSlideBarChat}
              showRelatedNode={showRelatedNode}
              slideValue={slideValue}
              cancel={cancel}
              localUserId={localUserId}
            />
            <div 
              className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 cursor-ns-resize hover:bg-gray-400 transition-colors"
              onMouseDown={handleDrag}
            />
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            <HistoryVisualization 
              localHistory={localHistory} 
              setLocalHistory={setLocalHistory}
              localUserId={localUserId}
            />
          </div>
        </div>

        <ContentPanel
          data={DATA_SOURCE}
          selectedId={selectedId}
          handleMentionNode={handleMentionNode}
          setSelectedId={setSelectedId}
          clickedNode={clickedNode}
          setClickedNode={setClickedNode}
          localHistory={localHistory}
          setLocalHistory={setLocalHistory}
          chats={chats}
          setChats={setChats}
          slideValue={slideValue}
          showRelatedNode={showRelatedNode}
          cancel={cancel}
          localUserId={localUserId}
          recommendQuery={recommendQuery}
          setRecommendQuery={setRecommendQuery}
          onSendMessage={() => {}}
          isLoading={false}
          currentHistory={currentHistory}
        />
      </div>

      {tooltipProps && (
        <NodeTooltip
          {...tooltipProps}
          setTooltipProps={setTooltipProps}
          setChats={setChats}
          setRecommendQuery={setRecommendQuery}
          setVisData={setVisData}
          currentHistory={currentHistory}
          localHistory={localHistory}
          setLocalHistory={setLocalHistory}
          localUserId={localUserId}
        />
      )}
    </section>
  );
};

export default App;
