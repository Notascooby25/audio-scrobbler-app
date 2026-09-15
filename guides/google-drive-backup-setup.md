# Google Drive Backup Setup Guide

This guide explains how to set up `rclone` to authenticate with Google Drive so that your database backups are automatically uploaded by the `backup_database.sh` script.

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

## 4. How the Backup Script Uses It

The `scripts/backup_database.sh` script automatically checks if `rclone` is installed. If it is, it will execute:

```bash
rclone copy "$backup_file" "gdrive:AudioScrobblerBackups/"
```

This creates a folder named `AudioScrobblerBackups` in the root of your Google Drive and places the backups inside. The script also automatically prunes files in this folder that are older than 14 days (this can be configured via the `GDRIVE_RETENTION_DAYS` environment variable).

## Changing Retention

By default, the script retains backups on Google Drive for 14 days. To change this, set the environment variable in your `.env` or `.env.production` file:

```env
GDRIVE_RETENTION_DAYS=30
```

