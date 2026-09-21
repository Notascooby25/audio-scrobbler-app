# Google Drive Backup Setup Guide

This guide explains how to set up `rclone` to authenticate with Google Drive so that your database backups are automatically uploaded by the `backup_database.sh` script.

> **Encrypt the uploads.** Steps 1–3 create a plain `gdrive` remote. Do that first,
> then wrap it in an encrypted (crypt) remote in step 4 and point the script at
> *that*. The script's built-in fallback is the plain remote, so skipping step 4 —
> or forgetting `GDRIVE_REMOTE_NAME` — silently uploads your dumps unencrypted.

> **Note for Existing Setups:** If you already have `rclone` installed and configured on your server (e.g., your NUC), you can skip to **Step 3**.

## 1. Install rclone (If not already installed)

`rclone` is a command-line program to manage files on cloud storage.

On Debian/Ubuntu:
```bash
sudo apt update
sudo apt install rclone
```

On macOS (using Homebrew):
```bash
brew install rclone
```

## 2. Configure rclone for Google Drive (If not already configured)

We need to create a new remote. By default, the script looks for one named **`gdrive`**. Run the following command:

```bash
rclone config
```

You will see an interactive prompt. Follow these steps:

1. **`e/n/d/r/c/s/q>`**: Type **`n`** for "New remote".
2. **`name>`**: Type **`gdrive`**.
3. **`Storage>`**: Look for Google Drive in the list of providers (it is usually numbered, e.g., `18`). Type **`drive`** or the corresponding number.
4. **`client_id>`**: Leave blank and press **Enter**.
5. **`client_secret>`**: Leave blank and press **Enter**.
6. **`scope>`**: Choose the scope that allows full access to drive, typically number **`1`** (`drive`).
7. **`root_folder_id>`**: Leave blank and press **Enter**.
8. **`service_account_file>`**: Leave blank and press **Enter**.
9. **`Edit advanced config? (y/n)>`**: Type **`n`**.
10. **`Use auto config? (y/n)>`**: Type **`y`**. (This will open your web browser so you can log into your Google Account and grant permission. If you are doing this on a headless server via SSH, type `n` and follow the provided instructions to authenticate using a local machine).
11. **`Configure this as a Shared Drive (Team Drive)? (y/n)>`**: Type **`n`** (unless you are using a shared drive).
12. **`y/e/d>`**: Type **`y`** to confirm the configuration.
13. **`e/n/d/r/c/s/q>`**: Type **`q`** to quit the config wizard.

## 3. Verify Your Configuration & Remote Name

If you already had `rclone` set up, you might have named your Google Drive remote something other than `gdrive`. You can check your existing remotes with:

```bash
rclone listremotes
```

If your remote is named something else (e.g., `my_drive:`), you don't need to rename it! You can simply tell the backup script to use your existing remote by setting this environment variable in your `.env` or `.env.production` file:

```env
GDRIVE_REMOTE_NAME=my_drive
```

Test that `rclone` can connect to your Google Drive by listing the root directory (replace `gdrive:` with your remote name if different):

```bash
rclone ls gdrive:
```

If it lists files from your Google Drive without errors, the setup is complete!

## 4. Wrap it in an encrypted (crypt) remote

Run `rclone config` again and create a second remote:

1. **`n`** for a new remote, name it **`gdrive-crypt`**.
2. Storage: **`crypt`**.
3. `remote>`: a folder inside the plain remote, e.g. `gdrive:encrypted-nuc-backups`.
4. Filename encryption: **`standard`**. Directory name encryption: **`true`**.
5. Password and salt password: let rclone **generate** both (choose `g`) and keep them.

> **Store the whole config in your password manager — not just the
> passphrase.** Recreating a crypt remote needs `password`, `password2`, `remote`,
> `filename_encryption` and `directory_name_encryption` to all match. Without them
> every uploaded dump is unreadable noise. `rclone.conf` lives in
> `~/.config/rclone/`, outside anything the NAS mirror copies.
>
> **Save it as one base64 line, not as plain text:**
> `base64 -w0 ~/.config/rclone/rclone.conf`. A multi-line note is often flattened
> by password managers, and the long Google token can be damaged — a copy saved
> that way could not be restored. Then prove the saved copy works with the drill in
> [docs/DISASTER_RECOVERY.md](../docs/DISASTER_RECOVERY.md#before-you-need-any-of-this).

Then tell the script to use it, in `.env.production`:

```env
GDRIVE_REMOTE_NAME=gdrive-crypt
```

## 5. How the Backup Script Uses It

The `scripts/backup_database.sh` script automatically checks if `rclone` is installed. If it is, it will execute:

```bash
rclone copy "$backup_file" "${GDRIVE_REMOTE_NAME}:AudioScrobblerBackups/"
```

This creates a folder named `AudioScrobblerBackups` on that remote (encrypted, when it is a crypt remote) and places the backups inside. The script also prunes files in this folder that are older than `GDRIVE_RETENTION_DAYS`.

Confirm it works end to end — this restores the newest uploaded dump into a throwaway database:

```bash
scripts/restore_drill.sh gdrive
```

The drill refuses to run against a non-crypt remote, so it also catches the "forgot `GDRIVE_REMOTE_NAME`" mistake.

## Changing Retention

The script's built-in default is 14 days, and `.env.example` sets 30 (what the NUC uses). To change it, set the environment variable in your `.env` or `.env.production` file:

```env
GDRIVE_RETENTION_DAYS=30
```

