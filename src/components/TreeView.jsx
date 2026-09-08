import React from 'react';
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
  return (
    <div className={`${styles.root} ${className}`.trim()}>
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
