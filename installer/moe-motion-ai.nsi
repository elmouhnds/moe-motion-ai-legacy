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
; Build: node tools/build-release.js   (passes VERSION, SRC, OUTFILE, ICON, SIDEBAR, HEADER)
; Artwork: node tools/build-installer-art.js

Target amd64-unicode
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "WordFunc.nsh"
!include "StrFunc.nsh"
${StrStr}

Var Legacy
Var Status   ; welcome: new install / update from x / reinstall
Var AELine   ; welcome: After Effects found or not
Var AEExe    ; AfterFX.exe when found (finish: "Open After Effects now")

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
ShowInstDetails hide
ShowUninstDetails hide
ManifestSupportedOS all

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

; ---------------------------------------------------------------- look (v0.65.1)
; One dark surface like the panel: welcome, finish and the page headers share MUI_BGCOLOR, and the artwork
; (tools/build-installer-art.js) is drawn on the same colour so it has no edge. Keep BG in sync with that script.
!define MUI_BGCOLOR   "111116"
!define MUI_TEXTCOLOR "EDEDF2"
!ifdef SIDEBAR
  !define MUI_WELCOMEFINISHPAGE_BITMAP "${SIDEBAR}"
  !define MUI_UNWELCOMEFINISHPAGE_BITMAP "${SIDEBAR}"
!endif
!ifdef HEADER
  !define MUI_HEADERIMAGE
  !define MUI_HEADERIMAGE_RIGHT
  !define MUI_HEADERIMAGE_BITMAP "${HEADER}"
  !define MUI_HEADERIMAGE_UNBITMAP "${HEADER}"
!endif
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_LINK_COLOR "FF8A66"

; 1 · Welcome: what will happen (new install or update from x), whether After Effects is there, what is new
!define MUI_WELCOMEPAGE_TITLE "$(WelcomeTitle)"
!define MUI_WELCOMEPAGE_TEXT "$Status$\r$\n$AELine$\r$\n$\r$\n$(WhatsNew)$\r$\n$\r$\n$(KeepData)"
!define MUI_PAGE_CUSTOMFUNCTION_SHOW WelcomeShow
!insertmacro MUI_PAGE_WELCOME
; 2 · Install: a few seconds, one clear line per step (details on request)
!define MUI_PAGE_HEADER_TEXT "$(InstTitle)"
!define MUI_PAGE_HEADER_SUBTEXT "$(InstSub)"
!define MUI_INSTFILESPAGE_FINISHHEADER_TEXT "$(InstDone)"
!define MUI_INSTFILESPAGE_FINISHHEADER_SUBTEXT "$(InstDoneSub)"
!insertmacro MUI_PAGE_INSTFILES
; 3 · Finish: where to find it, and open After Effects in one click when it is installed
!define MUI_FINISHPAGE_TITLE "$(FinishTitle)"
!define MUI_FINISHPAGE_TEXT "$(FinishText)"
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_TEXT "$(OpenAE)"
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchAE
!define MUI_PAGE_CUSTOMFUNCTION_SHOW FinishShow
!insertmacro MUI_PAGE_FINISH

!define MUI_PAGE_HEADER_TEXT "$(UnTitle)"
!define MUI_PAGE_HEADER_SUBTEXT "$(UnSub)"
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Arabic"

; What's new: one line per release (keep it to the headline; the panel's What's new has the rest)
LangString WhatsNew ${LANG_ENGLISH} "New in 0.66: every tile says what it will do before Apply, expressions show their code, and Live Stagger + Marker Pulse."
LangString WhatsNew ${LANG_ARABIC}  "الجديد في 0.66: كل أداة بتقولك هتعمل إيه قبل ما تطبّقها، والتعبيرات بتوريك الكود"

