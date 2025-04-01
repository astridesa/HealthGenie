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

export const generateMentionedDataset = (mentionedNodes: any, rawData: any) => {
  const { nodes, links } = rawData;

  const newNodes: any = [],
    newLinks: any = [];

  const allIds = mentionedNodes.map((node: any) => node.id);

  links.forEach((link: any) => {
    const sourceTargetIds = [link.source.id, link.target.id];
    const mentionedNodeIds = mentionedNodes.map((node: any) => node.id);
    if (isSubset(sourceTargetIds, mentionedNodeIds)) {
      newLinks.push(link);
    }
  });

  const uniqueIds = [...new Set(allIds)];
  uniqueIds.forEach((uniqueId) => {
    const uniqueNode = nodes.find((node: any) => node.id === uniqueId);
    newNodes.push(uniqueNode);
  });
  return {
    nodes: newNodes,
    links: newLinks,
  };
};

export const generateSelectedDataset = (selectedId: any, rawData: any) => {
  const { nodes, links } = rawData;

  const newNodes: any = [],
    newLinks: any = [],
    allIds: any = [];

  links.forEach((link: any) => {
    if (link.source.id === selectedId || link.target.id === selectedId) {
      newLinks.push(link);
      allIds.push(link.source.id, link.target.id);
    }
  });

  const uniqueIds = [...new Set(allIds)];
  uniqueIds.forEach((uniqueId) => {
    const uniqueNode = nodes.find((node: any) => node.id === uniqueId);
    newNodes.push(uniqueNode);
  });
  return {
    nodes: newNodes,
    links: newLinks,
  };
};
