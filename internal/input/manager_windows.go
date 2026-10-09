//go:build windows

package input

import (
	"context"
	"fmt"
	"log/slog"
	"syscall"
	"time"
	"unsafe"
)

var (
	modWinmm           = syscall.NewLazyDLL("winmm.dll")
	procJoyGetNumDevs  = modWinmm.NewProc("joyGetNumDevs")
	procJoyGetPosEx    = modWinmm.NewProc("joyGetPosEx")
	procJoyGetDevCapsW = modWinmm.NewProc("joyGetDevCapsW")

	modUser32            = syscall.NewLazyDLL("user32.dll")
	procGetAsyncKeyState = modUser32.NewProc("GetAsyncKeyState")
)

const (
	joyReturnButtons = 0x00000080
	joyErrNoError    = 0
)

type joyInfoEx struct {
	dwSize         uint32
	dwFlags        uint32
	dwXpos         uint32
	dwYpos         uint32
	dwZpos         uint32
	dwRpos         uint32
	dwUpos         uint32
	dwVpos         uint32
	dwButtons      uint32
	dwButtonNumber uint32
	dwPOV          uint32
	dwReserved1    uint32
	dwReserved2    uint32
}

type joyCapsW struct {
	wMid       uint16
	wPid       uint16
	szPname    [32]uint16
	wXmin      uint32
	wXmax      uint32
	wYmin      uint32
	wYmax      uint32
	wZmin      uint32
	wZmax      uint32
	wNumBtns   uint32
	wPeriodMin uint32
	wPeriodMax uint32
	wRmin      uint32
	wRmax      uint32
	wUmin      uint32
	wUmax      uint32
	wVmin      uint32
	wVmax      uint32
	wCaps      uint32
	wMaxAxes   uint32
	wNumAxes   uint32
	wMaxBtns   uint32
	szRegKey   [32]uint16
	szOEMVxD   [260]uint16
}

// WindowsManager monitors gamepads, steering wheels, and global keyboard shortcuts on Windows.
type WindowsManager struct {
	*BaseManager
	cancelFunc context.CancelFunc
	// readFailures counts the polls in a row the wheel couldn't be read; only the poll loop uses it.
	readFailures int
}

// NewManager creates a new Windows input manager.
func NewManager() Manager {
	return &WindowsManager{
		BaseManager: NewBaseManager(),
	}
}

// IsActive returns true on Windows where native global input is active.
func (w *WindowsManager) IsActive() bool {
	return true
}

// Start begins polling connected controllers and keyboard state in a background goroutine.
func (w *WindowsManager) Start(ctx context.Context) {
	w.mu.Lock()
	if w.cancelFunc != nil {
		w.mu.Unlock()
		return // already running
	}
	pollCtx, cancel := context.WithCancel(ctx)
	w.cancelFunc = cancel
	w.mu.Unlock()

	go w.pollLoop(pollCtx)
}

// Stop terminates the polling loop.
func (w *WindowsManager) Stop() {
	w.mu.Lock()
	if w.cancelFunc != nil {
		w.cancelFunc()
		w.cancelFunc = nil
	}
	w.mu.Unlock()
	w.CancelLearning()
}

// StartLearning enters interactive button learning mode.
func (w *WindowsManager) StartLearning(ctx context.Context) (<-chan Mapping, error) {
	w.mu.Lock()
	if w.isLearning && w.learnChan != nil {
		w.mu.Unlock()
		return w.learnChan, nil
	}

	ch := make(chan Mapping, 1)
	w.learnChan = ch
	w.isLearning = true
	w.mu.Unlock()

	return ch, nil
}

func (w *WindowsManager) pollLoop(ctx context.Context) {
	ticker := time.NewTicker(w.pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.tick()
		}
	}
}

func (w *WindowsManager) tick() {
	w.mu.Lock()
	isLearning := w.isLearning
	joyMapping := w.joyMap
	keyMapping := w.keyMap
	w.mu.Unlock()

	// 1. Interactive Learning Mode Check
	if isLearning {
		if learned, ok := w.scanForAnyInput(); ok {
			w.mu.Lock()
			if learned.DeviceType == DeviceTypeJoystick {
				w.joyMap = learned
			} else {
				w.keyMap = learned
			}
			w.button = buttonState{}
			w.isLearning = false
			if w.learnChan != nil {
				w.learnChan <- learned
				close(w.learnChan)
				w.learnChan = nil
			}
			w.mu.Unlock()
			return
		}
		return
	}

	// 2. Normal Mode: Poll both joystick (if mapped) and keyboard (if mapped)
	joyPressed, joyOK, buttons := false, true, uint32(0)
	if joyMapping.DeviceType == DeviceTypeJoystick && joyMapping.DeviceIndex >= 0 && joyMapping.ButtonIndex >= 0 {
		var code uintptr
		buttons, code = readJoystickButtons(joyMapping.DeviceIndex)
		w.noteRead(joyMapping.DeviceIndex, code)
		joyOK = code == joyErrNoError
		joyPressed = joyOK && buttons&(1<<uint(joyMapping.ButtonIndex)) != 0
	}

	keyPressed := keyMapping.KeyCode > 0 && w.checkKeyboardKey(keyMapping.KeyCode)

	// A wheel that couldn't be read says nothing about the button, unless the key is held.
	w.mu.Lock()
	evt := w.button.poll(joyOK || keyPressed, joyPressed || keyPressed)
	w.mu.Unlock()
	if evt == "" {
		return
	}
	// The whole button mask shows what the wheel reported, e.g. another button lighting up instead.
	slog.Info("Push-to-talk button", "state", evt, "device", joyMapping.DeviceIndex, "button", joyMapping.ButtonIndex,
		"buttons", fmt.Sprintf("%#x", buttons), "wheel_read", joyOK, "key", keyMapping.KeyName, "key_down", keyPressed)
	w.EmitEvent(evt)
}

