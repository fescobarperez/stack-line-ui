import { useCallback, useMemo, useRef, useState } from 'react';

const defaultGetKey = (node) => String(node.id);

export function treeNodesInDisplayOrder(tree, rootId = 0) {
  const childrenByParent = new Map();
  tree.forEach((node) => {
    const parentKey = String(node.parent);
    const children = childrenByParent.get(parentKey) || [];
    children.push(node);
    childrenByParent.set(parentKey, children);
  });
  const ordered = [];
  const visit = (parentId) => {
    (childrenByParent.get(String(parentId)) || []).forEach((node) => {
      ordered.push(node);
      visit(node.id);
    });
  };
  visit(rootId);
  return ordered;
}

export default function useTreeSelection(nodes, {
  selectedKeys = [],
  onChange,
  getKey = defaultGetKey,
} = {}) {
  const [anchorKey, setAnchorKey] = useState(null);
  const focusKeyRef = useRef(null);
  const selectableNodes = useMemo(() => nodes, [nodes]);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const emit = useCallback((keys, primaryNode) => {
    onChange?.(keys, primaryNode);
  }, [onChange]);

  const select = useCallback((node, event) => {
    const key = getKey(node);
    focusKeyRef.current = key;
    const currentIndex = selectableNodes.findIndex((item) => getKey(item) === key);
    const anchorIndex = selectableNodes.findIndex((item) => getKey(item) === String(anchorKey));

    if (event.shiftKey && currentIndex >= 0 && anchorIndex >= 0) {
      const start = Math.min(currentIndex, anchorIndex);
      const end = Math.max(currentIndex, anchorIndex);
      emit(selectableNodes.slice(start, end + 1).map(getKey), node);
      focusKeyRef.current = key;
    } else if (event.metaKey || event.ctrlKey) {
      const next = new Set(selectedKeySet);
      if (next.has(key)) next.delete(key); else next.add(key);
      emit([...next], node);
      setAnchorKey(key);
    } else {
      emit([key], node);
      setAnchorKey(key);
    }
  }, [anchorKey, emit, getKey, selectableNodes, selectedKeySet]);

  const extend = useCallback((node, event) => {
    if (!event.shiftKey || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const currentKey = focusKeyRef.current || getKey(node);
    const currentIndex = selectableNodes.findIndex((item) => getKey(item) === currentKey);
    if (currentIndex < 0) return;
    const anchorIndex = selectableNodes.findIndex((item) => getKey(item) === String(anchorKey));
    const baseIndex = anchorIndex >= 0 ? anchorIndex : currentIndex;
    const nextIndex = Math.max(0, Math.min(
      selectableNodes.length - 1,
      currentIndex + (event.key === 'ArrowDown' ? 1 : -1),
    ));
    const nextNode = selectableNodes[nextIndex] || node;
    const start = Math.min(baseIndex, nextIndex);
    const end = Math.max(baseIndex, nextIndex);
    focusKeyRef.current = getKey(nextNode);
    emit(selectableNodes.slice(start, end + 1).map(getKey), nextNode);
    if (anchorIndex < 0) setAnchorKey(currentKey);
    event.preventDefault();
  }, [anchorKey, emit, getKey, selectableNodes]);

  return { select, extend, anchorKey };
}
