# Git worktrees and repo operations

## Owns

- Worktree creation, switching, merging, and cleanup
- Git diffs, status, and branch tracking
- Worktree metadata persistence

## Does not own

- Agent planning/execution
- UI flow or state management

## Key files

- apps/server/src/routes/worktree/\*\*
- apps/server/src/routes/git/\*\*
- apps/server/src/lib/worktree-metadata.ts
- libs/git-utils/src/\*\*

## Invariants

- Feature worktrees are isolated (see .automaker/worktrees)
- Operations should validate project paths before git actions
- Destructive actions (delete, merge) should be explicit and logged

## Common mistakes and risks

- Running git commands in the wrong working directory
- Deleting or cleaning worktrees without user confirmation
- Cross-platform path issues or line ending assumptions
