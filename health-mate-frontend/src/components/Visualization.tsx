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
import { useMutation } from "@tanstack/react-query";
import { SERVER_URL } from "@/constant/server";
import { colors, getCategoryColor } from "@/constant/colors";

interface VisualizationProps {
  visData: any;
  setVisData: (data: any) => void;
  setChats: (chats: any) => void;
  setRecommendQuery: (query: string) => void;
  currentHistory: string;
  localHistory: any[];
  setLocalHistory: (history: any[]) => void;
  isOverview: boolean;
  selectedId: number | null;
  keywordNodes: number[];
  handleClickedNode: (id: number) => void;
  clickedNode: any;
  addSlideBarChat: (nodeId: number, nodeName: string) => void;
  showRelatedNode: (slide: number) => void;
  slideValue: number;
  cancel: () => void;
  localUserId: string;
}

const sendClickHistory = async (history: any, localUserId: string) => {
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

const Visualization = (props: VisualizationProps) => {
  const d3Container = useRef<SVGSVGElement>(null);

  const width = 700;

  const mutation = useMutation({
    mutationFn: (history: any) => sendClickHistory(history, props.localUserId),
  });

  const [tooltipProps, setTooltipProps] = useState<{
    x: number;
    y: number;
    title: string;
    content: string;
  } | null>(null);

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
    nodes: any,
    topNodes: any,
    keywordNodes: any,
    mouseover: any,
    mouseout: any,
    startDrag: any,
    dragging: any,
    endDrag: any,
  ) => {
    d3.select("g.nodes")
      .selectAll("circle")
      .data(nodes, (data: any) => data.id)
      .exit()
      .remove();

    d3.select("g.nodes")
      .selectAll("circle")
      .data(nodes, (data: any) => data.id)
      .enter()
      .append("circle")
      .attr("r", (d) => {
        return isNodeInsideSliceArray(topNodes, d) ? (d as any).radius : 12;
      })
      .style("opacity", 1)
      .attr("fill", (d: any) => {
        return getCategoryColor(d.category);
      })
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .on("click", (event: any, d: any) => {
        console.log("Clicked node:", d);
        console.log("Node category:", d.category);
        // Only trigger click event if the node has a valid category code
        if (d.category && ["A1", "A2", "A3", "B1", "B2", "B3", "C", "D"].includes(d.category)) {
          console.log("Valid category found:", d.category);
          props.handleClickedNode(d.id);
          props.addSlideBarChat(d.id, d.name);
          mutation.mutate({
            id: props.localUserId,
            content: d.name,
            time: new Date().toISOString(),
            type: "click"
          });
          setTooltipProps({
            x: event.offsetX,
            y: event.offsetY,
            title: d.name,
            content: d.name,
          });
        } else {
          console.log("Invalid or no category");
        }
      })
      .call(
        (d3 as any)
          .drag()
          .on("start", startDrag)
          .on("drag", dragging)
          .on("end", endDrag),
      )
      .call(updateNode);
  };

  const renderLinks = (links: any, update: any) => {
    d3.select("g.links")
      .selectAll("line")
      .data(links, (link: any) => link.index)
      .exit()
      .remove();

    d3.select("g.links")
      .selectAll("line")
      .data(links, (link: any) => link.index)
      .enter()
      .append("line")
      .attr("stroke", "#E5EAEB")
      .attr("stroke-width", "1px")
      .attr("stroke-opacity", (d) => {
        return 1;
      })
      .attr("marker-end", "url(#arrowhead)")
      .call(update);
  };

  const renderNodeLabels = (display: any) => {
    d3.select("g.labelNodes").selectAll("rect").attr("display", display);

    d3.select("g.labelNodes").selectAll("text").attr("display", display);
  };

  const renderLinkLabels = (links: any) => {
    d3.select("g.linkLabels")
      .selectAll("text")
      .data(links, (link: any) => link.index)
      .exit()
      .remove();

    d3.select("g.linkLabels")
      .selectAll("line")
      .data(links, (link: any) => link.index)
      .exit()
      .remove();

    const texts = d3
      .select("g.linkLabels")
      .selectAll("text")
      .data(links, (link: any) => link.index)
      .enter()
      .append("text")
      .text((d: any, i) => d.relation)
      .style("fill", "#012027")
      .style("opacity", 1)
      .style("font-size", 12)
      .style("pointer-events", "none")
      .call(updateLinkLabel);

    const lines = d3
      .select("g.linkLabels")
      .selectAll("line")
      .data(links, (link: any) => link.index)
      .enter()
      .append("line");

    texts.each(function (_, i) {
      const bbox = this.getBBox();

      lines
        .filter((_, j) => i === j)
        .attr("x1", bbox.x)
        .attr("y1", bbox.y + bbox.height + 1) // 调整线条的垂直位置
        .attr("x2", bbox.x + bbox.width)
        .attr("y2", bbox.y + bbox.height + 1)
        .style("stroke", "#bdbde9")
        .style("stroke-width", 1)
        .call(updateLinkLabel);
    });
  };

  const updateNode = (node: any) => {
    node.attr("transform", function (d: any) {
      return "translate(" + d.x + "," + d.y + ")";
    });
  };

  const updateLinkLabel = (label: any) => {
    label.attr("transform", function (d: any) {
      const diffX = d.target.x - d.source.x;
      const diffY = d.target.y - d.source.y;

      return (
        "translate(" +
        (d.source.x + 0.7 * diffX) +
        "," +
        (d.source.y + 0.7 * diffY) +
        ")"
      );
    });
  };

  /* The useEffect Hook is for running side effects outside of React,
       for instance inserting elements into the DOM using D3 */
  useEffect(
    () => {
      if (props.visData && d3Container.current) {
        // D3 Logic
        // remove previous rendered svg
        const preExistGroup = d3Container.current?.querySelector("g");
        preExistGroup && preExistGroup.remove();

        const svg = d3
          .select(d3Container.current)
          .attr("width", width)
          .attr("height", "calc(100vh - 76px)");

        let graph = props.visData;

        const label: any = {
          nodes: [],
          links: [],
        };

        graph = addRadiusToNode(addFrequencyToNode(graph));
        const sortedArray = sortNodesByFrequency(graph.nodes);
        const topThreeHundredNodes = sortedArray.slice(0, 100);
        const topTenNodes = sortedArray.slice(0, 50);

        topThreeHundredNodes.forEach(function (d: any, i: any) {
          label.nodes.push({ node: d });
          label.nodes.push({ node: d });
          label.links.push({
            source: i * 2,
            target: i * 2 + 1,
          });
        });

        const labelLayout = d3
          .forceSimulation(label.nodes)
          .force("charge", d3.forceManyBody().strength(-50))
          .force("link", d3.forceLink(label.links).distance(0).strength(2));

        const graphLayout = d3
          .forceSimulation(graph.nodes)
          .force("charge", d3.forceManyBody().strength(-3000))
          .force("center", d3.forceCenter(width / 2, height / 2))
          .force("x", d3.forceX(width / 2).strength(1))
          .force("y", d3.forceY(height / 2).strength(1))
          .force(
            "link",
            d3
              .forceLink(graph.links)
              .id(function (d: any) {
                return d.id;
              })
              .distance(props.selectedId !== null ? 400 : 100)
              .strength(1),
          )
          .on("tick", ticked);

        const adjlist = {};
        let topThreeHundredLinks: any = [];

        graph.links.forEach(function (d: any) {
          const source = d.source.id;
          const target = d.target.id;

          const sourceExist = topThreeHundredNodes.some(
            (node: any) => node.id === source,
          );
          const targetExist = topThreeHundredNodes.some(
            (node: any) => node.id === target,
          );

          if (sourceExist && targetExist) {
            topThreeHundredLinks.push(d);
            if (d.source.id < d.target.id) {
              (adjlist as any)[d.source.id + "-" + d.target.id] = true;
            } else {
              (adjlist as any)[d.target.id + "-" + d.source.id] = true;
            }
          }
        });

        topThreeHundredLinks = processDuplicates(topThreeHundredLinks);

        d3.select("svg").data(props.visData);
        // union_annotation
        const container = svg.append("g").attr("class", "containerGroup");

        const zoom = (d3 as any)
          .zoom()
          .scaleExtent([0.1, 5])
          .on("zoom", function (event: any) {
            container.attr("transform", event.transform);
          });

        svg.call(zoom);

        const easyRenderNodes = (
          nodes: any,
          topNodes: any,
          keywordNodes: any,
        ) =>
          renderNodes(
            nodes,
            topNodes,
            keywordNodes,
            focus,
            unfocus,
            dragstarted,
            dragged,
            dragended,
          );

        container
          .append("svg:defs")
          .selectAll("marker")
          .data(["end"]) // Different link/path types can be defined here
          .enter()
          .append("marker") // This section adds in the arrows
          .attr("id", "arrowhead")
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 0)
          .attr("refY", 0)
          .attr("markerWidth", 6)
          .attr("markerHeight", 6)
          .attr("orient", "auto")
          .attr("xoverflow", "visible")
          .append("svg:path")
          .attr("d", "M 0,-5 L 10 ,0 L 0,5")
          .attr("fill", "#E5EAEB")
          .style("stroke", "none");

        container
          .append("g")
          .attr("class", "links")
          .selectAll("line")
          .data(topThreeHundredLinks, (data: any) => data.index)
          .enter()
          .append("line")
          .attr("stroke", "#E5EAEB")
          .attr("stroke-width", "1px")
          .attr("stroke-opacity", (d) => {
            return 1;
          })
          .attr("marker-end", "url(#arrowhead)");

        const linkLabelGroup = container
          .append("g")
          .attr("class", "linkLabels");

        const initTexts = linkLabelGroup
          .selectAll("text")
          .data(
            props.selectedId
              ? props.selectedId > 0
                ? topThreeHundredLinks.slice(
                    0,
                    topThreeHundredLinks.length / 10,
                  )
                : topThreeHundredLinks.slice(
                    0,
                    Math.max(1, topThreeHundredLinks.length / 10),
                  )
              : [],
            (link: any) => link.index,
          )
          .enter()
          .append("text")
          .text((d: any) => d.relation)
          .style("fill", "#012027")
          .style("opacity", 1)
          .style("font-size", 12)
          .style("pointer-events", "none");

        const initLines = linkLabelGroup
          .selectAll("line")
          .data(
            props.selectedId
              ? props.selectedId > 0
                ? topThreeHundredLinks.slice(
                    0,
                    topThreeHundredLinks.length / 10,
                  )
                : topThreeHundredLinks.slice(
                    0,
                    Math.max(1, topThreeHundredLinks.length / 10),
                  )
              : [],
            (link: any) => link.index,
          )
          .enter()
          .append("line");

        initTexts.each(function (d, i) {
          const bbox = this.getBBox();

          initLines
            .filter((_, j) => i === j)
            .attr("x1", bbox.x)
            .attr("y1", bbox.y + bbox.height + 1) // 调整线条的垂直位置
            .attr("x2", bbox.x + bbox.width)
            .attr("y2", bbox.y + bbox.height + 1)
            .style("stroke", "#bdbde9")
            .style("stroke-width", 1);
        });

        container
          .append("g")
          .attr("class", "nodes")
          .selectAll("circle")
          .data(topThreeHundredNodes, (data: any) => data.id)
          .enter()
          .append("circle")
          .attr("r", (d) => {
            return isNodeInsideSliceArray(topTenNodes, d)
              ? (d as any).radius
              : 12;
          })
          .style("opacity", 1)
          .attr("fill", (d: any) => {
            return getCategoryColor(d.category);
          })
          .on("mouseover", focus)
          .on("mouseout", unfocus)
          .on("click", (event: any, d: any) => {
            console.log("Clicked node:", d);
            console.log("Node category:", d.category);
            // Only trigger click event if the node has a valid category code
            if (d.category && ["A1", "A2", "A3", "B1", "B2", "B3", "C", "D"].includes(d.category)) {
              console.log("Valid category found:", d.category);
              props.handleClickedNode(d.id);
              props.addSlideBarChat(d.id, d.name);
              mutation.mutate({
                id: props.localUserId,
                content: d.name,
                time: new Date().toISOString(),
                type: "click"
              });
              setTooltipProps({
                x: event.offsetX,
                y: event.offsetY,
                title: d.name,
                content: d.name,
              });
            } else {
              console.log("Invalid or no category");
            }
          })
          .call(
            (d3 as any)
              .drag()
              .on("start", dragstarted)
              .on("drag", dragged)
              .on("end", dragended),
          );

        const labelGroup = container.append("g").attr("class", "labelNodes");

        const backgroundRects = labelGroup
          .selectAll("rect")
          .data(label.nodes, (data: any) => data.id)
          .enter()
          .append("rect")
          .attr("fill", "white")
          .attr("stroke", "#bdbde9")
          .attr("stroke-width", (d, i) => (i % 2 !== 0 ? 2 : 0))
          .attr("rx", (d, i) => (i % 2 !== 0 ? 4 : 0))
          .attr("ry", (d, i) => (i % 2 !== 0 ? 4 : 0));

        const textLabels = labelGroup
          .selectAll("text")
          .data(label.nodes, (data: any) => data.id)
          .enter()
          .append("text")
          .text((d: any, i) => {
            if (props.isOverview) {
              return i % 2 !== 0 &&
                isNodeInsideSliceArray(topThreeHundredNodes, d.node)
                ? d.node.name
                : "";
            } else {
              return i % 2 !== 0 ? d.node.name : "";
            }
          })
          .style("fill", "#012027")
          .style("opacity", 1)
          .style("font-size", 12)
          .style("pointer-events", "none");
        // to prevent mouseover/drag capture

        textLabels.each(function (d, i) {
          const bbox = this.getBBox();
          const padding = 4; // 文本周围的额外空间

          backgroundRects
            .filter((_, j) => i === j && j % 2 !== 0)
            .attr("x", bbox.x - padding / 2)
            .attr("y", bbox.y - padding / 2)
            .attr("width", bbox.width + padding)
            .attr("height", bbox.height + padding);
        });

        const neigh = (a: any, b: any) => {
          const start = a < b ? a : b;
          const end = a < b ? b : a;
          return a === b || (adjlist as any)[`${start}-${end}`];
        };

        function ticked() {
          d3.select("g.nodes").selectAll("circle").call(updateNode);
          d3.select("g.links").selectAll("line").call(updateLink);

          labelLayout.alphaTarget(0.2).restart();

          d3.select("g.labelNodes")
            .selectAll("text")
            .each(function (d: any, i) {
              if (i % 2 === 0) {
                d.x = d.node.x;
                d.y = d.node.y;
              } else {
                const b = (this as any).getBBox();

                const diffX = d.x - d.node.x;
                const diffY = d.y - d.node.y;

                const dist = Math.sqrt(diffX * diffX + diffY * diffY);

                let shiftX = (b.width * (diffX - dist)) / (dist * 2);
                shiftX = Math.max(-b.width, Math.min(0, shiftX));
                const shiftY = 16;

                (this as any).setAttribute(
                  "transform",
                  "translate(" + shiftX + "," + shiftY + ")",
                );
              }
            })
            .call(updateNode);

          d3.select("g.linkLabels").selectAll("text").call(updateLinkLabel);

          d3.select("g.linkLabels").selectAll("line").call(updateLinkLabel);

          d3.select("g.labelNodes").selectAll("rect").call(updateNode);
        }

        function focus(event: any, d: any) {
          const id = d.id;

          const relatedNodes = [d];

          let relatedLinks: any = [];

          graph.links.forEach((link: any) => {
            if (link.source.id === id) {
              relatedNodes.push(link.target);
              relatedLinks.push(link);
              return;
            }
            if (link.target.id === id) {
              relatedNodes.push(link.source);
              relatedLinks.push(link);
              return;
            }
          });

          relatedLinks = processDuplicates(relatedLinks);

          easyRenderNodes(relatedNodes, topTenNodes, props.keywordNodes);

          renderLinks(relatedLinks, updateLink);

          renderNodeLabels((d: any) =>
            neigh(id, d.node.id) ? "block" : "none",
          );

          if (props.selectedId !== id) {
            renderLinkLabels(relatedLinks);
          }
        }

        function unfocus() {
          const defaultDisplayLinks = props.selectedId
            ? props.selectedId > 0
              ? topThreeHundredLinks.slice(0, topThreeHundredLinks.length / 10)
              : topThreeHundredLinks.slice(
                  0,
                  Math.max(1, topThreeHundredLinks.length / 10),
                )
            : [];

          renderLinkLabels(defaultDisplayLinks);

          easyRenderNodes(
            topThreeHundredNodes,
            topTenNodes,
            props.keywordNodes,
          );

          renderLinks(topThreeHundredLinks, updateLink);

          renderNodeLabels("display");
        }

        function updateLink(link: any) {
          link
            .attr("x1", function (d: any) {
              const isSourceTopTen = isNodeInsideSliceArray(
                topTenNodes,
                d.source,
              );
              const r = isSourceTopTen ? d.source.radius : 12;
              return (
                d.source.x +
                ((d.target.x - d.source.x) /
                  Math.sqrt(
                    Math.pow(d.target.x - d.source.x, 2) +
                      Math.pow(d.target.y - d.source.y, 2),
                  )) *
                  r
              );
            })
            .attr("y1", function (d: any) {
              const isSourceTopTen = isNodeInsideSliceArray(
                topTenNodes,
                d.source,
              );
              const r = isSourceTopTen ? d.source.radius : 12;
              return (
                d.source.y +
                ((d.target.y - d.source.y) /
                  Math.sqrt(
                    Math.pow(d.target.x - d.source.x, 2) +
                      Math.pow(d.target.y - d.source.y, 2),
                  )) *
                  r
              );
            })
            .attr("x2", function (d: any) {
              const isTargetTopTen = isNodeInsideSliceArray(
                topTenNodes,
                d.target,
              );
              const r = isTargetTopTen ? d.source.radius - 3 : 12;
              return (
                d.target.x -
                ((d.target.x - d.source.x) /
                  Math.sqrt(
                    Math.pow(d.target.x - d.source.x, 2) +
                      Math.pow(d.target.y - d.source.y, 2),
                  )) *
                  r *
                  2
              );
            })
            .attr("y2", function (d: any) {
              const isTargetTopTen = isNodeInsideSliceArray(
                topTenNodes,
                d.target,
              );
              const r = isTargetTopTen ? d.source.radius - 3 : 12;
              return (
                d.target.y -
                ((d.target.y - d.source.y) /
                  Math.sqrt(
                    Math.pow(d.target.x - d.source.x, 2) +
                      Math.pow(d.target.y - d.source.y, 2),
                  )) *
                  r *
                  2
              );
            })
            .attr("marker-end", "url(#arrowhead)")
            .style("stroke-width", 2);
        }

        function dragstarted(event: any, d: any) {
          event.sourceEvent.stopPropagation();
          if (!event.active) graphLayout.alphaTarget(0.4).restart();
          d.fx = d.x;
          d.fy = d.y;
        }

        function dragged(event: any, d: any) {
          d.fx = event.x;
          d.fy = event.y;
        }

        function dragended(event: any, d: any) {
          if (!event.active) graphLayout.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
      }
    },

    /*
            useEffect has a dependency array (below). It's a list of dependency
            variables for this useEffect block. The block will run after mount
            and whenever any of these variables change. We still have to check
            if the variables are valid, but we do not have to compare old props
            to next props to decide whether to rerender.
        */
    [
      props.visData,
      props.isOverview,
      d3Container.current,
      props.keywordNodes,
      props.handleClickedNode,
    ],
  );

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
          setChats={props.setChats}
          setRecommendQuery={props.setRecommendQuery}
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
