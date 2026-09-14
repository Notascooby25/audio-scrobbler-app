# Version Control Rules
- At the end of every task or major step that involves modifying files, you MUST use the `run_command` tool to stage all changes, commit them with a descriptive commit message explaining the reason for the changes, and push them to the current branch on GitHub.
- Example command: `git add -A && git commit -m "feat: <description of changes>" && git push` (If the branch has no upstream, use `--set-upstream origin <branch-name>`).
