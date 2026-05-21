# @alexleekt/pi-herdr-tab-sync

> Part of the [`pi-extensions`](../../) monorepo.

Sync pi session name to [herdr](https://herdr.dev) tab label.

## Behavior

- On **session resume** (`/resume`): if the session has a name, the herdr tab is renamed immediately.
- On **agent start**: if the session name changed (e.g. after `/name`), the herdr tab is updated.
- If the session has **no name**, nothing happens — the tab label stays as-is.

Only activates inside herdr-managed panes (`HERDR_ENV=1`).

## Install

```shell
ln -s ~/git/pi-extensions/packages/pi-herdr-tab-sync ~/.pi/agent/extensions/pi-herdr-tab-sync
```

Then `/reload` in pi or restart.

## License

MIT. Originally derived from [justcyl/pi-herdr-tab-sync](https://github.com/justcyl/pi-herdr-tab-sync).
