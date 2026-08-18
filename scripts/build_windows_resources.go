package main

import (
	"bytes"
	"encoding/binary"
	"flag"
	"fmt"
	"image"
	"image/draw"
	_ "image/png"
	"os"
	"os/exec"
	"path/filepath"
)

func main() {
	cleanFlag := flag.Bool("clean", false, "Remove all generated .syso and .ico files from cmd/server")
	flag.Parse()

	if *cleanFlag {
		cleanResources()
		return
	}

	generateResources()
}

func cleanResources() {
	files, _ := filepath.Glob("cmd/server/*.syso")
	icoFiles, _ := filepath.Glob("cmd/server/*.ico")
	manifestFiles, _ := filepath.Glob("cmd/server/*.manifest")
	all := append(append(files, icoFiles...), manifestFiles...)

	for _, f := range all {
		_ = os.Remove(f)
	}
	fmt.Println("Cleaned up Windows resource files from cmd/server/")
}

func generateResources() {
	pngPath := "frontend/public/apple-touch-icon.png"
	icoPath := "cmd/server/app.ico"
	manifestPath := "cmd/server/app.manifest"

	pngBytes, err := os.ReadFile(pngPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to read PNG: %v\n", err)
		os.Exit(1)
	}

	img, _, err := image.Decode(bytes.NewReader(pngBytes))
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to decode PNG: %v\n", err)
		os.Exit(1)
	}

	// Create ICO file with 256x256 frame
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	_ = draw.Draw

	var icoBuf bytes.Buffer
	// ICO Header
	binary.Write(&icoBuf, binary.LittleEndian, uint16(0)) // Reserved
	binary.Write(&icoBuf, binary.LittleEndian, uint16(1)) // Type 1 = ICO
	binary.Write(&icoBuf, binary.LittleEndian, uint16(1)) // 1 Image count

	// Icon Directory Entry
	widthByte := byte(w)
	if w >= 256 {
		widthByte = 0
	}
	heightByte := byte(h)
	if h >= 256 {
		heightByte = 0
	}
	icoBuf.WriteByte(widthByte)
	icoBuf.WriteByte(heightByte)
	icoBuf.WriteByte(0)                                               // Colors
	icoBuf.WriteByte(0)                                               // Reserved
	binary.Write(&icoBuf, binary.LittleEndian, uint16(1))             // Planes
	binary.Write(&icoBuf, binary.LittleEndian, uint16(32))            // BPP
	binary.Write(&icoBuf, binary.LittleEndian, uint32(len(pngBytes))) // Size
	binary.Write(&icoBuf, binary.LittleEndian, uint32(6+16))          // Offset (6 byte header + 16 byte entry)

	icoBuf.Write(pngBytes)

	if err := os.WriteFile(icoPath, icoBuf.Bytes(), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "failed to write ICO: %v\n", err)
		os.Exit(1)
	}

	manifestXML := `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity
    version="1.0.0.0"
    processorArchitecture="*"
    name="F1Telemetry.Analyzer"
    type="win32"
  />
  <description>F1 Telemetry Analyzer - Pit Wall and Strategy Dashboard</description>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security>
      <requestedPrivileges>
        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
      </requestedPrivileges>
    </security>
  </trustInfo>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
      <activeCodePage xmlns="http://schemas.microsoft.com/SMI/2019/WindowsSettings">UTF-8</activeCodePage>
    </windowsSettings>
  </application>
</assembly>
`
	if err := os.WriteFile(manifestPath, []byte(manifestXML), 0644); err != nil {
		fmt.Fprintf(os.Stderr, "failed to write manifest: %v\n", err)
		os.Exit(1)
	}

	architectures := []string{"amd64", "arm64"}
	for _, arch := range architectures {
		outFile := fmt.Sprintf("cmd/server/rsrc_windows_%s.syso", arch)
		cmd := exec.Command("go", "run", "github.com/akavel/rsrc@latest",
			"-manifest", manifestPath,
			"-ico", icoPath,
			"-arch", arch,
			"-o", outFile,
		)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			fmt.Fprintf(os.Stderr, "failed to generate syso for %s: %v\n", arch, err)
			os.Exit(1)
		}
	}

	// Clean up temp ICO and manifest files, leaving only the syso files
	_ = os.Remove(icoPath)
	_ = os.Remove(manifestPath)
	fmt.Println("Generated Windows .syso resource files in cmd/server/")
}
