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
  stickyHeader = false,
  density = 'normal',
  className,
  tableClassName,
}: DataTableProps<Row>): React.ReactElement {
  const alignOf = (column: DataTableColumn<Row>) => styles[column.align ?? (column.numeric ? 'right' : 'left')];

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
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={getRowKey(row, index)}
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