LangString WelcomeTitle ${LANG_ENGLISH} "MOE Motion AI ${VERSION}"
LangString WelcomeTitle ${LANG_ARABIC}  "MOE Motion AI ${VERSION}"
LangString StNew ${LANG_ENGLISH} "●  New install for After Effects"
LangString StNew ${LANG_ARABIC}  "●  تثبيت جديد"
LangString StUpdate ${LANG_ENGLISH} "●  Update  $R2  →  ${VERSION}"
LangString StUpdate ${LANG_ARABIC}  "●  تحديث من $R2 إلى ${VERSION}"
LangString StSame ${LANG_ENGLISH} "●  Reinstall ${VERSION} (repairs the panel's files)"
LangString StSame ${LANG_ARABIC}  "●  إعادة تثبيت ${VERSION} (يصلّح ملفات اللوحة)"
LangString AEFound ${LANG_ENGLISH} "●  After Effects found — the panel will be ready in it"
LangString AEFound ${LANG_ARABIC}  "●  لقينا After Effects، واللوحة هتبقى جاهزة فيه"
LangString AEMissing ${LANG_ENGLISH} "●  After Effects 2025 was not found — the panel installs anyway and appears once it is installed"
LangString AEMissing ${LANG_ARABIC}  "●  مالقيناش After Effects 2025، بس اللوحة هتتثبت وهتظهر أول ما تثبّته"
LangString KeepData ${LANG_ENGLISH} "Your settings, presets, clients and API key stay as they are."
LangString KeepData ${LANG_ARABIC}  "إعداداتك والبريستس والعملاء ومفتاح الـ API محفوظين زي ما هم"
LangString BtnInstall ${LANG_ENGLISH} "Install"
LangString BtnInstall ${LANG_ARABIC}  "تثبيت"
LangString BtnUpdate ${LANG_ENGLISH} "Update"
LangString BtnUpdate ${LANG_ARABIC}  "تحديث"
LangString InstTitle ${LANG_ENGLISH} "Installing MOE Motion AI ${VERSION}"
LangString InstTitle ${LANG_ARABIC}  "جاري تثبيت MOE Motion AI ${VERSION}"
LangString InstSub ${LANG_ENGLISH} "A few seconds."
LangString InstSub ${LANG_ARABIC}  "ثواني وتخلص"
LangString InstDone ${LANG_ENGLISH} "Installed and checked"
LangString InstDone ${LANG_ARABIC}  "اتثبت واتأكدنا منه"
LangString InstDoneSub ${LANG_ENGLISH} "Every file is in place."
LangString InstDoneSub ${LANG_ARABIC}  "كل الملفات في مكانها."
LangString StepClean ${LANG_ENGLISH} "Removing old copies…"
LangString StepClean ${LANG_ARABIC}  "شيل النسخ القديمة…"
LangString StepCopy ${LANG_ENGLISH} "Copying the panel…"
LangString StepCopy ${LANG_ARABIC}  "نسخ اللوحة…"
LangString StepRegister ${LANG_ENGLISH} "Registering with After Effects…"
LangString StepRegister ${LANG_ARABIC}  "تسجيلها في After Effects…"
LangString StepVerify ${LANG_ENGLISH} "Checking the installed files…"
LangString StepVerify ${LANG_ARABIC}  "التأكد من الملفات…"
LangString VerifyFail ${LANG_ENGLISH} "The panel's files could not be written to $INSTDIR (the check after copying failed). Run the installer again; if it repeats, check that the folder is not read-only or blocked by antivirus. Your settings are untouched."
LangString VerifyFail ${LANG_ARABIC}  "ملفات اللوحة ماتكتبتش صح في $INSTDIR (الفحص بعد النسخ فشل). شغّل المثبّت تاني؛ لو اتكرر، اتأكد إن الفولدر مش للقراءة بس ومش متقفل من الأنتي فايرس. إعداداتك ماتلمستش."
LangString FinishTitle ${LANG_ENGLISH} "MOE Motion AI is ready"
LangString FinishTitle ${LANG_ARABIC}  "جاهز للشغل"
LangString FinishText ${LANG_ENGLISH} "In After Effects: Window › Extensions › MOE Motion AI.$\r$\n$\r$\nNext updates come from the panel itself (Settings › Updates), installed when you close After Effects."
LangString FinishText ${LANG_ARABIC}  "افتحها من جوه After Effects:$\r$\nWindow › Extensions › MOE Motion AI$\r$\n$\r$\nالتحديثات الجاية بتيجي من اللوحة نفسها، وبتتثبت لما تقفل After Effects"
LangString OpenAE ${LANG_ENGLISH} "Open After Effects now"
LangString OpenAE ${LANG_ARABIC}  "افتح After Effects دلوقتي"
LangString UnTitle ${LANG_ENGLISH} "Remove MOE Motion AI"
LangString UnTitle ${LANG_ARABIC}  "إزالة MOE Motion AI"
LangString UnSub ${LANG_ENGLISH} "The panel is removed; you choose whether your data goes too."
LangString UnSub ${LANG_ARABIC}  "اللوحة هتتشال، وبياناتك ماتتمسحش غير لو اخترت ده"
LangString CloseAE ${LANG_ENGLISH} "After Effects is open. Close it, then press Retry — the panel's files are replaced while it is closed."
LangString CloseAE ${LANG_ARABIC}  "After Effects مفتوح. اقفله ودوس إعادة المحاولة — ملفات اللوحة بتتبدل وهو مقفول."
LangString Downgrade ${LANG_ENGLISH} "A newer version ($R2) is installed. Replace it with ${VERSION}?"
LangString Downgrade ${LANG_ARABIC}  "فيه إصدار أحدث ($R2) متثبت. تحب تبدله بالإصدار ${VERSION}؟"
LangString AskData ${LANG_ENGLISH} "Also delete your MOE settings, presets, clients and saved API key?$\r$\n($APPDATA\MOE Motion AI)"
LangString AskData ${LANG_ARABIC}  "تحب تمسح كمان إعدادات MOE والبريستس والعملاء ومفتاح الـ API المحفوظ؟$\r$\n($APPDATA\MOE Motion AI)"


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


