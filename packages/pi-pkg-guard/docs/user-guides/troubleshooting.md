# Troubleshooting

> Common issues and solutions

---

## Installation Issues

### Extension not appearing in pi

**Symptoms:**
- `/package-guard` command not found
- No startup warnings displayed

**Diagnosis:**

1. Check registration:
   ```bash
   cat ~/.pi/agent/settings.json | grep pi-pkg-guard
   ```

2. Check extension directory:
   ```bash
   ls ~/.pi/agent/extensions/ | grep pi-pkg-guard
   ```

**Solutions:**

- If not in settings.json: Reinstall via `pi install npm:pi-pkg-guard`
- If extension directory missing: Reinstall
- Restart pi completely after installation

### "Permission denied" during npm install

**Solution 1:** Fix npm permissions (recommended)
```bash
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Solution 2:** Use pi install instead
```bash
pi install npm:pi-pkg-guard
```

---

## Runtime Issues

### Startup warning not appearing

**Possible Causes:**
- Check ran within last hour (debounced)
- No unregistered packages exist
- Extension not loading

**Diagnostic:**
```
/package-guard scan
```

If this shows unregistered packages, the startup check should work. Restart pi to trigger.

### npm guard not triggering

**Symptoms:** Running `npm install -g pi-foo` doesn't show warning

**Check:**
- Is it a bash tool call? Guard only works via pi's bash tool
- Does package name contain `pi-`? Guard requires pi-prefix

**Manual Test:**
```
# In pi, use bash tool:
npm install -g pi-test-package
```

### Menu not appearing

**Symptoms:** `/package-guard` shows nothing or errors

**Solutions:**
1. Check extension loaded: Look for pi-pkg-guard in startup messages
2. Try running again: May be temporary glitch
3. Check pi version: Requires latest pi

---

## Backup & Restore Issues

### "Gist sync failed"

**Error:** `✗ Gist sync failed`

**Diagnosis:**
```bash
gh auth status
```

**Solutions:**
- Not authenticated: `gh auth login`
- Token expired: `gh auth refresh`
- Gist ID invalid: Check config and reconfigure

### "Invalid backup path"

**Cause:** Path outside allowed directories

**Allowed paths:**
- `~/.pi/agent/*`
- `/tmp/*`

**Fix:** Choose a path within these directories.

### "Backup file not found"

**Cause:** No backup has been created yet

**Fix:**
```
/package-guard backup
```

### Restore shows no packages

**Possible Causes:**
- Backup file is empty
- All packages already registered
- Wrong backup source selected

**Check backup content:**
```bash
cat ~/.pi/agent/package-guard-backup.json
```

---

## Configuration Issues

### Settings not persisting

**Symptoms:** Custom path or Gist ID lost after restart

**Check:**
```bash
cat ~/.pi/agent/settings.json
```

Look for `"pi-pkg-guard"` section.

**Solutions:**
- Check file permissions
- Ensure no JSON syntax errors
- Try reconfiguring

### Gist ID lost

**Recovery:**
1. Find Gist on GitHub: https://gist.github.com/
2. Copy Gist ID from URL
3. Use `/package-guard config` → `Gist...` → `Connect Gist`

---

## Getting Help

If issues persist:

1. **Check pi version:** Update to latest
2. **Check extension version:** `cat ~/.pi/agent/extensions/pi-pkg-guard/package.json | grep version`
3. **Review pi logs:** Check startup messages for errors
4. **File an issue:** https://github.com/earendil-works/pi-mono/issues

---

*[← Back to User Guides](./README.md)*
