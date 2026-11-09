import React, { useCallback, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { getBackendOptions, MultiBackend, Tree } from '@minoru/react-dnd-treeview';
import styles from './TreeView.module.css';
import Icon from './Icon.jsx';

function defaultDragPreview({ item }) {
  const isFolder = ['category', 'group'].includes(item?.data?.kind);
  return (
    <div className={styles.dragPreview}>
      <Icon name={isFolder ? 'folder' : 'box'} size={16} />
      {item?.text}
    </div>
  );
}

function findScrollContainer(element) {
  let current = element;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current;
    current = current.parentElement;
  }
  return element;
}

export default function TreeView({
  className = '',
  tree,
  rootId = 0,
  initialOpen = true,
  sort = false,
  insertDroppableFirst = false,
  dropTargetOffset = 0,
  canDrag,
  canDrop,
  onDrop,
  render,
  dragPreviewRender = defaultDragPreview,
}) {
  const rootRef = useRef(null);
  const scrollDirectionRef = useRef(0);
  const scrollFrameRef = useRef(null);

  const stopAutoScroll = useCallback(() => {
    scrollDirectionRef.current = 0;
    if (scrollFrameRef.current != null) cancelAnimationFrame(scrollFrameRef.current);
    scrollFrameRef.current = null;
  }, []);

  const startAutoScroll = useCallback(() => {
    if (scrollFrameRef.current != null) return;
    const step = () => {
      const container = findScrollContainer(rootRef.current);
      const direction = scrollDirectionRef.current;
      if (!container || direction === 0) {
        scrollFrameRef.current = null;
        return;
      }
      const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
      const nextTop = Math.max(0, Math.min(maxTop, container.scrollTop + direction * 12));
      if (nextTop === container.scrollTop) {
        scrollFrameRef.current = null;
        return;
      }
      container.scrollTop = nextTop;
      scrollFrameRef.current = requestAnimationFrame(step);
    };
    scrollFrameRef.current = requestAnimationFrame(step);
  }, []);

  const handleDragOver = useCallback((event) => {
    const root = rootRef.current;
    const container = root && findScrollContainer(root);
    if (!root || !container) return;
    const rect = container.getBoundingClientRect();
    const edge = Math.min(72, rect.height / 3);
    const direction = event.clientY <= rect.top + edge ? -1
      : event.clientY >= rect.bottom - edge ? 1 : 0;
    scrollDirectionRef.current = direction;
    if (direction !== 0) {
      event.preventDefault();
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }, [startAutoScroll, stopAutoScroll]);

  useEffect(() => () => stopAutoScroll(), [stopAutoScroll]);

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className}`.trim()}
      onDragOver={handleDragOver}
      onDragLeave={stopAutoScroll}
      onDrop={stopAutoScroll}
    >
      <DndProvider backend={MultiBackend} options={getBackendOptions()}>
        <Tree
          tree={tree}
          rootId={rootId}
          initialOpen={initialOpen}
          sort={sort}
          insertDroppableFirst={insertDroppableFirst}
          dropTargetOffset={dropTargetOffset}
          canDrag={canDrag}
          canDrop={canDrop}
          onDrop={onDrop}
          render={render}
          dragPreviewRender={dragPreviewRender}
        />
      </DndProvider>
    </div>
  );
}
