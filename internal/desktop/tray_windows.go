//go:build windows

package desktop

import (
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"syscall"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/mgauna/f1game-telemetry-go/internal/system"
)

const (
	// feedRefreshInterval is how often the tray re-reads the live feed's status.
	feedRefreshInterval = 2 * time.Second
	// firstUpdateCheckDelay lets startup finish before asking GitHub for a newer release.
	firstUpdateCheckDelay = 30 * time.Second
	updateCheckInterval   = 12 * time.Hour
)

// tray is the notification-area icon and the menu items that change.
type tray struct {
	icon      *application.SystemTray
	status    *application.MenuItem
	update    *application.MenuItem
	autostart *application.MenuItem
	// view is what the status line shows; only the watch goroutine changes it once the app runs.
	view feedView
}

// addTray builds the notification-area icon and its menu. Clicking the icon opens the window.
func (s *shell) addTray() {
	menu := s.app.NewMenu()
	menu.Add(fmt.Sprintf("%s %s", appName, s.opts.Version)).SetEnabled(false)
	s.tray.status = menu.Add("").SetEnabled(false)
	menu.AddSeparator()

	menu.Add(s.text.Open).OnClick(func(*application.Context) { s.show(WindowMain, "") })
	menu.Add(s.text.LiveView).OnClick(func(*application.Context) { s.show(WindowMain, livePath) })
	menu.Add(s.text.Engineer).OnClick(func(*application.Context) { s.show(WindowEngineer, "") })
	menu.AddSeparator()

	// Shown once a newer release is out; Settings → App says what's new and installs it
	s.tray.update = menu.Add("").SetHidden(true).OnClick(func(*application.Context) {
		s.show(WindowMain, appSettingsPath)
	})
	s.tray.autostart = s.addAutostartItem(menu)
	menu.Add(s.text.OpenDataFolder).OnClick(func(*application.Context) { showInFolder(s.opts.DBPath) })
	if s.opts.LogPath != "" {
		menu.Add(s.text.OpenLogFile).OnClick(func(*application.Context) { openFile(s.opts.LogPath) })
	}
	menu.AddSeparator()
	menu.Add(s.text.Quit).OnClick(func(*application.Context) { s.app.Quit() })

	s.tray.view = describeFeed(s.text, s.opts.Feed(), time.Now(), s.opts.UDPPort)
	s.tray.status.SetLabel(s.tray.view.Text)
	s.tray.icon = s.app.SystemTray.New()
	s.tray.icon.SetIcon(feedIcon(s.tray.view)).SetMenu(menu).OnClick(func() { s.show(WindowMain, "") })
	s.tray.icon.SetTooltip(tooltip(s.tray.view))
}

// addAutostartItem adds "Start with Windows", ticked when this user's Run entry starts this
// executable, and greyed out for a build that can't be started at sign-in.
func (s *shell) addAutostartItem(menu *application.Menu) *application.MenuItem {
	app := s.opts.App
	if !app.startWithOSAvailable() {
		return menu.AddCheckbox(s.text.StartWithWindows, false).SetEnabled(false).SetTooltip(s.text.DevBuildHint)
	}
	return menu.AddCheckbox(s.text.StartWithWindows, app.StartWithOS()).OnClick(func(ctx *application.Context) {
		enable := ctx.IsChecked()
		if err := app.SetStartWithOS(enable); err != nil {
			slog.Warn("Could not change Start with Windows", "enable", enable, "error", err)
			s.setAutostartChecked(!enable)
			go showDialog(appName, fmt.Sprintf("%s: %v", s.text.StartWithWindows, err))
		}
	})
}

// watch keeps the tray's status line and icon, its update notice and its Start with Windows tick
// current, until the app quits.
func (s *shell) watch() {
	ctx := s.app.Context()
	feed := time.NewTicker(feedRefreshInterval)
	defer feed.Stop()
	updates := s.watchUpdates(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-feed.C:
			s.refreshFeed()
		case resp := <-updates:
			s.showUpdate(resp)
		case enabled := <-s.opts.App.startWithOSChanged:
			s.setAutostartChecked(enabled)
		}
	}
}

// refreshFeed updates the status line, tooltip and icon when the live feed's status changed.
func (s *shell) refreshFeed() {
	view := describeFeed(s.text, s.opts.Feed(), time.Now(), s.opts.UDPPort)
	if view == s.tray.view {
		return
	}
	iconChanged := view.Live != s.tray.view.Live
	s.tray.view = view
	application.InvokeAsync(func() {
		if iconChanged {
			s.tray.icon.SetIcon(feedIcon(view))
		}
		s.tray.status.SetLabel(view.Text)
		s.tray.icon.SetTooltip(tooltip(view))
	})
}

// feedIcon is the tray icon for the live feed: with a status dot while telemetry arrives.
func feedIcon(view feedView) []byte {
	if view.Live {
		return liveIcon
	}
	return appIcon
}

// watchUpdates checks for a newer release shortly after startup and then twice a day, sending
// each one it finds. It sends nothing when update checks are off (dev builds).
func (s *shell) watchUpdates(ctx context.Context) <-chan *system.UpdateCheckResponse {
	found := make(chan *system.UpdateCheckResponse)
	if s.opts.CheckUpdates == nil {
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
			resp, err := s.opts.CheckUpdates(ctx)
			if err != nil {
				slog.Warn("Update check failed", "error", err)
			} else if resp.UpdateAvailable {
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

func (s *shell) showUpdate(resp *system.UpdateCheckResponse) {
	label := fmt.Sprintf(s.text.UpdateAvailable, resp.LatestVersion)
	application.InvokeAsync(func() { s.tray.update.SetLabel(label).SetHidden(false) })
}

func (s *shell) setAutostartChecked(enabled bool) {
	application.InvokeAsync(func() { s.tray.autostart.SetChecked(enabled) })
}

// openFile opens a file with its default app, such as the log in a text editor.
func openFile(path string) {
	go func() {
		if err := system.OpenPath(path); err != nil {
			slog.Warn("Could not open from the tray", "path", path, "error", err)
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
