package engineer

import (
	"encoding/json"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"
)

// alertCategoriesPath is the dashboard's map from a directive's sub_alert to the radio phrase
// category it speaks. A key the map lacks falls back to reading out the engine's own message.
const alertCategoriesPath = "../../frontend/src/constants/radioAlertCategories.json"

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

func TestAlertCategories_MatchWhatTheEngineEmits(t *testing.T) {
	data, err := os.ReadFile(alertCategoriesPath)
	if err != nil {
		t.Fatalf("read %s: %v", alertCategoriesPath, err)
	}
	var categories map[string]*string
	if err := json.Unmarshal(data, &categories); err != nil {
		t.Fatalf("decode %s: %v", alertCategoriesPath, err)
	}

	emitted := emittedSubAlerts(t)
	var missing, unused []string
	for k := range emitted {
		if _, ok := categories[k]; !ok {
			missing = append(missing, k)
		}
	}
	for k := range categories {
		if !emitted[k] {
			unused = append(unused, k)
		}
	}
	sort.Strings(missing)
	sort.Strings(unused)

	if len(missing) > 0 {
		t.Errorf("%s lacks alerts the engine emits (map each to a phrase category, or null to speak the engine's message): %s",
			alertCategoriesPath, strings.Join(missing, ", "))
	}
	if len(unused) > 0 {
		t.Errorf("%s lists keys the engine never emits (remove them): %s", alertCategoriesPath, strings.Join(unused, ", "))
	}
}
