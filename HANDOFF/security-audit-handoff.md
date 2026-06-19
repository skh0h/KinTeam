# Dependency Security Audit Handoff

**Date:** 2026-06-18  
**Project:** base44-app (Vite + React frontend, Supabase backend)  
**Status:** NOT YET REMEDIATED — audit only

---

## Executive Summary

An `npm audit` was run on 2026-06-18 across 683 total packages, revealing **20 vulnerabilities**:
- **1 Low** severity
- **10 Moderate** severity  
- **9 High** severity
- **0 Critical** severity

**Key Finding:** ~18 of 20 are fixable with a single safe command (`npm audit fix`), with no breaking changes. The one exception is `react-quill` (XSS vulnerability), which has **NO safe auto-fix** and requires a package migration.

---

## Runtime Vulnerabilities (Affect End Users)

These packages are shipped to users and carry real security risk if exploited.

| Package | Severity | Issue | Pulled in by | Fix |
|---------|----------|-------|--------------|-----|
| react-quill / quill ≤1.3.7 | Moderate | XSS in rich-text editor, exploitable by anyone who can type into it | direct dep (react-quill@2.0.0) | NO safe auto-fix — migrate (see Tier 2) |
| dompurify ≤3.4.10 | Moderate (16 advisories) | Sanitizer bypass / prototype pollution; risky if user HTML flows into PDFs | jspdf | `npm audit fix` (may also need `npm install jspdf@latest`) |
| lodash ≤4.17.23 | High | Code injection via `_.template`, prototype pollution | direct dep, react-quill, recharts | `npm audit fix` |
| react-router 6.7–6.30 | Moderate | Open redirect via `//` path in same-origin redirects | direct dep | `npm audit fix` |
| socket.io-parser 4.0–4.2.5 | High | Unbounded binary attachments → memory exhaustion DoS | @base44/sdk → socket.io-client | `npm audit fix` (may need `npm install @base44/sdk@latest`) |
| ws 8.0–8.20.1 | High | Memory disclosure + DoS via WebSocket fragmentation | @base44/sdk → socket.io-client → engine.io-client | `npm audit fix` |
| form-data 4.0.0–4.0.5 | High | CRLF injection in multipart field names | @base44/sdk → axios | `npm audit fix` |

**Note on @base44/sdk-related risks:** The ws, socket.io-parser, and form-data vulnerabilities mostly require a malicious SERVER to exploit, so practical risk is low if the base44 backend is trusted — but they should still be fixed.

---

## Dev/Build-Only Vulnerabilities (NOT Shipped to Users)

All cleared by `npm audit fix`. These packages only run during development and the build process, so risk to production users is minimal. However, they pose risk to CI/CD machines and developer machines.

**Dev/build-only packages cleared by `npm audit fix`:**
- **vite** ≤6.4.2 (High ×4) — dev server file read / path traversal
- **rollup** 4.0–4.58.0 (High) — path traversal during build
- **@babel/core** ≤7.29.0 (Low) — file read via sourceMappingURL
- **ajv** <6.14.0 (Moderate) — ReDoS in eslint
- **brace-expansion** <1.1.13 (Moderate) — process hang
- **minimatch** ≤3.1.3 (High) — ReDoS
- **picomatch** ≤2.3.1 & 4.0.0–4.0.3 (High) — method injection + ReDoS
- **postcss** <8.5.10 (Moderate) — XSS in CSS stringify
- **js-yaml** ≤4.1.1 (Moderate) — ReDoS in eslint YAML
- **flatted** ≤3.4.1 (High) — prototype pollution in eslint cache

---

## Remediation Plan (Prioritized)

### Tier 1 — Safe, Run First (Resolves ~18/20)

Run this first. It is safe and has no breaking changes.

```bash
npm audit fix
```

**Then verify the results:**

```bash
npm audit
npm ls lodash dompurify react-router ws
```

Expected outcome: Most vulnerabilities should be resolved. If any remain, proceed to Tier 2.

---

### Tier 2 — Manual, Requires Review

#### react-quill (XSS — NO Safe Auto-Fix)

**CRITICAL PREREQUISITE:** react-quill is an abandoned package. Running `npm audit fix --force` will install a broken stub version (`react-quill@0.0.2`), which breaks the application. Do **NOT** do this.

**Step 1: Determine if react-quill is actually used**

Check if `react-quill` is actively used in the codebase:

