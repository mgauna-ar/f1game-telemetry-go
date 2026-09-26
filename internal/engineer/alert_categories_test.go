package engineer

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// emittedSubAlerts returns every sub_alert the engine can send: the SubAlert values written in
// this package's directives, plus each rule's alert keys, which the engine sends when a directive
// leaves SubAlert empty.
func emittedSubAlerts(t *testing.T) map[string]bool {
	t.Helper()
	keys := make(map[string]bool)
	for _, rule := range NewEngineerEngine(nil).rules {
		for k := range rule.AlertKeys() {
			keys[k] = true
		}
	}

	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatalf("list engineer sources: %v", err)
	}
	fset := token.NewFileSet()
	for _, name := range files {
		if strings.HasSuffix(name, "_test.go") {
			continue
		}
		file, err := parser.ParseFile(fset, name, nil, 0)
		if err != nil {
			t.Fatalf("parse %s: %v", name, err)
		}
		for _, v := range subAlertLiterals(t, fset, file) {
			keys[v] = true
		}
	}
	return keys
}

// subAlertLiterals returns the strings a file writes to a SubAlert field, either directly or
// through a local variable assigned only string literals.
func subAlertLiterals(t *testing.T, fset *token.FileSet, file *ast.File) []string {
	t.Helper()
	assigned := make(map[string][]string)
	ast.Inspect(file, func(n ast.Node) bool {
		if assign, ok := n.(*ast.AssignStmt); ok && len(assign.Lhs) == len(assign.Rhs) {
			for i, lhs := range assign.Lhs {
				if id, ok := lhs.(*ast.Ident); ok {
					if s, ok := stringLiteral(assign.Rhs[i]); ok {
						assigned[id.Name] = append(assigned[id.Name], s)
					}
				}
			}
		}
		return true
	})

	var values []string
	ast.Inspect(file, func(n ast.Node) bool {
		kv, ok := n.(*ast.KeyValueExpr)
		if !ok {
			return true
		}
		if key, ok := kv.Key.(*ast.Ident); !ok || key.Name != "SubAlert" {
			return true
		}
		if s, ok := stringLiteral(kv.Value); ok {
			values = append(values, s)
		} else if id, ok := kv.Value.(*ast.Ident); ok && len(assigned[id.Name]) > 0 {
			values = append(values, assigned[id.Name]...)
		} else {
			t.Errorf("%s: SubAlert must be a string literal or a variable assigned literals, so this test can list it", fset.Position(kv.Pos()))
		}
		return true
	})
	return values
}

func stringLiteral(expr ast.Expr) (string, bool) {
	lit, ok := expr.(*ast.BasicLit)
	if !ok || lit.Kind != token.STRING {
		return "", false
	}
	s, err := strconv.Unquote(lit.Value)
	return s, err == nil
}

func TestRadioAlertKeys_MatchWhatTheEngineEmits(t *testing.T) {
	listed := make(map[string]bool, len(RadioAlertKeys))
	for _, k := range RadioAlertKeys {
		if listed[k] {
			t.Errorf("RadioAlertKeys lists %q twice", k)
		}
		listed[k] = true
	}
	if !sort.StringsAreSorted(RadioAlertKeys) {
		t.Error("RadioAlertKeys must stay sorted")
	}

	emitted := emittedSubAlerts(t)
	var missing, unused []string
	for k := range emitted {
		if !listed[k] {
			missing = append(missing, k)
		}
	}
	for k := range listed {
		if !emitted[k] {
			unused = append(unused, k)
		}
	}
	sort.Strings(missing)
	sort.Strings(unused)

	if len(missing) > 0 {
		t.Errorf("RadioAlertKeys lacks alerts the engine emits (add them, then map each to a phrase category in frontend/src/constants/radioAlertCategories.ts): %s",
			strings.Join(missing, ", "))
	}
	if len(unused) > 0 {
		t.Errorf("RadioAlertKeys lists keys the engine never emits (remove them): %s", strings.Join(unused, ", "))
	}
}

// The directive on /ws/engineer carries the alert key and no text: the dashboard owns the wording.
func TestEngineerDirective_WireKeys(t *testing.T) {
	data, err := json.Marshal(EngineerDirective{
		ID:       "directive_1_tyre_wear",
		Type:     DirectiveMessageType,
		Category: DirectiveCategoryTyres,
		Title:    "Tyre Wear",
		Message:  "Tyre wear is at 45%.",
		Urgency:  UrgencyMedium,
	})
	if err != nil {
		t.Fatalf("marshal directive: %v", err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		t.Fatalf("decode directive: %v", err)
	}
	got := make([]string, 0, len(fields))
	for k := range fields {
		got = append(got, k)
	}
	sort.Strings(got)
	want := []string{"car_index", "category", "id", "session_time", "sub_alert", "timestamp", "type", "urgency"}
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("directive JSON keys = %v, want %v", got, want)
	}
}
