import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import * as d3 from "d3";
import {
  addFrequencyToNode,
  sortNodesByFrequency,
  isNodeInsideSliceArray,
  addRadiusToNode,
} from "../utils/utils";
import NodeTooltip from "./Tooltip";
import PreferenceSelector from "./PreferenceSelector";
import LevelSlider from "./LevelSlider";
import { useMutation } from "@tanstack/react-query";
import { SERVER_URL } from "@/constant/server";
import { colors, getCategoryColor } from "@/constant/colors";
import { ChatSession } from "../types/chat";
import { processKnowledgeGraphData, combineSubgraphs } from '@/utils/subgraphProcessor';
import { BaseType, Element, EnterElement, Selection, TransitionLike } from 'd3';
import { Node, Link } from '@/types/graph';
import { getNodeColor } from '@/utils/colors';

interface TooltipProps {
  x: number;
  y: number;
  title: string;
  content: string;
  setTooltipProps: (props: any) => void;
  setVisData: (data: any) => void;
  currentHistory: string;
  localHistory: ChatSession[];
  setLocalHistory: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  localUserId: string;
}

interface VisualizationProps {
  visData: {
    nodes: D3Node[];
    links: D3Link[];
  };
  setVisData: (data: any) => void;
  setChats: (chats: any) => void;
  setRecommendQuery: (query: string) => void;
  currentHistory: string;
  localHistory: ChatSession[];
  setLocalHistory: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  isOverview: boolean;
  selectedId: number | null;
  keywordNodes: D3Node[];
  handleClickedNode: (id: number) => void;
  clickedNode: D3Node | null;
  addSlideBarChat: (id: number, name: string) => void;
  showRelatedNode: (nodes: D3Node[]) => void;
  slideValue: number;
  cancel: () => void;
  localUserId: string;
}

interface D3Node extends d3.SimulationNodeDatum {
  id: number;
  name: string;
  chinese: string;
  category: string;
  isShared: boolean;
  x?: number;
  y?: number;
}

interface D3Link extends d3.SimulationLinkDatum<D3Node> {
  source: D3Node;
  target: D3Node;
  relation: string;
  isShared: boolean;
  index: number;
}

