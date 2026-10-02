package main

import (
	"flag"
	"fmt"
)

// Flags that autostartArgs sets itself or that make no sense when starting at sign-in.
const (
	flagDB          = "db"
	flagOpenBrowser = "open-browser"
	flagNoBrowser   = "no-browser"
	flagVersion     = "version"
)

// autostartArgs are the arguments "Start with Windows" runs the executable with: the flags set on
// this run's command line except the browser ones (signing in shouldn't open a browser), then the
// database as an absolute path, since a sign-in start runs from C:\Windows\System32. Settings
// from the environment or a .env file are left out: the .env next to the executable is read
// again at every start.
func autostartArgs(fs *flag.FlagSet, absDB string) []string {
	var args []string
	fs.Visit(func(f *flag.Flag) {
		switch f.Name {
		case flagDB, flagOpenBrowser, flagNoBrowser, flagVersion:
			return
		}
		args = append(args, fmt.Sprintf("-%s=%s", f.Name, f.Value.String()))
	})
	return append(args, fmt.Sprintf("-%s=%s", flagDB, absDB))
}
