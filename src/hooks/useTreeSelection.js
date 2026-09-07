import { useCallback, useMemo, useState } from 'react';

const defaultGetKey = (node) => String(node.id);

export default function useTreeSelection(nodes, {
  selectedKeys = [],
  onChange,
  getKey = defaultGetKey,
} = {}) {
  const [anchorKey, setAnchorKey] = useState(null);
  const selectableNodes = useMemo(() => nodes, [nodes]);
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const emit = useCallback((keys, primaryNode) => {
    onChange?.(keys, primaryNode);
  }, [onChange]);

  const select = useCallback((node, event) => {
    const key = getKey(node);
    const currentIndex = selectableNodes.findIndex((item) => getKey(item) === key);
    const anchorIndex = selectableNodes.findIndex((item) => getKey(item) === String(anchorKey));

    if (event.shiftKey && currentIndex >= 0 && anchorIndex >= 0) {
      const start = Math.min(currentIndex, anchorIndex);
      const end = Math.max(currentIndex, anchorIndex);
      emit(selectableNodes.slice(start, end + 1).map(getKey), node);
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
    const currentIndex = selectableNodes.findIndex((item) => getKey(item) === getKey(node));
    if (currentIndex < 0) return;
    const anchorIndex = selectableNodes.findIndex((item) => getKey(item) === String(anchorKey));
    const baseIndex = anchorIndex >= 0 ? anchorIndex : currentIndex;
    const nextIndex = Math.max(0, Math.min(
      selectableNodes.length - 1,
      currentIndex + (event.key === 'ArrowDown' ? 1 : -1),
    ));
    const start = Math.min(baseIndex, nextIndex);
    const end = Math.max(baseIndex, nextIndex);
    emit(selectableNodes.slice(start, end + 1).map(getKey), selectableNodes[nextIndex] || node);
    if (anchorIndex < 0) setAnchorKey(getKey(node));
    event.preventDefault();
  }, [anchorKey, emit, getKey, selectableNodes]);

  return { select, extend, anchorKey };
}