```bash
grep -r "react-quill" src/
```

- **If NO results:** react-quill is an unused leftover dependency. Fix is simple:
  ```bash
  npm uninstall react-quill
  ```

- **If results found:** react-quill IS used. Proceed to the migration below.

**Step 2: Migrate to the maintained fork (if used)**

The recommended drop-in replacement is `react-quill-new`, a maintained fork of react-quill:

```bash
npm uninstall react-quill
npm install react-quill-new
```

Update all imports in the codebase:

```bash
# From:
import ReactQuill from 'react-quill';

# To:
import ReactQuill from 'react-quill-new';
```

You can automate this with a find-and-replace:

```bash
grep -r "from 'react-quill'" src/ | cut -d: -f1 | sort -u | while read file; do
  sed -i "s/from 'react-quill'/from 'react-quill-new'/g" "$file"
done
```

**Step 3: Test the migration**

After updating imports, test the rich-text editor features thoroughly to ensure functionality is preserved.

**Heavier alternatives (if react-quill-new does not work):**
- **Tiptap:** A modern, well-maintained rich-text editor with good TypeScript support.
- **Lexical:** Meta's flagship editor, battle-tested at scale.

#### @base44/sdk (Controls ws / socket.io Versions)

If `npm audit fix` does not clear the `ws` and `socket.io-parser` vulnerabilities, check if @base44/sdk needs to be updated:

```bash
npm outdated @base44/sdk
npm install @base44/sdk@latest
```

Re-run `npm audit` to verify those vulnerabilities are resolved.

#### jspdf + dompurify

If `npm audit fix` does not bump the nested dompurify dependency, explicitly update jspdf:

```bash
npm install jspdf@latest
```

---

### Tier 3 — No Fix Available

None, except the **react-quill migration** (upstream abandoned). All other vulnerabilities are cleared by Tier 1 + Tier 2.

---

## Final Risk Verdict

| Risk | Guidance |
|------|----------|
| **Before Tier 1** | DO NOT deploy to production. Running `npm audit fix` is mandatory. |
| **After Tier 1** | Tier 1 is safe and removes ~18/20 vulnerabilities. Deploy-eligible *unless* react-quill XSS is a blocker. |
| **react-quill blocker** | If react-quill is used and outputs rich-text to users, the XSS is a production blocker. Must complete Tier 2 migration before deploying. |
| **Tier 2 complete** | All 20 vulnerabilities resolved. Safe to deploy. |
| **Dev-only findings** | Cleared by Tier 1. Protect CI/dev machines; users are unaffected. |

---

## Post-Remediation Validation

After applying fixes, run this to confirm all fixable vulnerabilities are resolved:

```bash
npm audit
```

**Expected result:** Either 0 vulnerabilities, or only react-quill remaining (if not yet migrated).

---

## Decision Matrix for the Next Person

The remediation has **NOT** been applied yet. Choose your path:

| Choice | Approach |
|--------|----------|
| **(a) Tier 1 only** | Run `npm audit fix`, verify, deploy. Quick but leaves react-quill XSS unresolved if it's used. |
| **(b) Tier 1 + react-quill migration** | Check if react-quill is used; if yes, migrate to react-quill-new. Recommended if you want 0 vulnerabilities. |
| **(c) Investigate first, then decide** | Start with `grep -r "react-quill" src/`. If unused, uninstall it; run Tier 1. If used, do Tier 1 + migration. **Recommended.** |

---

## Quick Reference: Commands to Run

```bash
# Investigate react-quill usage
grep -r "react-quill" src/

# Tier 1 (safe auto-fix)
npm audit fix
npm audit  # Verify

# If react-quill is used
npm uninstall react-quill
npm install react-quill-new
# Update imports: 'react-quill' → 'react-quill-new'

# If @base44/sdk needs update
npm install @base44/sdk@latest

# If jspdf/dompurify still vulnerable
npm install jspdf@latest

# Final verification
npm audit
npm ls lodash dompurify react-router ws socket.io-parser form-data
```

---

## Contacts & Escalation

- **Audit Date:** 2026-06-18
- **Audit Tool:** npm audit (npm v10+)
- **Total Packages:** 683
- **Vulnerabilities Reported:** 20 (1 Low, 10 Moderate, 9 High, 0 Critical)

If you encounter breaking changes or issues during remediation, review the package changelogs or consider pinning versions and opening a GitHub issue for your project.
