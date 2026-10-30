; F1 Telemetry's Windows installer: a per-user install (no admin prompt) of the same f1telemetry.exe
; the zip has. The release builds it from that zip's exe (.github/actions/windows-installer):
;
;   makensis /DEXE=C:\path\f1telemetry.exe /DVERSION=2.0.0 /DVERSION_NUMBER=2.0.0 /DOUTFILE=C:\path\setup.exe installer.nsi
;
; MicrosoftEdgeWebview2Setup.exe, Microsoft's WebView2 bootstrapper (from the Wails module), must be
; next to this file: it installs the runtime the app's window needs on a PC that doesn't have it.
; As with the zip, the database, log and .env sit next to the exe: the Start menu shortcut starts
; the app in its folder, and uninstalling leaves them there.

Unicode true
SetCompressor /SOLID lzma
ManifestDPIAware true

!ifndef EXE
  !error "Pass the app with /DEXE=C:\path\f1telemetry.exe"
!endif
!ifndef VERSION
  !define VERSION "0.0.0-dev"
!endif
; Windows wants the version in numbers: 2.0.0 for 2.0.0-beta.1
!ifndef VERSION_NUMBER
  !define VERSION_NUMBER "0.0.0"
!endif
!ifndef OUTFILE
  !define OUTFILE "f1telemetry_setup.exe"
!endif

!define PRODUCT_NAME "F1 Telemetry"
!define PUBLISHER "f1game-telemetry-go contributors"
!define PRODUCT_URL "https://github.com/mgauna-ar/f1game-telemetry-go"
; The zip's name for it: Update now replaces it in its folder, installed or not
!define EXE_NAME "f1telemetry.exe"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\F1Telemetry"
; The app's Start with Windows entry (internal/desktop/autostart_windows.go)
!define RUN_KEY "Software\Microsoft\Windows\CurrentVersion\Run"
!define RUN_VALUE "F1 Telemetry"
; The class of the app's windows (windowClass in internal/desktop/shell_windows.go): Wails keeps a
; hidden one of it while the app runs, also when it's only in the tray
!define WINDOW_CLASS "F1TelemetryWindow"
; WebView2's Evergreen runtime, installed for the machine or for this user
!define WEBVIEW2_CLIENT "Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinVer.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

Name "${PRODUCT_NAME}"
OutFile "${OUTFILE}"
BrandingText "${PRODUCT_NAME} ${VERSION}"
RequestExecutionLevel user
InstallDir "$LOCALAPPDATA\Programs\${PRODUCT_NAME}"
; Installing again goes to the same folder, where the database is
InstallDirRegKey HKCU "${UNINST_KEY}" "InstallLocation"
ShowInstDetails show
ShowUninstDetails show

!define MUI_ICON "..\..\internal\desktop\icons\app.ico"
!define MUI_UNICON "..\..\internal\desktop\icons\app.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "$(OpenNow)"
!define MUI_FINISHPAGE_RUN_FUNCTION OpenApp

!insertmacro MUI_PAGE_WELCOME
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE CheckNotRunning
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; In the Windows display language when it's one of these, as the app's tray menu
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Spanish"

LangString OpenNow ${LANG_ENGLISH} "Open F1 Telemetry now"
LangString OpenNow ${LANG_SPANISH} "Abrir F1 Telemetry ahora"
LangString Running ${LANG_ENGLISH} "F1 Telemetry is running. Quit it from its icon in the notification area, then click Retry."
LangString Running ${LANG_SPANISH} "F1 Telemetry está abierto. Cerralo con Salir desde su ícono en el área de notificación y hacé clic en Reintentar."
LangString NeedsWindows10 ${LANG_ENGLISH} "F1 Telemetry needs 64-bit Windows 10 or later."
LangString NeedsWindows10 ${LANG_SPANISH} "F1 Telemetry necesita Windows 10 de 64 bits o posterior."
LangString InstallingWebView2 ${LANG_ENGLISH} "Installing Microsoft Edge WebView2 Runtime, which the F1 Telemetry window needs..."
LangString InstallingWebView2 ${LANG_SPANISH} "Instalando Microsoft Edge WebView2 Runtime, que necesita la ventana de F1 Telemetry..."
LangString WebView2Failed ${LANG_ENGLISH} "WebView2 Runtime didn't install (code $1). F1 Telemetry's window needs it: install it from Microsoft's site."
LangString WebView2Failed ${LANG_SPANISH} "WebView2 Runtime no se instaló (código $1). La ventana de F1 Telemetry lo necesita: instalalo desde el sitio de Microsoft."
LangString DataKept ${LANG_ENGLISH} "Your sessions, settings and log stay in $INSTDIR."
LangString DataKept ${LANG_SPANISH} "Tus sesiones, tu configuración y el log quedan en $INSTDIR."

