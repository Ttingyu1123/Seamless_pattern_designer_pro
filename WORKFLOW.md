# Git Workflow

## One-command push (recommended)

From project root:

```powershell
npm run ship -- "feat: your commit message"
```

This runs:

1. `git status`
2. `git add .`
3. `git commit -m "..."`
4. `git push`

If you do not pass a message, it auto-generates one with timestamp.

## Manual fallback

```powershell
git status
git add .
git commit -m "feat: your commit message"
git push
```

## If push is rejected

```powershell
git pull --rebase
git push
```
