package main

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

const dotEnvFile = ".env"

// dotEnvPaths returns where to look for a .env file: the current folder first, then the folder
// holding the executable (so a double-clicked binary finds the .env sitting next to it).
func dotEnvPaths() []string {
	paths := []string{dotEnvFile}
	exe, err := os.Executable()
	if err != nil {
		return paths
	}
	exeEnv := filepath.Join(filepath.Dir(exe), dotEnvFile)
	if cwdEnv, err := filepath.Abs(dotEnvFile); err != nil || cwdEnv != exeEnv {
		paths = append(paths, exeEnv)
	}
	return paths
}

// loadDotEnv reads KEY=VALUE lines from each file that exists and sets every variable that is not
// already set, so real environment variables always win over the file. Empty values are skipped.
// It returns the files that were read.
func loadDotEnv(paths ...string) []string {
	var loaded []string
	for _, path := range paths {
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			key, value, ok := parseDotEnvLine(scanner.Text())
			if !ok || value == "" {
				continue
			}
			if _, exists := os.LookupEnv(key); !exists {
				_ = os.Setenv(key, value)
			}
		}
		_ = f.Close()
		loaded = append(loaded, path)
	}
	return loaded
}

// parseDotEnvLine parses one .env line. It accepts an optional "export " prefix, single or double
// quoted values, and trailing "# comment" text after unquoted values.
func parseDotEnvLine(line string) (key, value string, ok bool) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return "", "", false
	}
	line = strings.TrimPrefix(line, "export ")

	key, value, found := strings.Cut(line, "=")
	key = strings.TrimSpace(key)
	if !found || key == "" {
		return "", "", false
	}

	value = strings.TrimSpace(value)
	if value != "" && (value[0] == '"' || value[0] == '\'') {
		if end := strings.IndexByte(value[1:], value[0]); end >= 0 {
			return key, value[1 : end+1], true
		}
	}
	if i := inlineCommentIndex(value); i >= 0 {
		value = strings.TrimSpace(value[:i])
	}
	return key, value, true
}

// inlineCommentIndex returns the index of a '#' that starts a comment (at the start of the value
// or after whitespace), or -1.
func inlineCommentIndex(value string) int {
	for i := 0; i < len(value); i++ {
		if value[i] == '#' && (i == 0 || value[i-1] == ' ' || value[i-1] == '\t') {
			return i
		}
	}
	return -1
}
