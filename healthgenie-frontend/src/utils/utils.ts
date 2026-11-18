export const findIndexOfNodes = (nodes: any, selectedId: any) => {
  return nodes.findIndex((el: any) => el.id === selectedId);
};

export const addFrequencyToNode = (graph: any) => {
  const { nodes, links } = graph;
  // add 0 to those who are alone
  nodes.forEach((node: any) => {
    node.frequency = 0;
  });

  links.forEach(({ source, target }: any) => {
    nodes[findIndexOfNodes(nodes, source.id ? source.id : source)].frequency++;
    nodes[findIndexOfNodes(nodes, target.id ? target.id : target)].frequency++;
  });

  return { nodes, links };
};

const calculateNodeRadius = (frequency: any) => {
  return Math.min(18 + Math.floor(frequency / 20), 24);
};

export const addRadiusToNode = (graph: any) => {
  graph.nodes.forEach((node: any) => {
    node["radius"] = calculateNodeRadius(node.frequency);
  });

  return graph;
};

export const getOverallFrequencyList = (nodes: any) => {
  return [...new Set<any>(nodes.map((node: any) => node.frequency))];
};

export const sortNodesByFrequency = (nodes: any) => {
  return nodes.sort((a: any, b: any) => (a.frequency < b.frequency ? 1 : -1));
};

export const isNodeInsideSliceArray = (slicedArray: any, node: any) => {
  return slicedArray.findIndex((el: any) => el.id === node.id) !== -1;
};

export const isSubset = (array1: any, array2: any) =>
  array1.every((element: any) => array2.includes(element));

export const generateMentionedDataset = (mentionedNodes: any[], data: any) => {
  // Create a Set of mentioned node IDs for faster lookup
  const mentionedNodeIds = new Set(mentionedNodes.map(node => node.id));

  // Filter nodes to only include mentioned nodes
  const filteredNodes = data.nodes.filter((node: any) => 
    mentionedNodeIds.has(node.id)
  );

  // Filter links to only include those connected to mentioned nodes
  const filteredLinks = data.links.filter((link: any) => 
    mentionedNodeIds.has(link.source) && mentionedNodeIds.has(link.target)
  );

  return {
    nodes: filteredNodes,
    links: filteredLinks
  };
};

export const generateSelectedDataset = (selectedId: number, data: any) => {
  // Create a Set of selected node ID for faster lookup
  const selectedNodeId = new Set([selectedId]);

  // Find all connected nodes
  const connectedNodeIds = new Set([selectedId]);
  let changed = true;

  while (changed) {
    changed = false;
    data.links.forEach((link: any) => {
      if (connectedNodeIds.has(link.source) && !connectedNodeIds.has(link.target)) {
        connectedNodeIds.add(link.target);
        changed = true;
      }
      if (connectedNodeIds.has(link.target) && !connectedNodeIds.has(link.source)) {
        connectedNodeIds.add(link.source);
        changed = true;
      }
    });
  }

  // Filter nodes to only include connected nodes
  const filteredNodes = data.nodes.filter((node: any) => 
    connectedNodeIds.has(node.id)
  );

  // Filter links to only include those between connected nodes
  const filteredLinks = data.links.filter((link: any) => 
    connectedNodeIds.has(link.source) && connectedNodeIds.has(link.target)
  );

  return {
    nodes: filteredNodes,
    links: filteredLinks
  };
};
