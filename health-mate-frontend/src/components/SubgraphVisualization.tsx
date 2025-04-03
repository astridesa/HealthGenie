import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Node, Link } from '@/types/graph';
import { getNodeColor } from '@/utils/colors';

interface SubgraphVisualizationProps {
  data: {
    nodes: Node[];
    links: Link[];
  };
  width: number;
  height: number;
  onNodeClick?: (node: Node) => void;
  onNodeHover?: (node: Node | null) => void;
}

const SubgraphVisualization: React.FC<SubgraphVisualizationProps> = ({
  data,
  width,
  height,
  onNodeClick,
  onNodeHover
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height);

    // Create simulation
    const simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink<d3.SimulationNodeDatum, d3.SimulationLinkDatum<d3.SimulationNodeDatum>>(data.links)
        .id((d: any) => d.id)
        .distance((d: any) => {
          // Adjust link distance for shared nodes
          return d.source.isShared || d.target.isShared ? 100 : 80;
        }))
      .force('charge', d3.forceManyBody()
        .strength((d: any) => {
          // Adjust repulsion for shared nodes
          return d.isShared ? -200 : -100;
        }))
      .force('center', d3.forceCenter(width / 2, height / 2));

    // Create links
    const links = svg.append('g')
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-width', (d: any) => d.isShared ? 2 : 1)
      .attr('stroke-dasharray', (d: any) => d.isShared ? '5,5' : 'none');

    // Create nodes
    const nodes = svg.append('g')
      .selectAll('g')
      .data(data.nodes)
      .enter()
      .append('g')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    // Add circles to nodes
    nodes.append('circle')
      .attr('r', (d: any) => d.isShared ? 8 : 6)
      .attr('fill', (d: any) => getNodeColor(d.category))
      .attr('stroke', '#000')
      .attr('stroke-width', (d: any) => d.isShared ? 2 : 1)
      .attr('stroke-dasharray', (d: any) => d.isShared ? '5,5' : 'none');

    // Add labels to nodes
    nodes.append('text')
      .attr('dy', 4)
      .attr('text-anchor', 'middle')
      .text((d: any) => d.chinese)
      .style('font-size', '12px')
      .style('pointer-events', 'none');

    // Add event listeners
    nodes
      .on('click', (event: any, d: Node) => onNodeClick?.(d))
      .on('mouseover', (event: any, d: Node) => {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('r', (d: any) => d.isShared ? 10 : 8)
          .attr('stroke-width', 3);
        onNodeHover?.(d);
      })
      .on('mouseout', (event: any, d: Node) => {
        d3.select(event.currentTarget)
          .transition()
          .duration(200)
          .attr('r', (d: any) => d.isShared ? 8 : 6)
          .attr('stroke-width', (d: any) => d.isShared ? 2 : 1);
        onNodeHover?.(null);
      });

    // Update positions on each tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Drag functions
    function dragStarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragEnded(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [data, width, height, onNodeClick, onNodeHover]);

  return (
    <svg
      ref={svgRef}
      style={{
        width: '100%',
        height: '100%',
        border: '1px solid #ddd',
        borderRadius: '4px'
      }}
    />
  );
};

export default SubgraphVisualization; 