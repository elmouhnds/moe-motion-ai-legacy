; MOE Motion AI — Windows installer (NSIS 3, per-user, no admin rights).
;
; Updates replace the previous install in place:
;   * one fixed folder named after the extension bundle id
;       %APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai
;     is wiped and rewritten on every install (no stale files, no side-by-side copies);
;   * older manual copies (moe-motion-ai*, "MOE Motion AI") that carry the same bundle id
;     are removed — a developer junction is unlinked, its target is never touched;
;   * one entry in Settings › Apps (HKCU uninstall key) whose version is updated.
; User data (%APPDATA%\MOE Motion AI: settings, presets, clients, API key) is never touched
; by install or update; uninstall asks before deleting it.
;
; Command line:
;   /S          silent install
;   /WAITAE     wait until After Effects (AfterFX.exe) has closed, then install silently
;               (used by the panel's "Install when I close After Effects")
;
; Build: node tools/build-release.js   (passes VERSION, SRC, OUTFILE, ICON, SIDEBAR)

Target amd64-unicode
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WordFunc.nsh"
!include "StrFunc.nsh"
${StrStr}

!ifndef VERSION
  !error "Define VERSION, e.g. makensis -DVERSION=0.6.1"
!endif
!ifndef SRC
  !error "Define SRC (staged extension folder)"
!endif
!ifndef OUTFILE
  !define OUTFILE "MOE-Motion-AI-Setup-${VERSION}.exe"
!endif

!define APPNAME   "MOE Motion AI"
!define PUBLISHER "Mad Tomato"
!define BUNDLE    "tv.madtomato.moe.motionai"
!define UNINST    "Software\Microsoft\Windows\CurrentVersion\Uninstall\MOEMotionAI"
!define CSXS      "Software\Adobe\CSXS.12"
!define TOOLDIR   "$LOCALAPPDATA\Programs\MOE Motion AI"

Name "${APPNAME} ${VERSION}"
OutFile "${OUTFILE}"
RequestExecutionLevel user
InstallDir "$APPDATA\Adobe\CEP\extensions\${BUNDLE}"
SetCompressor /SOLID lzma
BrandingText "${APPNAME} ${VERSION}"
ShowInstDetails show
ShowUninstDetails show

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "FileDescription" "${APPNAME} for After Effects 2025 — installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "© ${PUBLISHER}"

!ifdef ICON
  !define MUI_ICON "${ICON}"
  !define MUI_UNICON "${ICON}"
!endif
!ifdef SIDEBAR
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${SIDEBAR}"
  !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${SIDEBAR}"
!endif
!define MUI_ABORTWARNING

!define MUI_WELCOMEPAGE_TITLE "$(WelcomeTitle)"
!define MUI_WELCOMEPAGE_TEXT "$(WelcomeText)"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "$(FinishTitle)"
!define MUI_FINISHPAGE_TEXT "$(FinishText)"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Arabic"

LangString WelcomeTitle ${LANG_ENGLISH} "MOE Motion AI ${VERSION}"
LangString WelcomeTitle ${LANG_ARABIC}  "MOE Motion AI ${VERSION}"
LangString WelcomeText ${LANG_ENGLISH} "This installs (or updates) the MOE Motion AI panel for After Effects 2025.$\r$\n$\r$\nUpdates replace the previous version in place. Your settings, presets, clients and API key are kept.$\r$\n$\r$\nPlease close After Effects before continuing."
LangString WelcomeText ${LANG_ARABIC}  "سيتم تثبيت (أو تحديث) لوحة MOE Motion AI لبرنامج After Effects 2025.$\r$\n$\r$\nالتحديث يستبدل النسخة السابقة في مكانها، وتبقى إعداداتك والبريستس والعملاء ومفتاح الـ API كما هي.$\r$\n$\r$\nمن فضلك أغلق After Effects قبل المتابعة."
LangString FinishTitle ${LANG_ENGLISH} "MOE Motion AI is ready"
LangString FinishTitle ${LANG_ARABIC}  "MOE Motion AI جاهز"
LangString FinishText ${LANG_ENGLISH} "Open After Effects, then Window › Extensions › MOE Motion AI.$\r$\n$\r$\nFuture updates: Settings › Updates inside the panel, or run a newer installer — it replaces this one."
LangString FinishText ${LANG_ARABIC}  "افتح After Effects ثم Window › Extensions › MOE Motion AI.$\r$\n$\r$\nالتحديثات القادمة: من Settings › Updates داخل اللوحة، أو شغّل مثبّت أحدث وسيستبدل هذه النسخة."
LangString CloseAE ${LANG_ENGLISH} "After Effects is running. Close it, then press Retry (the panel's files are replaced while it is closed)."
LangString CloseAE ${LANG_ARABIC}  "برنامج After Effects مفتوح. أغلقه ثم اضغط إعادة المحاولة (يتم استبدال ملفات اللوحة وهو مغلق)."
LangString Downgrade ${LANG_ENGLISH} "A newer version ($R2) is installed. Replace it with ${VERSION}?"
LangString Downgrade ${LANG_ARABIC}  "يوجد إصدار أحدث ($R2) مثبت. هل تريد استبداله بالإصدار ${VERSION}؟"
LangString AskData ${LANG_ENGLISH} "Also delete your MOE settings, presets, clients and saved API key?$\r$\n($APPDATA\MOE Motion AI)"
LangString AskData ${LANG_ARABIC}  "هل تريد أيضاً حذف إعدادات MOE والبريستس والعملاء ومفتاح الـ API المحفوظ؟$\r$\n($APPDATA\MOE Motion AI)"

Var Legacy

; ---------------------------------------------------------------- helpers
; $0 = "1" when AfterFX.exe is running, else "0"
Function IsAERunning
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /c tasklist /FI "IMAGENAME eq AfterFX.exe" /NH'
  Pop $1 ; exit code
  Pop $2 ; output
  ${StrStr} $3 $2 "AfterFX.exe"
  ${If} $3 != ""
    StrCpy $0 "1"
  ${Else}
    StrCpy $0 "0"
  ${EndIf}
FunctionEnd

; /WAITAE: poll every 3 s (up to 24 h) until After Effects has closed.
Function WaitForAE
  StrCpy $R9 0
  loop:
    Call IsAERunning
    StrCmp $0 "0" done
    Sleep 3000
    IntOp $R9 $R9 + 1
    IntCmp $R9 28800 done
    Goto loop
  done:
FunctionEnd

; Remove one legacy folder $R0 (only if it is an MOE copy: CSXS\manifest.xml mentions our bundle id).
Function RemoveIfOurs
  ${IfNot} ${FileExists} "$R0\CSXS\manifest.xml"
    Return
  ${EndIf}
  ClearErrors
  FileOpen $4 "$R0\CSXS\manifest.xml" r
  ${If} ${Errors}
    Return
  ${EndIf}
  StrCpy $5 ""
  readline:
    FileRead $4 $6
    ${If} ${Errors}
      Goto closed
    ${EndIf}
    ${StrStr} $7 $6 'ExtensionBundleId="${BUNDLE}"'
    ${If} $7 != ""
      StrCpy $5 "1"
      Goto closed
    ${EndIf}
    Goto readline
  closed:
  FileClose $4
  ${If} $5 != "1"
    Return
  ${EndIf}
  ; Junction / symlink (developer install): remove the link only, never its target.
  System::Call 'kernel32::GetFileAttributes(t "$R0") i .r8'
  IntOp $9 $8 & 0x400
  ${If} $9 != 0
    RMDir "$R0"
    DetailPrint "Unlinked developer copy: $R0"
  ${Else}
    RMDir /r "$R0"
    DetailPrint "Removed old copy: $R0"
  ${EndIf}
  IntOp $Legacy $Legacy + 1
FunctionEnd

Function RemoveLegacy
  StrCpy $Legacy 0
  StrCpy $R1 "$APPDATA\Adobe\CEP\extensions"
  FindFirst $R2 $R3 "$R1\moe-motion-ai*"
  legacy_loop:
    StrCmp $R3 "" legacy_done
    StrCpy $R0 "$R1\$R3"
    Call RemoveIfOurs
    FindNext $R2 $R3
    Goto legacy_loop
  legacy_done:
  FindClose $R2
  StrCpy $R0 "$R1\MOE Motion AI"
  Call RemoveIfOurs
  ; A system-wide copy (ZXP / admin install) cannot be removed without admin rights: report it.
  ${If} ${FileExists} "$COMMONFILES\Adobe\CEP\extensions\${BUNDLE}\CSXS\manifest.xml"
    DetailPrint "Note: a system-wide copy exists in $COMMONFILES\Adobe\CEP\extensions\${BUNDLE} — remove it with admin rights to avoid two versions."
  ${EndIf}
FunctionEnd

; ---------------------------------------------------------------- install
Function .onInit
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/WAITAE" $R1
  ${IfNot} ${Errors}
    SetSilent silent
    Call WaitForAE
  ${EndIf}

  ReadRegStr $R2 HKCU "${UNINST}" "DisplayVersion"
  ${If} $R2 != ""
    ${VersionCompare} "${VERSION}" "$R2" $R3
    ${If} $R3 == 2
      IfSilent +3
      MessageBox MB_YESNO|MB_ICONQUESTION "$(Downgrade)" IDYES +2
      Abort
    ${EndIf}
  ${EndIf}

  IfSilent skip_ae
  check_ae:
    Call IsAERunning
    StrCmp $0 "0" skip_ae
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(CloseAE)" IDRETRY check_ae
    Abort
  skip_ae:
FunctionEnd

Section "MOE Motion AI" SecMain
  SectionIn RO
  SetShellVarContext current
  Call RemoveLegacy

  ; Clean replace: the previous version's files go, the new ones come in.
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"

  ; Install record read by the panel (Settings › Updates).
  ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
  FileOpen $9 "$INSTDIR\install.json" w
  FileWrite $9 '{"installer":"nsis","version":"${VERSION}","installedAt":"$2-$1-$0T$4:$5:$6"}'
  FileClose $9

  ; Unsigned CEP extensions load only with PlayerDebugMode for CSXS 12 (After Effects 2025).
  WriteRegStr HKCU "${CSXS}" "PlayerDebugMode" "1"

  ; Uninstaller + Apps entry (one entry; its version is updated on every install).
  CreateDirectory "${TOOLDIR}"
  WriteUninstaller "${TOOLDIR}\Uninstall MOE Motion AI.exe"
  !ifdef ICON
    SetOutPath "${TOOLDIR}"
    File "/oname=moe.ico" "${ICON}"
  !endif
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegStr HKCU "${UNINST}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${UNINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST}" "DisplayIcon" "${TOOLDIR}\moe.ico"
  WriteRegStr HKCU "${UNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST}" "UninstallString" '"${TOOLDIR}\Uninstall MOE Motion AI.exe"'
  WriteRegStr HKCU "${UNINST}" "QuietUninstallString" '"${TOOLDIR}\Uninstall MOE Motion AI.exe" /S'
  WriteRegDWORD HKCU "${UNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINST}" "EstimatedSize" $0
  DetailPrint "Installed ${APPNAME} ${VERSION} in $INSTDIR ($Legacy old copies removed)"
SectionEnd

; ---------------------------------------------------------------- uninstall
Section "Uninstall"
  SetShellVarContext current
  ReadRegStr $0 HKCU "${UNINST}" "InstallLocation"
  ${If} $0 == ""
    StrCpy $0 "$APPDATA\Adobe\CEP\extensions\${BUNDLE}"
  ${EndIf}
  RMDir /r "$0"
  DeleteRegKey HKCU "${UNINST}"
  IfSilent keep_data
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(AskData)" IDNO keep_data
  RMDir /r "$APPDATA\MOE Motion AI"
  keep_data:
  ; PlayerDebugMode is left as is: other unsigned panels may rely on it.
  Delete "${TOOLDIR}\moe.ico"
  Delete "${TOOLDIR}\Uninstall MOE Motion AI.exe"
  RMDir "${TOOLDIR}"
SectionEnd
