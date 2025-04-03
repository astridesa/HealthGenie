import { Node, Link } from '@/types/graph';

interface SubgraphData {
  nodes: Node[];
  links: Link[];
}

interface Subgraph {
  id: string;
  name: string;
  data: SubgraphData;
}

interface ProcessedData {
  subgraphs: Subgraph[];
  sharedNodes: Set<string>;
  sharedLinks: Set<string>;
}

export function processKnowledgeGraphData(csvData: any[]): ProcessedData {
  // Group data by subject (menu)
  const menuGroups = new Map<string, any[]>();
  
  csvData.forEach(row => {
    const menu = row.subject;
    if (!menuGroups.has(menu)) {
      menuGroups.set(menu, []);
    }
    menuGroups.get(menu)?.push(row);
  });

  // Create subgraphs
  const subgraphs: Subgraph[] = [];
  const nodeRegistry = new Map<string, Node>();
  const linkRegistry = new Map<string, Link>();
  const sharedNodes = new Set<string>();
  const sharedLinks = new Set<string>();

  // Process each menu group
  menuGroups.forEach((rows, menu) => {
    const subgraphNodes: Node[] = [];
    const subgraphLinks: Link[] = [];

    // Process nodes and links for this subgraph
    rows.forEach(row => {
      // Process subject (menu) node
      if (!nodeRegistry.has(row.subject)) {
        const menuNode: Node = {
          id: parseInt(row.subject_id) || 0,  // Use backend ID
          chinese: row.subject,
          name: row.subject,
          category: 'menu',
          isShared: false
        };
        nodeRegistry.set(row.subject, menuNode);
        subgraphNodes.push(menuNode);
      }

      // Process object node
      if (!nodeRegistry.has(row.object)) {
        const objectNode: Node = {
          id: parseInt(row.object_id) || 0,  // Use backend ID
          chinese: row.object,
          name: row.object,
          category: row.cat,
          isShared: false
        };
        nodeRegistry.set(row.object, objectNode);
        subgraphNodes.push(objectNode);
      }

      // Create link
      const sourceNode = nodeRegistry.get(row.subject);
      const targetNode = nodeRegistry.get(row.object);
      if (sourceNode && targetNode) {
        const linkKey = `${sourceNode.id}-${targetNode.id}-${row.relation}`;
        if (!linkRegistry.has(linkKey)) {
          const link: Link = {
            source: sourceNode.id,
            target: targetNode.id,
            relation: row.relation,
            isShared: false
          };
          linkRegistry.set(linkKey, link);
          subgraphLinks.push(link);
        }
      }
    });

    subgraphs.push({
      id: menu,
      name: menu,
      data: {
        nodes: subgraphNodes,
        links: subgraphLinks
      }
    });
  });

  // Identify shared nodes and links
  const nodeCount = new Map<string, number>();
  const linkCount = new Map<string, number>();

  nodeRegistry.forEach((node, key) => {
    const count = subgraphs.filter(sg => 
      sg.data.nodes.some(n => n.chinese === node.chinese)
    ).length;
    nodeCount.set(key, count);
    if (count > 1) {
      sharedNodes.add(key);
      node.isShared = true;
    }
  });

  linkRegistry.forEach((link, key) => {
    const count = subgraphs.filter(sg =>
      sg.data.links.some(l => 
        l.source === link.source && 
        l.target === link.target && 
        l.relation === link.relation
      )
    ).length;
    linkCount.set(key, count);
    if (count > 1) {
      sharedLinks.add(key);
      link.isShared = true;
    }
  });

  return {
    subgraphs,
    sharedNodes,
    sharedLinks
  };
}

export function combineSubgraphs(subgraphs: Subgraph[], selectedIndices: number[]): SubgraphData {
  const combinedNodes: Node[] = [];
  const combinedLinks: Link[] = [];
  const nodeMap = new Map<string, Node>();

  // Process selected subgraphs
  selectedIndices.forEach(index => {
    const subgraph = subgraphs[index];
    
    // Add nodes
    subgraph.data.nodes.forEach(node => {
      if (!nodeMap.has(node.chinese)) {
        nodeMap.set(node.chinese, { ...node });
        combinedNodes.push(node);
      }
    });

    // Add links
    subgraph.data.links.forEach(link => {
      const sourceNode = nodeMap.get(subgraph.data.nodes.find(n => n.id === link.source)?.chinese || '');
      const targetNode = nodeMap.get(subgraph.data.nodes.find(n => n.id === link.target)?.chinese || '');
      
      if (sourceNode && targetNode) {
        combinedLinks.push({
          source: sourceNode.id,
          target: targetNode.id,
          relation: link.relation,
          isShared: link.isShared
        });
      }
    });
  });

  return {
    nodes: combinedNodes,
    links: combinedLinks
  };
} 