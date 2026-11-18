"use client";

import React, { useCallback } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
} from "reactflow";
import "reactflow/dist/style.css";

// 初始节点
const initialNodes: Node[] = [
  { id: "1", data: { label: "主问题" }, position: { x: 250, y: 50 } },
  { id: "2", data: { label: "分支 1" }, position: { x: 100, y: 200 } },
  { id: "3", data: { label: "分支 2" }, position: { x: 400, y: 200 } },
];

// 初始连接线
const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2", type: "smoothstep" },
  { id: "e1-3", source: "1", target: "3", type: "smoothstep" },
];

const FlowDiagram = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 处理连接新节点
  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [],
  );

  return (
    <div className="w-[700px] h-screen bg-gray-50 p-4">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        {/* <MiniMap /> */}
        {/* <Controls /> */}
        <Background />
      </ReactFlow>
    </div>
  );
};

export default FlowDiagram;