const sendClickHistory = async (history: ChatSession, localUserId: string) => {
  const response = await fetch(`${SERVER_URL}/api/history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...history,
      id: localUserId,
    }),
  });

  if (!response.ok) {
    throw new Error("Network response was not ok");
  }

  return response.json();
};

const Visualization: React.FC<VisualizationProps> = (props) => {
  const d3Container = useRef<SVGSVGElement>(null);
  const [levelValue, setLevelValue] = useState(1);
  const [subgraphData, setSubgraphData] = useState<any>(null);
  const [simulation, setSimulation] = useState<d3.Simulation<D3Node, D3Link> | null>(null);
  const [mentionedNodes, setMentionedNodes] = useState<D3Node[]>([]);

  const width = 700;

  const mutation = useMutation({
    mutationFn: (history: ChatSession) => sendClickHistory(history, props.localUserId),
  });

  const [tooltipProps, setTooltipProps] = useState<TooltipProps | null>(null);

  const height = 700;

  const processDuplicates = (data: any) => {
    const map = new Map();

    for (const item of data) {
      const key = `${item.source.id}-${item.target.id}`;

      if (map.has(key)) {
        const existingItem = map.get(key);
        existingItem.relation += `, ${item.relation}`;
      } else {
        map.set(key, { ...item });
      }
    }

    return Array.from(map.values());
  };

  const renderNodes = (
    nodes: D3Node[],
    topNodes: D3Node[],
    keywordNodes: D3Node[],
    mouseover: (event: any, d: D3Node) => void,
    mouseout: (event: any, d: D3Node) => void,
    startDrag: (event: d3.D3DragEvent<SVGCircleElement, D3Node, unknown>, d: D3Node) => void,
    dragging: (event: d3.D3DragEvent<SVGCircleElement, D3Node, unknown>, d: D3Node) => void,
    endDrag: (event: d3.D3DragEvent<SVGCircleElement, D3Node, unknown>, d: D3Node) => void,
  ) => {
    d3.select(d3Container.current)
      .select("g.nodes")
      .selectAll<SVGCircleElement, D3Node>("circle")
      .data(nodes, (d: D3Node) => d.id)
      .exit()
      .remove();

    d3.select(d3Container.current)
      .select("g.nodes")
      .selectAll<SVGCircleElement, D3Node>("circle")
      .data(nodes, (d: D3Node) => d.id)
      .enter()
      .append("circle")
      .attr("r", (d: D3Node) => {
        if (d.isShared) {
          return isNodeInsideSliceArray(topNodes, d) ? 14 : 12;
        }
        return isNodeInsideSliceArray(topNodes, d) ? 12 : 10;
      })
      .style("opacity", 1)
      .attr("fill", (d: D3Node) => {
        return getCategoryColor(d.category);
      })
      .attr("stroke", (d: D3Node) => d.isShared ? "#000" : "none")
      .attr("stroke-width", (d: D3Node) => d.isShared ? 2 : 0)
      .attr("stroke-dasharray", (d: D3Node) => d.isShared ? "5,5" : "none")
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .on("click", (event: any, d: D3Node) => {
        console.log("Clicked node:", d);
        console.log("Node category:", d.category);
        if (d.category && ["A1", "A2", "A3", "B1", "B2", "B3", "C", "D"].includes(d.category)) {
          console.log("Valid category found:", d.category);
          props.handleClickedNode(d.id);
          props.addSlideBarChat(d.id, d.name);
          mutation.mutate({
            id: props.localUserId,
            content: d.name,
            time: new Date().toISOString(),
            type: "click",
            chats: []
          });
          setTooltipProps({
            x: event.offsetX,
            y: event.offsetY,
            title: d.name,
            content: d.name,
            setTooltipProps,
            setVisData: props.setVisData,
            currentHistory: props.currentHistory,
            localHistory: props.localHistory,
            setLocalHistory: props.setLocalHistory,
            localUserId: props.localUserId
          });
        } else {
          console.log("Invalid or no category");
        }
      })
      .call(d3.drag<SVGCircleElement, D3Node>()
        .on("start", startDrag)
        .on("drag", dragging)
        .on("end", endDrag))
      .call(updateNode);
  };

  const renderLinks = (links: D3Link[], update: (selection: d3.Selection<SVGLineElement, D3Link, SVGGElement, unknown>) => void) => {
    const linkSelection = d3.select(d3Container.current)
      .select<SVGGElement>("g.links")
      .selectAll<SVGLineElement, D3Link>("line")
      .data(links, (d: D3Link) => d.index);

    linkSelection.exit().remove();

    const enterSelection = linkSelection
      .enter()
      .append("line")
      .attr("stroke", "#E5EAEB")
      .attr("stroke-width", (d: D3Link) => {
        if (d.isShared) return "2px";
        return d.relation === "功效" ? "2px" : "1px";
      })
      .attr("stroke-dasharray", (d: D3Link) => {
        if (d.isShared) return "5,5";
        return d.relation === "功效" ? "5,5" : "none";
      })
      .attr("marker-end", "url(#arrowhead)");

    update(enterSelection);
  };

  const renderNodeLabels = (nodes: any) => {
    d3.select(d3Container.current)
      .select("g.labelNodes")
      .selectAll("rect")
      .data(nodes, (d: any) => d.id)
      .exit()
      .remove();

    d3.select(d3Container.current)
      .select("g.labelNodes")
      .selectAll("rect")
      .data(nodes, (d: any) => d.id)
      .enter()
      .append("rect")
      .attr("fill", "white")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("width", (d: any) => d.name.length * 4 + 8)
      .attr("height", 16)
      .style("opacity", 0)
      .style("pointer-events", "none")
      .call(updateNodeLabel);

    d3.select(d3Container.current)
      .select("g.labelNodes")
      .selectAll("text")
      .data(nodes, (d: any) => d.id)
      .exit()
      .remove();

    d3.select(d3Container.current)
      .select("g.labelNodes")
      .selectAll("text")
      .data(nodes, (d: any) => d.id)
      .enter()
      .append("text")
      .attr("fill", "#666")
      .attr("font-size", "12px")
      .text((d: any) => d.name)
      .style("pointer-events", "none")
      .call(updateNodeLabel);
  };

  const updateNode = (node: any) => {
    node.attr("transform", function (d: any) {
      return "translate(" + d.x + "," + d.y + ")";
    });
  };

  const updateNodeLabel = (label: any) => {
    label.attr("transform", function(d: any) {
      const x = d.x - (d.name.length * 2 + 4);
      const y = d.y - 20;
      return `translate(${x},${y})`;
    });
  };

  const updateLinkLabel = (label: any) => {
    label.attr("transform", function(d: any) {
      const diffX = d.target.x - d.source.x;
      const diffY = d.target.y - d.source.y;
      const angle = Math.atan2(diffY, diffX) * 180 / Math.PI;
      
      const x = d.source.x + 0.5 * diffX;
      const y = d.source.y + 0.5 * diffY;
      
      return `translate(${x},${y}) rotate(${angle})`;
    })
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em");
  };

  const renderLinkLabels = (links: any) => {
    d3.select(d3Container.current)
      .select("g.linkLabels")
      .selectAll("text")
      .data(links, (data: any) => data.index)
      .exit()
      .remove();

    d3.select(d3Container.current)
      .select("g.linkLabels")
      .selectAll("text")
      .data(links, (data: any) => data.index)
      .enter()
      .append("text")
      .attr("fill", "#8d8d8d")
      .attr("font-size", "12px")
      .text((d: any) => d.relation)
      .style("pointer-events", "none")
      .style("opacity", 0)
      .call(updateLinkLabel);
  };

  const handleLevelChange = (value: number) => {
    setLevelValue(value);
  };

  const updateLink = (selection: d3.Selection<SVGLineElement, D3Link, SVGGElement, unknown>) => {
    selection
      .attr("x1", (d: D3Link) => d.source.x || 0)
      .attr("y1", (d: D3Link) => d.source.y || 0)
      .attr("x2", (d: D3Link) => d.target.x || 0)
      .attr("y2", (d: D3Link) => d.target.y || 0);
  };

  const focus = (event: any, d: any) => {
    const value = d.name;
    const div = document.getElementById("tooltip");
    if (div) {
      div.style.display = "block";
      div.innerHTML = value;
    }

    // Get all neighboring nodes
    const neighboringNodes = new Set<number>();
    neighboringNodes.add(d.id);
    
    // Find all connected nodes through links
    props.visData.links.forEach((link: any) => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === d.id) {
        neighboringNodes.add(targetId);
      }
      if (targetId === d.id) {
        neighboringNodes.add(sourceId);
      }
    });

    console.log('Hovered node:', d.id);
    console.log('Neighboring nodes:', Array.from(neighboringNodes));

    // Hide unrelated nodes and links
    d3.select(d3Container.current)
      .select("g.nodes")
      .selectAll("circle")
      .style("opacity", function(node: any) {
        const nodeId = typeof node === 'object' ? node.id : node;
        const isVisible = neighboringNodes.has(nodeId);
        console.log('Node:', nodeId, 'Visible:', isVisible);
        return isVisible ? 1 : 0;
      });

    d3.select(d3Container.current)
      .select("g.links")
      .selectAll("line")
      .style("opacity", function(link: any) {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        const isVisible = sourceId === d.id || targetId === d.id;
        console.log('Link:', sourceId, '->', targetId, 'Visible:', isVisible);
        return isVisible ? 1 : 0;
      });

    // Show labels only for related links
    d3.select(d3Container.current)
      .select("g.linkLabels")
      .selectAll("text")
      .style("opacity", function(link: any) {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return (sourceId === d.id || targetId === d.id) ? 1 : 0;
      });

    // Hide unrelated node labels
    d3.select(d3Container.current)
      .select("g.labelNodes")
      .selectAll("text")
      .style("opacity", function(node: any) {
        const nodeId = typeof node === 'object' ? node.id : node;
        return neighboringNodes.has(nodeId) ? 1 : 0;
      });
  };

  const unfocus = () => {
    const div = document.getElementById("tooltip");
    if (div) {
      div.style.display = "none";
    }

    // Restore visibility of all nodes and links
    d3.select(d3Container.current)
      .select("g.nodes")
      .selectAll("circle")
      .style("opacity", 1);

    d3.select(d3Container.current)
      .select("g.links")
      .selectAll("line")
      .style("opacity", 1);

    // Hide all link labels
    d3.select(d3Container.current)
      .select("g.linkLabels")
      .selectAll("text")
      .style("opacity", 0);

    // Restore visibility of all node labels
    d3.select(d3Container.current)
      .select("g.labelNodes")
      .selectAll("text")
      .style("opacity", 1);
  };

  const dragstarted = (event: d3.D3DragEvent<SVGCircleElement, D3Node, unknown>, d: D3Node) => {
    if (!event.active || !simulation) return;
    simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  };

  const dragged = (event: d3.D3DragEvent<SVGCircleElement, D3Node, unknown>, d: D3Node) => {
    if (!simulation) return;
    d.fx = event.x;
    d.fy = event.y;
    simulation.alphaTarget(0.3).restart();
  };

  const dragended = (event: d3.D3DragEvent<SVGCircleElement, D3Node, unknown>, d: D3Node) => {
    if (!event.active || !simulation) return;
    simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  };

  const ticked = () => {
    d3.select(d3Container.current)
      .select("g.nodes")
      .selectAll("circle")
      .call(updateNode);
    
    d3.select(d3Container.current)
      .select("g.links")
      .selectAll("line")
      .call(updateLink);
    
    d3.select(d3Container.current)
      .select("g.linkLabels")
      .selectAll("text")
      .call(updateLinkLabel);
    
    d3.select(d3Container.current)
      .select("g.labelNodes")
      .selectAll("rect")
      .call(updateNodeLabel);
    
    d3.select(d3Container.current)
      .select("g.labelNodes")
      .selectAll("text")
      .call(updateNodeLabel);
  };

  useEffect(() => {
    if (!d3Container.current || !props.visData) return;

    // Stop any existing simulation
    if (simulation) {
      simulation.stop();
    }

    // Clear existing visualization completely
    d3.select(d3Container.current).selectAll("*").remove();

    const svg = d3
      .select(d3Container.current)
      .attr("width", width)
      .attr("height", "calc(100vh - 76px)");

    // Use the data directly from props.visData
    const graph = {
      nodes: props.visData.nodes.map((node: any) => ({
        ...node,
        x: node.x || width / 2,
        y: node.y || height / 2
      })),
      links: props.visData.links.map((link: any, index: number) => ({
        ...link,
        index: link.index || index
      }))
    };

    // Create container group
    const container = svg.append("g").attr("class", "containerGroup");

    // Add zoom behavior
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    // Add arrowhead marker
    container
      .append("defs")
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)  // Adjust this value to position the arrowhead
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#E5EAEB");

    // Create groups for links, nodes, and labels
    container.append("g").attr("class", "links");
    container.append("g").attr("class", "nodes");
    container.append("g").attr("class", "linkLabels");
    container.append("g").attr("class", "labelNodes");

    // Set up force simulation with the new data
    const newSimulation = d3
      .forceSimulation(graph.nodes)
      .force("charge", d3.forceManyBody().strength(-100))  // Increased repulsion
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("link", d3.forceLink(graph.links)
        .id((d: any) => d.id)
        .distance(100))  // Increased link distance
      .force("collision", d3.forceCollide().radius(30))
      .alphaDecay(0.05)
      .alphaMin(0.001)
      .velocityDecay(0.4);

    setSimulation(newSimulation);

    // Render visualization elements with the new data
    renderLinks(graph.links, updateLink);
    renderNodes(
      graph.nodes,
      [],
      props.keywordNodes,
      focus,
      unfocus,
      dragstarted,
      dragged,
      dragended
    );
    renderLinkLabels(graph.links);
    renderNodeLabels(graph.nodes);

    // Update positions on each tick
    newSimulation.on("tick", ticked);

    // Cleanup
    return () => {
      newSimulation.stop();
      if (d3Container.current) {
        d3.select(d3Container.current).selectAll("*").remove();
      }
    };
  }, [props.visData, props.keywordNodes]);

  return (
    <div className="relative border box-border border-[#f6f0f6] shadow-xl">
      <svg
        className="bg-white rounded-2xl"
        ref={d3Container}
        width={width}
        height={height}
      />

      {tooltipProps && (
        <NodeTooltip
          {...tooltipProps}
          setTooltipProps={setTooltipProps}
          setVisData={props.setVisData}
          currentHistory={props.currentHistory}
          localHistory={props.localHistory}
          setLocalHistory={props.setLocalHistory}
          localUserId={props.localUserId}
        />
      )}

      <div
        className="absolute bg-white shadow-lg rounded-xs w-42 border border-[#f3c4f4] rounded-lg flex flex-col items-center z-50 p-2"
        style={{
          left: `20px`,
          top: `20px`,
        }}
      >
        {colors.map((color: any) => {
          return (
            <div
              className="flex flex-row items-center justify-start w-full my-0.5"
              key={color.color}
            >
              <div
                className='w-3 h-3 rounded-md mr-2'
                style={{
                  background: color.color,
                }}
              ></div>
              <div className="text-sm text-center">{color.content}</div>
            </div>
          );
        })}
      </div>

      <LevelSlider 
        value={levelValue}
        onChange={handleLevelChange}
      />

      {/* {props.clickedNode?.name ? (
        <PreferenceSelector
          name={props.clickedNode?.name}
          onChange={props.showRelatedNode}
          value={props.slideValue}
          cancel={props.cancel}
        />
      ) : (
        <></>
      )} */}
    </div>
  );
};

export default Visualization;
