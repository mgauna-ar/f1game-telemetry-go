import React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { cx } from './cx';
import styles from './DataTable.module.css';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string = string> {
  key: K;
  direction: SortDirection;
}

export interface DataTableColumn<Row> {
  key: string;
  header: React.ReactNode;
  cell: (row: Row, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  /** Monospace with tabular figures, for times, laps and positions. */
  numeric?: boolean;
  /** Show a sort button in the header; the parent sorts the rows. */
  sortable?: boolean;
  /** Column width, such as `'70px'` or `'10%'`. */
  width?: string;
  /** Render the cell as the row's header (`<th scope="row">`), usually the driver or session name. */
  rowHeader?: boolean;
  className?: string;
}

/** A run of rows under a heading row, rendered as its own `<tbody>`. */
export interface DataTableGroup<Row> {
  key: React.Key;
  /** The heading row's content, such as the day and how many sessions it has. */
  header: React.ReactNode;
  rows: ReadonlyArray<Row>;
  /** Show only the heading row. */
  collapsed?: boolean;
}

export interface DataTableProps<Row> {
  columns: ReadonlyArray<DataTableColumn<Row>>;
  rows: ReadonlyArray<Row>;
  getRowKey: (row: Row, index: number) => React.Key;
  /** Names the table. Visually hidden unless `showCaption`. */
  caption: React.ReactNode;
  showCaption?: boolean;
  sort?: SortState | null;
  onSortChange?: (key: string) => void;
  /** Shown in place of the rows when there are none. */
  empty?: React.ReactNode;
  /** Extra class names per row, such as a selected or player highlight. */
  getRowClassName?: (row: Row) => string | undefined;
  /**
   * A mouse shortcut for the row. The row must also hold a button or link that does the same,
   * because a table row can't take keyboard focus.
   */
  onRowClick?: (row: Row) => void;
  /**
   * Rows in groups, each under a full-width heading row (`<th scope="rowgroup">`). When set, it
   * is rendered instead of `rows`; `rows` still decides whether the table is empty.
   */
  groups?: ReadonlyArray<DataTableGroup<Row>>;
  groupHeaderClassName?: string;
  /** A full-width row under a row, such as a driver's laps; return nothing to leave it out. */
  renderExpanded?: (row: Row) => React.ReactNode;
  stickyHeader?: boolean;
  density?: 'normal' | 'compact';
  className?: string;
  tableClassName?: string;
}

const ariaSort = (column: string, sort?: SortState | null): React.AriaAttributes['aria-sort'] => {
  if (!sort || sort.key !== column) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
};

/**
 * A data table with real table semantics: a caption, column headers with `aria-sort` and sort
 * buttons, optional row headers, and numeric columns in tabular figures.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  caption,
  showCaption = false,
  sort,
  onSortChange,
  empty,
  getRowClassName,
  onRowClick,
  renderExpanded,
  groups,
  groupHeaderClassName,
  stickyHeader = false,
  density = 'normal',
  className,
  tableClassName,
}: DataTableProps<Row>): React.ReactElement {
  const alignOf = (column: DataTableColumn<Row>) => styles[column.align ?? (column.numeric ? 'right' : 'left')];

  const renderRows = (rows: ReadonlyArray<Row>) =>
    rows.map((row, index) => {
      const expanded = renderExpanded?.(row);
      return (
        <React.Fragment key={getRowKey(row, index)}>
          <tr
            className={cx(styles.row, onRowClick && styles.clickable, getRowClassName?.(row))}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((column) => {
              const Cell = column.rowHeader ? 'th' : 'td';
              return (
                <Cell
                  key={column.key}
                  scope={column.rowHeader ? 'row' : undefined}
                  className={cx(styles.td, alignOf(column), column.numeric && styles.numeric, column.className)}
                >
                  {column.cell(row, index)}
                </Cell>
              );
            })}
          </tr>
          {expanded && (
            <tr>
              <td colSpan={columns.length} className={styles.expanded}>
                {expanded}
              </td>
            </tr>
          )}
        </React.Fragment>
      );
    });

  return (
    <div className={cx(styles.wrap, className)}>
      <table
        className={cx(
          styles.table,
          stickyHeader && styles.sticky,
          density === 'compact' && styles.compact,
          tableClassName
        )}
      >
        <caption className={showCaption ? styles.caption : 'sr-only'}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = column.sortable && onSortChange;
              const state = ariaSort(column.key, sort);
              const SortIcon = state === 'ascending' ? ArrowUp : state === 'descending' ? ArrowDown : ChevronsUpDown;
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={sortable ? state : undefined}
                  className={cx(styles.th, alignOf(column), column.className)}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className={cx('button-reset', styles.sortButton)}
                      onClick={() => onSortChange(column.key)}
                    >
                      {column.header}
                      <SortIcon size={12} className={styles.sortIcon} aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        {groups && rows.length > 0 ? (
          groups.map((group) => (
            <tbody key={group.key}>
              <tr className={groupHeaderClassName}>
                <th scope="rowgroup" colSpan={columns.length} className={styles.groupHeader}>
                  {group.header}
                </th>
              </tr>
              {!group.collapsed && renderRows(group.rows)}
            </tbody>
          ))
        ) : (
          <tbody>
            {rows.length === 0 && empty ? (
              <tr>
                <td colSpan={columns.length} className={styles.empty}>
                  {empty}
                </td>
              </tr>
            ) : (
              renderRows(rows)
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}
