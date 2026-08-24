//go:build windows

package input

import (
	"context"
	"fmt"
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
	pollCtx, cancel := context.WithCancel(ctx)
	w.cancelFunc = cancel

	go w.pollLoop(pollCtx)
}

// Stop terminates the polling loop.
func (w *WindowsManager) Stop() {
	if w.cancelFunc != nil {
		w.cancelFunc()
	}
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
	wasDown := w.isDown
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
			w.isDown = false
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
	isJoyDown := false
	if joyMapping.DeviceType == DeviceTypeJoystick && joyMapping.DeviceIndex >= 0 && joyMapping.ButtonIndex >= 0 {
		isJoyDown = w.checkJoystickButton(joyMapping.DeviceIndex, joyMapping.ButtonIndex)
	}

	isKeyDown := false
	if keyMapping.KeyCode > 0 {
		isKeyDown = w.checkKeyboardKey(keyMapping.KeyCode)
	}

	isCurrentlyDown := isJoyDown || isKeyDown

	if isCurrentlyDown != wasDown {
		w.mu.Lock()
		w.isDown = isCurrentlyDown
		w.mu.Unlock()

		if isCurrentlyDown {
			w.EmitEvent("down")
		} else {
			w.EmitEvent("up")
		}
	}
}

func (w *WindowsManager) checkJoystickButton(devIndex, btnIndex int) bool {
	var info joyInfoEx
	info.dwSize = uint32(unsafe.Sizeof(info))
	info.dwFlags = joyReturnButtons

	ret, _, _ := procJoyGetPosEx.Call(uintptr(devIndex), uintptr(unsafe.Pointer(&info)))
	if ret != joyErrNoError {
		return false
	}

	return (info.dwButtons & (1 << uint(btnIndex))) != 0
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

	// Scan common Keyboard keys (Space, F1-F12, Extra Mouse buttons 4/5, Letter/Number keys)
	scanKeys := []int{
		0x20,       // VK_SPACE
		0x05, 0x06, // VK_XBUTTON1, VK_XBUTTON2 (Mouse 4/5)
		0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, // VK_F1 - VK_F12
		0x14, // VK_CAPITAL (Caps Lock)
		0x56, // 'V'
		0x42, // 'B'
		0x43, // 'C'
		0x54, // 'T'
		0x52, // 'R'
	}

	for _, vk := range scanKeys {
		if w.checkKeyboardKey(vk) {
			name := getVKName(vk)
			return Mapping{
				DeviceType: DeviceTypeKeyboard,
				KeyCode:    vk,
				KeyName:    name,
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

func getVKName(vk int) string {
	switch vk {
	case 0x20:
		return "Space"
	case 0x05:
		return "Mouse 4"
	case 0x06:
		return "Mouse 5"
	case 0x14:
		return "Caps Lock"
	case 0x70:
		return "F1"
	case 0x71:
		return "F2"
	case 0x72:
		return "F3"
	case 0x73:
		return "F4"
	case 0x74:
		return "F5"
	case 0x75:
		return "F6"
	case 0x76:
		return "F7"
	case 0x77:
		return "F8"
	case 0x78:
		return "F9"
	case 0x79:
		return "F10"
	case 0x7A:
		return "F11"
	case 0x7B:
		return "F12"
	default:
		if vk >= 0x41 && vk <= 0x5A {
			return string(rune(vk))
		}
		return fmt.Sprintf("Key 0x%X", vk)
	}
}
