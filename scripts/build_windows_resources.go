package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// appIconPath is the multi-size app icon (16 to 180 px) also used by the tray; regenerate it with
// `go generate ./internal/desktop`.
const appIconPath = "internal/desktop/icons/app.ico"

func main() {
	cleanFlag := flag.Bool("clean", false, "Remove all generated .syso and .manifest files from cmd/server")
	flag.Parse()

	if *cleanFlag {
		cleanResources()
		return
	}

	generateResources()
}

func cleanResources() {
	files, _ := filepath.Glob("cmd/server/*.syso")
	manifestFiles, _ := filepath.Glob("cmd/server/*.manifest")
	files = append(files, manifestFiles...)

	for _, f := range files {
		_ = os.Remove(f)
	}
	fmt.Println("Cleaned up Windows resource files from cmd/server/")
}

func generateResources() {
	manifestPath := "cmd/server/app.manifest"

	if _, err := os.Stat(appIconPath); err != nil {
		fmt.Fprintf(os.Stderr, "app icon missing: %v\n", err)
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
	if err := os.WriteFile(manifestPath, []byte(manifestXML), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "failed to write manifest: %v\n", err)
		os.Exit(1)
	}

	architectures := []string{"amd64"}
	for _, arch := range architectures {
		outFile := fmt.Sprintf("cmd/server/rsrc_windows_%s.syso", arch)
		cmd := exec.Command("go", "run", "github.com/akavel/rsrc@latest",
			"-manifest", manifestPath,
			"-ico", appIconPath,
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

	// Clean up the manifest, leaving only the syso files
	_ = os.Remove(manifestPath)
	fmt.Println("Generated Windows .syso resource files in cmd/server/")
}
