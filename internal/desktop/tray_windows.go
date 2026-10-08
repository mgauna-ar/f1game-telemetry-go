//go:build windows

package desktop

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strings"
	"syscall"
	"time"

	"fyne.io/systray"

	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

const (
	// feedRefreshInterval is how often the tray re-reads the live feed's status.
	feedRefreshInterval = 2 * time.Second
	// firstUpdateCheckDelay lets startup finish before asking GitHub for a newer release.
	firstUpdateCheckDelay = 30 * time.Second
	updateCheckInterval   = 12 * time.Hour
	// releasePagePrefix is the only kind of link the update notice opens.
	releasePagePrefix = "https://github.com/"
)

// RunTray shows the notification-area icon and its menu until Quit (or its own Quit item) is
// called, or Windows ends the session. onExit runs before RunTray returns; on sign-out or
// shutdown it runs inside the message loop, before Windows ends the process.
func RunTray(opts Options, onExit func()) {
	t := &tray{opts: opts, text: userText()}
	systray.Run(t.ready, onExit)
}

// Quit closes the tray, making RunTray return.
func Quit() {
	systray.Quit()
}

type tray struct {
	opts Options
	text text

	status     *systray.MenuItem
	window     *systray.MenuItem
	dashboard  *systray.MenuItem
	live       *systray.MenuItem
	update     *systray.MenuItem
	autostart  *systray.MenuItem
	dataFolder *systray.MenuItem
	logFile    *systray.MenuItem
	quit       *systray.MenuItem

	view      feedView
	updateURL string
}

// ready builds the menu, then hands clicks, feed status and update notices to one goroutine, so
// the tray's state needs no locking.
func (t *tray) ready() {
	systray.SetIcon(appIcon)
	systray.SetTooltip(appName)
	systray.SetOnTapped(func() { go t.showWindow() })

	header := systray.AddMenuItem(fmt.Sprintf("%s %s", appName, t.opts.Version), "")
	header.Disable()
	t.status = systray.AddMenuItem("", "")
	t.status.Disable()
	systray.AddSeparator()

	t.window = systray.AddMenuItem(t.text.ShowWindow, "")
	t.dashboard = systray.AddMenuItem(t.text.OpenDashboard, "")
	t.live = systray.AddMenuItem(t.text.OpenLive, "")
	systray.AddSeparator()

	t.update = systray.AddMenuItem("", "")
	t.update.Hide()
	t.autostart = t.addAutostartItem()
	t.dataFolder = systray.AddMenuItem(t.text.OpenDataFolder, "")
	t.logFile = systray.AddMenuItem(t.text.OpenLogFile, "")
	if t.opts.LogPath == "" {
		t.logFile.Hide()
	}
	systray.AddSeparator()
	t.quit = systray.AddMenuItem(t.text.Quit, "")

	t.refreshFeed()
	go t.run()
}

// run handles the menu until Quit.
func (t *tray) run() {
	feedTicker := time.NewTicker(feedRefreshInterval)
	defer feedTicker.Stop()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	updates := t.watchUpdates(ctx)

	for {
		select {
		case <-feedTicker.C:
			t.refreshFeed()
		case resp := <-updates:
			t.showUpdate(resp)
		case <-t.window.ClickedCh:
			go t.showWindow()
		case <-t.dashboard.ClickedCh:
			t.openPage(t.opts.DashboardURL)
		case <-t.live.ClickedCh:
			t.openPage(t.opts.LiveURL)
		case <-t.update.ClickedCh:
			t.open(t.updateURL)
		case <-t.autostart.ClickedCh:
			t.toggleAutostart()
		case enabled := <-t.opts.App.startWithOSChanged:
			t.setAutostartChecked(enabled)
		case <-t.dataFolder.ClickedCh:
			showInFolder(t.opts.DBPath)
		case <-t.logFile.ClickedCh:
			t.open(t.opts.LogPath)
		case <-t.quit.ClickedCh:
			systray.Quit()
			return
		}
	}
}

// showWindow opens the app window.
func (t *tray) showWindow() {
	if err := t.opts.App.OpenWindow(); err != nil {
		slog.Warn("Could not open the app window", "error", err)
	}
}

