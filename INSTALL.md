# Install & update MOE Motion AI

## بالعربي — التسطيب في 3 خطوات
1. اقفل After Effects.
2. شغّل **`MOE-Motion-AI-Setup-x.y.z.exe`** واضغط Next ← Finish. (مش محتاج صلاحيات Admin.)
   لو ويندوز ظهرلك "Windows protected your PC": اضغط **More info ← Run anyway** (المثبّت لسه مش موقّع بشهادة).
3. افتح After Effects ← **Window › Extensions › MOE Motion AI**.

**التحديث:** من جوه البلجن **Settings › Updates ← Check now ← Download & verify ← Install when I close After Effects**.
أو شغّل أي Setup أحدث. في الحالتين النسخة الجديدة بتتحط **مكان القديمة بالظبط** — فولدر واحد، إدخال واحد في Apps، ومفيش نسخ بتتراكم.
إعداداتك والبريستس والعملاء ومفتاح الـ API محفوظين في فولدر منفصل (`%APPDATA%\MOE Motion AI`) ومبيتلمسوش.

**الإزالة:** Settings ← Apps ← MOE Motion AI ← Uninstall (هيسألك لو عايز تمسح إعداداتك كمان).

## English
### Install
1. Close After Effects.
2. Run **`MOE-Motion-AI-Setup-x.y.z.exe`** (per-user, no admin rights). SmartScreen may say "Windows protected your PC" because the installer is not code-signed yet → **More info › Run anyway**.
3. Open After Effects → **Window › Extensions › MOE Motion AI**.

What the installer does:
- copies the panel to one fixed folder: `%APPDATA%\Adobe\CEP\extensions\tv.madtomato.moe.motionai` (wiped and rewritten on every install — no stale files);
- removes older manual copies of MOE (folders `moe-motion-ai*` / `MOE Motion AI` carrying the same bundle id; a developer junction is only unlinked);
- sets `HKCU\Software\Adobe\CSXS.12\PlayerDebugMode = 1` (needed for unsigned CEP panels);
- adds one entry to *Settings › Apps* (version updated on every install) with an uninstaller.

### Update
- **Inside the panel:** Settings › Updates → *Check now* → *Download & verify* (size + SHA-256 from the feed) → *Install when I close After Effects*. The installer waits in the background until After Effects quits, then replaces the installed copy silently. Reopen AE.
- **Or** run a newer Setup .exe — same result. Running an older one asks before downgrading.
- Your data (`%APPDATA%\MOE Motion AI`: settings, presets, clients, DPAPI-protected API key) is never touched by install or update.

### Uninstall
Settings › Apps › MOE Motion AI › Uninstall. It asks whether to delete your data too (default: keep). Silent: `"%LOCALAPPDATA%\Programs\MOE Motion AI\Uninstall MOE Motion AI.exe" /S` (keeps data).

### Command line (IT / scripted installs)
| Command | Effect |
|---|---|
| `Setup.exe /S` | silent install / update |
| `Setup.exe /WAITAE` | wait until After Effects has closed, then install silently |

## Publishing an update (maintainer)
1. Bump the version in `package.json`, `extension/CSXS/manifest.xml` (2×), `extension/host/index.jsx`, `extension/core/services.js` and add a `CHANGELOG.md` section — the release script refuses mismatches.
2. `npm run release` → `dist/MOE-Motion-AI-Setup-<v>.exe`, `dist/MOE-Motion-AI-<v>-portable.zip`, `dist/latest.json` (needs `makensis`: `apt install nsis` on Linux, or NSIS on Windows).
3. Upload the **.exe and latest.json side by side** to any HTTPS location (a GitHub Release, a company server, a shared S3 bucket). The installer URL inside `latest.json` is relative unless `MOE_UPDATE_BASE_URL` is set.
4. Put the `latest.json` URL in Settings › Updates › Update feed (once per machine). Panels check at start (at most twice a day) and show an **Update** pill in the header.

## Developer mode
`powershell -ExecutionPolicy Bypass -File tools\install-dev.ps1` links the repo instead (see README). Don't mix it with the installer: the installer unlinks the developer copy so only one MOE is loaded.
