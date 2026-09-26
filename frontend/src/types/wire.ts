/**
 * A wire type the UI narrows, for example a Go `string` the dashboard only accepts as a union of
 * known values. The constraint makes `tsc` check that T still fits the generated Go type Base, so a
 * field renamed or retyped in Go breaks the build here too.
 */
export type Narrows<T extends Base, Base> = T;