VIProductVersion "${VERSION_NUMBER}.0"
VIFileVersion "${VERSION_NUMBER}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName" "${PRODUCT_NAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription" "${PRODUCT_NAME} Setup"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright" "Copyright (c) ${PUBLISHER}"

Function .onInit
  ${If} ${AtLeastWin10}
  ${AndIf} ${RunningX64}
    Return
  ${EndIf}
  MessageBox MB_OK|MB_ICONSTOP "$(NeedsWindows10)" /SD IDOK
  Abort
FunctionEnd

; The exe can't be replaced or removed while the app runs, and closing its window leaves it running
; in the tray: ask to quit it first. Cancel stays on the page (the uninstaller stops). A copy
; running from another folder counts too: it would hold the port the installed app needs.
!macro CHECK_NOT_RUNNING UN
Function ${UN}CheckNotRunning
  retry:
    FindWindow $0 "${WINDOW_CLASS}"
    ${If} $0 <> 0
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(Running)" /SD IDCANCEL IDRETRY retry
      Abort
    ${EndIf}
FunctionEnd
!macroend
!insertmacro CHECK_NOT_RUNNING ""
!insertmacro CHECK_NOT_RUNNING "un."

Function un.onInit
  Call un.CheckNotRunning
FunctionEnd

; Opens the app in its folder, where its database is
Function OpenApp
  SetOutPath "$INSTDIR"
  Exec '"$INSTDIR\${EXE_NAME}"'
FunctionEnd

; Windows 11 has WebView2, and Windows 10 gets it with Edge: the bootstrapper downloads it only on
; a PC that has neither the machine's nor this user's copy
Function InstallWebView2
  SetRegView 64
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\${WEBVIEW2_CLIENT}" "pv"
  SetRegView lastused
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ReadRegStr $0 HKCU "Software\${WEBVIEW2_CLIENT}" "pv"
  ${EndIf}
  ${If} $0 != ""
  ${AndIf} $0 != "0.0.0.0"
    Return
  ${EndIf}

  DetailPrint "$(InstallingWebView2)"
  InitPluginsDir
  File "/oname=$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" "MicrosoftEdgeWebview2Setup.exe"
  ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $1
  ${If} $1 <> 0
    DetailPrint "$(WebView2Failed)"
  ${EndIf}
FunctionEnd

Section "Install"
  SetShellVarContext current
  Call InstallWebView2

  SetOutPath "$INSTDIR"
  File "/oname=${EXE_NAME}" "${EXE}"
  ; Started in its folder (the output path), like a copy from the zip
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}.lnk" "$INSTDIR\${EXE_NAME}"

  WriteUninstaller "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "URLInfoAbout" "${PRODUCT_URL}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${EXE_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ; The app's own size: the database next to it is the user's
  ${GetSize} "$INSTDIR" "/M=${EXE_NAME} /S=0K /G=0" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  SetShellVarContext current

  ; Start with Windows goes only when it starts this copy: quoted, or unquoted in a folder without
  ; spaces. One for a copy in another folder stays.
  ReadRegStr $0 HKCU "${RUN_KEY}" "${RUN_VALUE}"
  StrCpy $1 '"$INSTDIR\${EXE_NAME}"'
  StrLen $2 $1
  StrCpy $3 $0 $2
  ${If} $3 == $1
    DeleteRegValue HKCU "${RUN_KEY}" "${RUN_VALUE}"
  ${Else}
    StrCpy $1 '$INSTDIR\${EXE_NAME} '
    StrLen $2 $1
    StrCpy $3 $0 $2
    ${If} $3 == $1
      DeleteRegValue HKCU "${RUN_KEY}" "${RUN_VALUE}"
    ${EndIf}
  ${EndIf}

  Delete "$INSTDIR\${EXE_NAME}"
  ; What Update now leaves when it stops halfway (internal/system/selfupdate.go)
  Delete "$INSTDIR\${EXE_NAME}.new"
  Delete "$INSTDIR\${EXE_NAME}.old"
  Delete "$INSTDIR\.f1telemetry-update-*"
  Delete "$INSTDIR\uninstall.exe"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}.lnk"
  DeleteRegKey HKCU "${UNINST_KEY}"

  ; The folder goes only when it's empty: the database, log and .env stay
  RMDir "$INSTDIR"
  ${If} ${FileExists} "$INSTDIR\*.*"
    DetailPrint "$(DataKept)"
  ${EndIf}
SectionEnd
