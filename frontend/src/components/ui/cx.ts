/** Joins the class names that are set: `cx(styles.row, isActive && styles.active)`. */
export const cx = (...names: Array<string | false | null | undefined>): string => names.filter(Boolean).join(' ');
