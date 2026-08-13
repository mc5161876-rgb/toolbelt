# Toolbelt

Toolbelt is a local-first Windows app for remembering useful websites by the problem they solve. Save a site with a short “Use this when…” reason, then retrieve it through purpose-weighted search or visual category shelves.

Toolbelt also supports existing local `.html` and `.htm` files. It validates them on save, labels them `Local HTML`, and opens them through Windows while continuing to reject other local file types.

## What works in v0.1.2

- Visual desktop library with category shelves, favorites, recent usage, and detail views
- Purpose-weighted local fuzzy search across reasons, titles, tags, descriptions, categories, and domains
- Multiple use cases for the same canonical website instead of duplicate cards
- Manual add/edit, reversible Archive, open-count tracking, and JSON backup
- Existing local `.html` and `.htm` files, validated on save and opened through Windows
- Manifest V3 Chrome popup that captures page metadata and your personal reason
- Real website favicons, preview images, and captured brand colors for faster visual recognition
- A crisp small-size Toolbelt mark plus a neutral premium palette with selective multicolor accents
- Durable Chrome outbox that retries when Toolbelt is closed
- Private local JSON storage with atomic writes; no account or cloud service

## Install the Windows app

Run `release-installer-012/Toolbelt Setup 0.1.2.exe`. The installer offers a desktop shortcut and install-location choice. Windows may show an unknown-publisher warning because this personal build is not code-signed.

The live library is stored in Toolbelt's Windows app-data folder, not in this repository.

## Install the Chrome capture button

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project's `extension` folder, or unzip `release-installer-011/Toolbelt Chrome Extension 0.1.1.zip` and select the unzipped folder.
5. Pin Toolbelt from Chrome's Extensions menu.

If the desktop app is closed, the extension confirms the save and keeps it in a local outbox. It retries automatically after Toolbelt opens.

## Development

```powershell
npm install
npm run dev
npm run check
npm run build
```

The desktop bridge listens only on `127.0.0.1:47321` and accepts capture POSTs only from Chrome-extension origins carrying the Toolbelt capture header.