// addAutostartItem adds "Start with Windows", ticked when this user's Run entry starts this
// executable, and greyed out for a build that can't be started at sign-in.
func (t *tray) addAutostartItem() *systray.MenuItem {
	if !t.opts.App.startWithOSAvailable() {
		item := systray.AddMenuItemCheckbox(t.text.StartWithWindows, t.text.DevBuildHint, false)
		item.Disable()
		return item
	}
	return systray.AddMenuItemCheckbox(t.text.StartWithWindows, "", t.opts.App.StartWithOS())
}

func (t *tray) toggleAutostart() {
	enable := !t.autostart.Checked()
	if err := t.opts.App.SetStartWithOS(enable); err != nil {
		slog.Warn("Could not change Start with Windows", "enable", enable, "error", err)
		go showDialog(appName, fmt.Sprintf("%s: %v", t.text.StartWithWindows, err))
		return
	}
	t.setAutostartChecked(enable)
}

func (t *tray) setAutostartChecked(enabled bool) {
	if enabled {
		t.autostart.Check()
	} else {
		t.autostart.Uncheck()
	}
}

// refreshFeed updates the status line, tooltip and icon when the live feed's status changed.
func (t *tray) refreshFeed() {
	view := describeFeed(t.text, t.opts.Feed(), time.Now(), t.opts.UDPPort)
	if view == t.view {
		return
	}
	if view.Live != t.view.Live || t.view.Text == "" {
		if view.Live {
			systray.SetIcon(liveIcon)
		} else {
			systray.SetIcon(appIcon)
		}
	}
	t.view = view
	t.status.SetTitle(view.Text)
	systray.SetTooltip(tooltip(view))
}

// watchUpdates checks for a newer release shortly after startup and then twice a day, sending
// each one it finds. It sends nothing when update checks are off (dev builds).
func (t *tray) watchUpdates(ctx context.Context) <-chan *system.UpdateCheckResponse {
	found := make(chan *system.UpdateCheckResponse)
	if t.opts.CheckUpdates == nil {
		return found
	}
	go func() {
		timer := time.NewTimer(firstUpdateCheckDelay)
		defer timer.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
			}
			resp, err := t.opts.CheckUpdates(ctx)
			if err != nil {
				slog.Warn("Update check failed", "error", err)
			} else if resp.UpdateAvailable && strings.HasPrefix(resp.HTMLURL, releasePagePrefix) {
				select {
				case found <- resp:
				case <-ctx.Done():
					return
				}
			}
			timer.Reset(updateCheckInterval)
		}
	}()
	return found
}

func (t *tray) showUpdate(resp *system.UpdateCheckResponse) {
	t.updateURL = resp.HTMLURL
	t.update.SetTitle(fmt.Sprintf(t.text.UpdateAvailable, resp.LatestVersion))
	t.update.Show()
}

// openPage opens a dashboard page the way system.OpenBrowser does (in Chrome on Windows when it is
// installed), off the tray's goroutine.
func (t *tray) openPage(url string) {
	go func() {
		if err := system.OpenBrowser(url); err != nil {
			slog.Warn("Could not open the dashboard from the tray", "url", url, "error", err)
		}
	}()
}

// open opens a URL or file with its default app, off the tray's goroutine.
func (t *tray) open(target string) {
	if target == "" {
		return
	}
	go func() {
		if err := system.OpenPath(target); err != nil {
			slog.Warn("Could not open from the tray", "target", target, "error", err)
		}
	}()
}

// showInFolder opens Explorer on the folder holding path, with the file selected. Explorer reads
// its own command line, so it is passed as is: `/select,"C:\path with spaces\file"`.
func showInFolder(path string) {
	cmd := exec.Command("explorer.exe")
	cmd.SysProcAttr = &syscall.SysProcAttr{CmdLine: `explorer.exe /select,"` + path + `"`}
	if err := cmd.Start(); err != nil {
		slog.Warn("Could not open the data folder", "path", path, "error", err)
		return
	}
	go func() { _ = cmd.Wait() }()
}
