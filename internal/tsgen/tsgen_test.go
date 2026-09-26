package tsgen

import (
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"
)

type Base struct {
	Saved bool `json:"saved"`
}

type Sample struct {
	Base
	Name      string    `json:"name"`
	Count     int64     `json:"count"`
	Ratio     float32   `json:"ratio"`
	On        bool      `json:"on"`
	When      time.Time `json:"when"`
	Blob      []byte    `json:"blob"`
	Skipped   string    `json:"-"`
	hidden    string    //nolint:unused // proves unexported fields are skipped
	Untagged  uint8
	Opt       string            `json:"opt,omitempty"`
	OptPtr    *int              `json:"opt_ptr,omitempty"`
	NullPtr   *int              `json:"null_ptr"`
	List      []Nested          `json:"list"`
	Fixed     [4]uint8          `json:"fixed"`
	Ptrs      []*int            `json:"ptrs"`
	Dict      map[string]*int   `json:"dict"`
	Any       any               `json:"any"`
	Raw       json.RawMessage   `json:"raw"`
	Override  string            `json:"override" tstype:"'a' | 'b'"`
	Dashed    int               `json:"x-y"`
	ByInt     map[int]string    `json:"by_int"`
	NamedStr  kind              `json:"named_str"`
	Nested    Nested            `json:"nested"`
	NestedPtr *Nested           `json:"nested_ptr,omitempty"`
	Labels    map[string]string `json:"labels,omitempty"`
}

type kind string

type Nested struct {
	ID int `json:"id"`
}

func generate(t *testing.T, g *Generator) map[string]string {
	t.Helper()
	files, err := g.Generate()
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	out := map[string]string{}
	for name, content := range files {
		out[name] = string(content)
	}
	return out
}

func TestFieldMapping(t *testing.T) {
	src := generate(t, New().Add(Sample{}))["tsgen.ts"]
	tests := []struct {
		name string
		want string
	}{
		{"embedded struct becomes extends", "export interface Sample extends Base {"},
		{"string", "  name: string;"},
		{"int64", "  count: number;"},
		{"float32", "  ratio: number;"},
		{"bool", "  on: boolean;"},
		{"time.Time", "  when: string;"},
		{"[]byte is base64", "  blob: string;"},
		{"untagged field keeps the Go name", "  Untagged: number;"},
		{"omitempty is optional", "  opt?: string;"},
		{"omitempty pointer is optional, not null", "  opt_ptr?: number;"},
		{"pointer without omitempty is nullable", "  null_ptr: number | null;"},
		{"slice of structs", "  list: Nested[];"},
		{"fixed array", "  fixed: number[];"},
		{"slice of pointers", "  ptrs: (number | null)[];"},
		{"map of pointers", "  dict: Record<string, number | null>;"},
		{"interface", "  any: unknown;"},
		{"json.RawMessage", "  raw: unknown;"},
		{"tstype tag", "  override: 'a' | 'b';"},
		{"non-identifier property is quoted", `  "x-y": number;`},
		{"int map keys are strings", "  by_int: Record<string, string>;"},
		{"named string type", "  named_str: string;"},
		{"nested struct", "  nested: Nested;"},
		{"optional pointer to struct", "  nested_ptr?: Nested;"},
		{"referenced struct is declared", "export interface Nested {\n  id: number;\n}"},
		{"embedded struct is declared", "export interface Base {\n  saved: boolean;\n}"},
		{"Go name comment", "/** Go: tsgen.Sample */"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.Contains(src, tt.want) {
				t.Errorf("missing %q in:\n%s", tt.want, src)
			}
		})
	}
	for _, absent := range []string{"Skipped", "hidden"} {
		if strings.Contains(src, absent+":") {
			t.Errorf("%q should not be generated", absent)
		}
	}
	if !strings.HasPrefix(src, Header) {
		t.Errorf("file does not start with the generated header")
	}
}

type custom struct {
	A int `json:"a"`
}

func (c custom) MarshalJSON() ([]byte, error) { return json.Marshal(map[string]int{"b": c.A}) }

type customWire struct {
	B int `json:"b"`
}

type HasCustom struct {
	C custom `json:"c"`
}

type textKey struct{}

func (textKey) MarshalText() ([]byte, error) { return []byte("x"), nil }

type HasText struct {
	T textKey `json:"t"`
}

type Anonymous struct {
	S struct{ X int } `json:"s"`
}

func TestRejectsWhatItCannotDescribe(t *testing.T) {
	tests := []struct {
		name string
		gen  *Generator
		want string
	}{
		{"unregistered MarshalJSON", New().Add(HasCustom{}), "register it with Marshaler"},
		{"unregistered MarshalText", New().Add(HasText{}), "register it with Marshaler"},
		{"anonymous struct", New().Add(Anonymous{}), "only named"},
		{"union member not generated", New().Union("tsgen", "U", Nested{}), "is not generated"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tt.gen.Generate()
			if err == nil || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("got error %v, want one containing %q", err, tt.want)
			}
		})
	}
}

func TestRegisteredMarshalerUsesWireType(t *testing.T) {
	src := generate(t, New().Marshaler(custom{}, customWire{}).Add(HasCustom{}))["tsgen.ts"]
	for _, want := range []string{"  c: customWire;", "export interface customWire {\n  b: number;\n}"} {
		if !strings.Contains(src, want) {
			t.Errorf("missing %q in:\n%s", want, src)
		}
	}
}

type Tagged struct {
	Type string `json:"type" tstype:"'tagged'"`
}

func TestUnion(t *testing.T) {
	src := generate(t, New().Add(Tagged{}, Nested{}).Union("tsgen", "Message", Tagged{}, Nested{}))["tsgen.ts"]
	if !strings.Contains(src, "export type Message = Tagged | Nested;") {
		t.Errorf("union missing in:\n%s", src)
	}
}

func TestJSONFields(t *testing.T) {
	fields, err := JSONFields(reflect.TypeFor[Sample]())
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, f := range fields {
		got[f.Name] = f.Optional
	}
	for name, optional := range map[string]bool{"saved": false, "name": false, "opt": true, "Untagged": false} {
		if o, ok := got[name]; !ok || o != optional {
			t.Errorf("field %s: got present=%v optional=%v, want optional=%v", name, ok, o, optional)
		}
	}
	if _, ok := got["Skipped"]; ok {
		t.Error("json:\"-\" field listed")
	}
}

type WithRows struct {
	Rows []map[string]any `json:"rows" tstype:"Row[]"`
}

func TestTypeAlias(t *testing.T) {
	src := generate(t, New().Add(WithRows{}).TypeAlias("tsgen", "Row", "{ [key: string]: number }"))["tsgen.ts"]
	for _, want := range []string{"  rows: Row[];", "export type Row = { [key: string]: number };"} {
		if !strings.Contains(src, want) {
			t.Errorf("missing %q in:\n%s", want, src)
		}
	}
	_, err := New().Add(Nested{}).TypeAlias("tsgen", "Nested", "number").Generate()
	if err == nil || !strings.Contains(err.Error(), "declared twice") {
		t.Errorf("an alias named like a generated type should fail, got %v", err)
	}
}