; $AEExe = AfterFX.exe of After Effects 2025 (or 2026), "" when not found.
; Registry first (HKLM ...\After Effects\<ver> InstallPath — read-only, no admin needed), then the default folders.
Function FindAE
  StrCpy $AEExe ""
  SetRegView 64
  ${ForEach} $R5 26 25 - 1
    ReadRegStr $R6 HKLM "SOFTWARE\Adobe\After Effects\$R5.0" "InstallPath"
    ${If} $R6 != ""
    ${AndIf} ${FileExists} "$R6\AfterFX.exe"
      StrCpy $AEExe "$R6\AfterFX.exe"
      ${Break}
    ${EndIf}
  ${Next}
  SetRegView lastused
  ${If} $AEExe == ""
    ${If} ${FileExists} "$PROGRAMFILES64\Adobe\Adobe After Effects 2025\Support Files\AfterFX.exe"
      StrCpy $AEExe "$PROGRAMFILES64\Adobe\Adobe After Effects 2025\Support Files\AfterFX.exe"
    ${ElseIf} ${FileExists} "$PROGRAMFILES64\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe"
      StrCpy $AEExe "$PROGRAMFILES64\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function LaunchAE
  ${If} $AEExe != ""
    Exec '"$AEExe"'
  ${EndIf}
FunctionEnd

; Welcome: the main button says what it will do (Install / Update)
Function WelcomeShow
  GetDlgItem $0 $HWNDPARENT 1
  ${If} $R2 == ""
  ${OrIf} $R2 == "${VERSION}"
    SendMessage $0 ${WM_SETTEXT} 0 "STR:$(BtnInstall)"
  ${Else}
    SendMessage $0 ${WM_SETTEXT} 0 "STR:$(BtnUpdate)"
  ${EndIf}
FunctionEnd

; Finish: the "Open After Effects" box only when After Effects was found
Function FinishShow
  ${If} $AEExe == ""
    ShowWindow $mui.FinishPage.Run ${SW_HIDE}
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

  Call FindAE
  ${If} $AEExe != ""
    StrCpy $AELine "$(AEFound)"
  ${Else}
    StrCpy $AELine "$(AEMissing)"
  ${EndIf}

  ReadRegStr $R2 HKCU "${UNINST}" "DisplayVersion"
  ${If} $R2 == ""
    StrCpy $Status "$(StNew)"
  ${ElseIf} $R2 == "${VERSION}"
    StrCpy $Status "$(StSame)"
  ${Else}
    StrCpy $Status "$(StUpdate)"
  ${EndIf}
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
  DetailPrint "$(StepClean)"
  Call RemoveLegacy

  ; Clean replace: the previous version's files go, the new ones come in.
  DetailPrint "$(StepCopy)"
  SetDetailsPrint listonly
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "${SRC}\*.*"
  SetDetailsPrint both

  ; Read back what was written: the manifest must be there and carry this version.
  DetailPrint "$(StepVerify)"
  StrCpy $5 ""
  ClearErrors
  FileOpen $4 "$INSTDIR\CSXS\manifest.xml" r
  ${IfNot} ${Errors}
    verify_line:
      FileRead $4 $6
      ${IfNot} ${Errors}
        ${StrStr} $7 $6 'ExtensionBundleVersion="${VERSION}"'
        StrCmp $7 "" verify_line
        StrCpy $5 "1"
      ${EndIf}
    FileClose $4
  ${EndIf}
  ${If} $5 != "1"
  ${OrIfNot} ${FileExists} "$INSTDIR\index.html"
    MessageBox MB_OK|MB_ICONSTOP "$(VerifyFail)" /SD IDOK
    Abort
  ${EndIf}

  ; Install record read by the panel (Settings › Updates).
  ${GetTime} "" "L" $0 $1 $2 $3 $4 $5 $6
  FileOpen $9 "$INSTDIR\install.json" w
  FileWrite $9 '{"installer":"nsis","version":"${VERSION}","installedAt":"$2-$1-$0T$4:$5:$6"}'
  FileClose $9

  DetailPrint "$(StepRegister)"
  ; Unsigned CEP extensions load only with PlayerDebugMode, read per CSXS version: 11 (After Effects 2024),
  ; 12 (2025, and 2026 as reported for 26.3), 13 (reported for newer builds). Writing all three is harmless.
  WriteRegStr HKCU "Software\Adobe\CSXS.11" "PlayerDebugMode" "1"
  WriteRegStr HKCU "${CSXS}" "PlayerDebugMode" "1"
  WriteRegStr HKCU "Software\Adobe\CSXS.13" "PlayerDebugMode" "1"

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
