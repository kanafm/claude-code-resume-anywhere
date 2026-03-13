# Claude Code: Resume Anywhere

Claude Code only lets you resume conversations from the directory that conversation started from.

This tool, claude-hop, lets you hop to another directory and pick up the conversation where you left off.

Why is it useful? Suppose you started discussion with Claude Code, but realized later on that you want to implement in a different directory.

Under the hood, it's quite simple. Resuming symlinks to the original project in `~/.claude/`, while forking copies the conversation over.


## Usage

```
claude-hop --fork [<id>]      Copy conversation to current project + resume
claude-hop --resume [<id>]    Symlink conversation to current project + resume
claude-hop --import <id>      Copy conversation to current project (no resume)
claude-hop --list [<id>]      List conversations (optionally filter by partial ID)
```

## Development

Use Nix -

```
nix build
./result/bin/claude-hop -h
```

You can use home-manager if you love Nix, or just add the binary to your PATH.
