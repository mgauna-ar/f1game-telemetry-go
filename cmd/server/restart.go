package main

import "flag"

// restartArgs are the arguments the app starts again with after an update: the flags set on this
// run's command line, except the ones that open a browser or only print the version. It starts
// from the same working directory, so a relative -db still points at the same database.
func restartArgs(fs *flag.FlagSet) []string {
	return setFlagArgs(fs, flagOpenBrowser, flagNoBrowser, flagVersion)
}
