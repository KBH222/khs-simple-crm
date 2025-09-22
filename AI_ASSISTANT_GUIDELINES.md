# AI Assistant Guidelines - Avoiding Common Issues

## PowerShell Command Issues
- **NEVER use bash syntax** (`&&`, `||`) in PowerShell
- **ALWAYS use PowerShell syntax** (`;` or separate commands)
- **Example**: Instead of `git add . && git commit -m "message"`, use:
  ```powershell
  git add .
  git commit -m "message"
  ```

## Complex Operations
- **BREAK DOWN** complex multi-step operations
- **DO ONE THING** at a time
- **CHECK STATUS** before proceeding
- **Example**: Instead of trying to do 5 things at once, do them sequentially

## File Operations
- **CHECK CURRENT DIRECTORY** first with `pwd` or `Get-Location`
- **LIST FILES** before making changes with `ls` or `Get-ChildItem`
- **VERIFY PATHS** exist before using them

## Git Operations
- **ALWAYS check git status** first: `git status`
- **COMMIT CHANGES** before pushing: `git add .` then `git commit -m "message"`
- **PUSH SEPARATELY** after commit: `git push`

## When Stuck - Quick Fixes
- **"Use PowerShell syntax"** - When trying bash commands
- **"One at a time"** - When trying complex operations  
- **"Check status first"** - Before making changes
- **"What's the error?"** - When something fails
- **"Start over"** - Reset and try different approach
- **"Use different method"** - Try alternative solution

## Proactive Approach
1. **Check status first** before making changes
2. **Use simple, single commands** instead of complex ones
3. **Ask for clarification** when unsure
4. **Don't repeat failed approaches** - try something different
5. **Break down complex tasks** into smaller steps

## Common Commands
```powershell
# Check current directory
Get-Location

# List files
Get-ChildItem

# Git status
git status

# Git add and commit (separate commands)
git add .
git commit -m "message"

# Git push
git push

# Check if server is running
netstat -ano | findstr :3001

# Start server
node server.js
```

## Remember
- **PowerShell is NOT bash** - use proper syntax
- **One command at a time** - don't chain complex operations
- **Check before acting** - verify status and paths
- **Ask for help** when stuck instead of repeating failures
