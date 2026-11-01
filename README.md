# ReportTracker.Web

Angular 22 client for the sibling `ReportTracker` API project.

## Run

Use Node 22.22.3+, 24.15.0+, or a newer supported release.

```powershell
npm ci
npm start
```

Start the API on `http://localhost:5092`, then open `http://localhost:4200`. `proxy.conf.json` forwards `/api` to that API.

The first visit creates the initial workspace account. Afterward, sign in with a local account. The session cookie is HttpOnly; Angular supplies the CSRF header for same-origin updates. Passwords and bearer tokens are never stored in browser local storage. API failures produce visible errors rather than demo rows.

Report Coordinators can create report definitions and explicit reporting cycles. Administrators manage divisions and user accounts. Assigned officers record full or partial sending and inspect persisted history. Deadlines and actual sending times are entered in Asia/Dhaka and converted to UTC before saving.

The API retains an optional JWT bearer scheme for future bank SSO. Browser SSO integration requires the bank's provider metadata; it is not active yet.

## Verify

```powershell
npm run build
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit
```

Production hosting should serve the client and `/api` through one HTTPS origin. The development proxy is not part of the production bundle.

See the API project's `BB_Reporting_Tracker_Plan.md` and README for the requirements baseline and remaining workflows.
