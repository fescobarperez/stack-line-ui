// Stackline — Icon (Material Symbols Outlined)
// Migración M3: reemplaza el set SVG stroked por la fuente variable
// Material Symbols. Mantiene la MISMA firma pública que el Icon anterior
// (<Icon name="..." size={14} />) mapeando los nombres legacy a los de M3.
import React from 'react';

// Mapa nombres legacy → Material Symbols Outlined
const MAP = {
  dashboard: 'space_dashboard',
  pos: 'point_of_sale',
  box: 'inventory_2',
  folder: 'folder',
  receipt: 'receipt_long',
  chart: 'monitoring',
  settings: 'tune',
  user: 'person',
  users: 'group',
  supplier: 'local_shipping',
  search: 'search',
  plus: 'add',
  minus: 'remove',
  x: 'close',
  close: 'close',
  check: 'check',
  chevronDown: 'expand_more',
  chevronRight: 'chevron_right',
  chevronLeft: 'chevron_left',
  bell: 'notifications',
  cash: 'payments',
  card: 'credit_card',
  transfer: 'swap_horiz',
  print: 'print',
  download: 'download',
  upload: 'upload',
  copy: 'content_copy',
  edit: 'edit',
  trash: 'delete',
  alert: 'warning',
  barcode: 'barcode',
  calendar: 'calendar_month',
  clock: 'schedule',
  arrowUp: 'arrow_upward',
  arrowDown: 'arrow_downward',
  refresh: 'refresh',
  filter: 'filter_list',
  branch: 'account_tree',
  shield: 'shield',
  return: 'undo',
  tag: 'sell',
  moon: 'dark_mode',
  menu: 'menu',
  dots: 'more_vert',
  lock: 'lock',
  eye: 'visibility',
  bolt: 'bolt',
  truck: 'local_shipping',
};

const Icon = ({ name, size = 14, fill = false, className = "", style }) => {
  const symbol = MAP[name] || name;
  const cls = `msi${fill ? " fill" : ""}${className ? " " + className : ""}`;
  return (
    <span
      className={cls}
      aria-hidden="true"
      style={{ fontSize: size, ...style }}
    >
      {symbol}
    </span>
  );
};

export { Icon };
export default Icon;
