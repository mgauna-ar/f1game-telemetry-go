package desktop

import _ "embed"

//go:generate go run gen_icons.go

var (
	// appIcon is the tray icon while waiting for the game.
	//go:embed icons/app.ico
	appIcon []byte
	// liveIcon is the tray icon while telemetry arrives: the app icon with a status dot.
	//go:embed icons/app_live.ico
	liveIcon []byte
)
