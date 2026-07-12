# Security Policy

## Supported versions

The latest released version receives security updates.

| Version | Supported          |
|---------|--------------------|
| 1.2.x   | :white_check_mark: |
| < 1.2   | :x:                |

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately via one of:

- GitHub Security Advisories ("Report a vulnerability" on the Security tab)
- Email: **luyangkk@gmail.com**

Please include reproduction steps and affected version. We aim to acknowledge
reports within 5 business days and to provide a remediation timeline after
triage.

## Scope note

Duplicate Tabs Killer runs entirely on your machine: no server, no account, and
no external API calls. All data (archived sessions, screenshot previews) is
stored locally via `chrome.storage.local`. This narrows the attack surface to
the extension bundle and the Chrome APIs it uses.
