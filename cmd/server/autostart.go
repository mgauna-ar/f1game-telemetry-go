package main

import (
	"flag"
	"fmt"
)

// Flags that autostartArgs sets itself or that make no sense when starting at sign-in.
const (
	flagDB        = "db"
	flagNoBrowser = "no-browser"
	flagVersion   = "version"
)

// autostartArgs are the arguments "Start with Windows" runs the executable with: the flags set on
// this run's command line, then -no-browser (signing in shouldn't open a browser) and the
// database as an absolute path, since a sign-in start runs from C:\Windows\System32. Settings
// from the environment or a .env file are left out: the .env next to the executable is read
// again at every start.
func autostartArgs(fs *flag.FlagSet, absDB string) []string {
	var args []string
	fs.Visit(func(f *flag.Flag) {
		switch f.Name {
		case flagDB, flagNoBrowser, flagVersion:
			return
		}
		args = append(args, fmt.Sprintf("-%s=%s", f.Name, f.Value.String()))
	})
	return append(args, "-"+flagNoBrowser, fmt.Sprintf("-%s=%s", flagDB, absDB))
}