// readJoystickButtons returns the pressed buttons of a joystick, one bit each (button 1 is bit 0),
// and the result code of the read: joyErrNoError, or why it failed.
func readJoystickButtons(devIndex int) (buttons uint32, code uintptr) {
	var info joyInfoEx
	info.dwSize = uint32(unsafe.Sizeof(info))
	info.dwFlags = joyReturnButtons

	code, _, _ = procJoyGetPosEx.Call(uintptr(devIndex), uintptr(unsafe.Pointer(&info)))
	if code != joyErrNoError {
		return 0, code
	}
	return info.dwButtons, code
}

// noteRead logs when the wheel stops reading and when it reads again, without a line per poll.
func (w *WindowsManager) noteRead(device int, code uintptr) {
	if code == joyErrNoError {
		if w.readFailures > 0 {
			slog.Info("Push-to-talk wheel reads again", "device", device, "failed_polls", w.readFailures)
			w.readFailures = 0
		}
		return
	}
	if w.readFailures == 0 {
		slog.Warn("Could not read the push-to-talk wheel", "device", device, "error", code)
	}
	w.readFailures++
}

func (w *WindowsManager) checkKeyboardKey(vkCode int) bool {
	if vkCode <= 0 {
		return false
	}
	ret, _, _ := procGetAsyncKeyState.Call(uintptr(vkCode))
	// Most Significant Bit indicates key is currently pressed
	return (ret & 0x8000) != 0
}

func (w *WindowsManager) scanForAnyInput() (Mapping, bool) {
	// Scan Joysticks (up to 16 devices, up to 32 buttons)
	numDevsRet, _, _ := procJoyGetNumDevs.Call()
	numDevs := int(numDevsRet)
	if numDevs > 16 {
		numDevs = 16
	}

	for devIdx := 0; devIdx < numDevs; devIdx++ {
		var info joyInfoEx
		info.dwSize = uint32(unsafe.Sizeof(info))
		info.dwFlags = joyReturnButtons

		ret, _, _ := procJoyGetPosEx.Call(uintptr(devIdx), uintptr(unsafe.Pointer(&info)))
		if ret == joyErrNoError && info.dwButtons != 0 {
			for btnIdx := 0; btnIdx < 32; btnIdx++ {
				if (info.dwButtons & (1 << uint(btnIdx))) != 0 {
					devName := w.getJoystickName(devIdx)
					return Mapping{
						DeviceType:  DeviceTypeJoystick,
						DeviceIndex: devIdx,
						ButtonIndex: btnIdx,
						DeviceName:  devName,
						KeyName:     fmt.Sprintf("Button %d", btnIdx+1),
					}, true
				}
			}
		}
	}

	// Scan common Keyboard keys (Space, F1-F12, Extra Mouse buttons 4/5, Caps Lock, Letter keys)
	scanKeys := []int{VKSpace, VKMouse4, VKMouse5, VKCapsLock, 'V', 'B', 'C', 'T', 'R'}
	for vk := VKF1; vk <= VKF12; vk++ {
		scanKeys = append(scanKeys, vk)
	}

	for _, vk := range scanKeys {
		if w.checkKeyboardKey(vk) {
			return Mapping{
				DeviceType: DeviceTypeKeyboard,
				KeyCode:    vk,
				KeyName:    KeyName(vk),
				DeviceName: "Keyboard",
			}, true
		}
	}

	return Mapping{}, false
}

func (w *WindowsManager) getJoystickName(devIdx int) string {
	var caps joyCapsW
	ret, _, _ := procJoyGetDevCapsW.Call(
		uintptr(devIdx),
		uintptr(unsafe.Pointer(&caps)),
		uintptr(unsafe.Sizeof(caps)),
	)
	if ret == joyErrNoError {
		name := syscall.UTF16ToString(caps.szPname[:])
		if name != "" {
			return name
		}
	}
	return fmt.Sprintf("Controller / Wheel #%d", devIdx+1)
}
