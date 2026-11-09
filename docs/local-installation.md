# Local installation and hosting

[→ Version française](../localizedReadme/installation-locale.md)

This guide covers the current **web application**.

## 1. Choose the intended usage

- **Development:** run the source code with Vite and automatic reload.
- **Customer/intranet hosting:** build the application once, then publish the
  static contents of `dist/` with an HTTP(S) server.
- **Offline delivery:** provide the generated `dist/` directory and a local
  static web server. Node.js is not required on the customer machine when the
  build artifact is supplied.

Opening `dist/index.html` directly from the filesystem is not supported.

## 2. Prerequisites

To work from the source code:

- Git;
- Node.js 18 or later;
- npm;
- access to the npm registry for the initial dependency installation.

Check the installed versions with:

```shell
node --version
npm --version
```

## 3. Run the development server

From the repository root:

```shell
npm ci
npm run dev
```

The application is then available at:

```text
http://localhost:5173/EasyCodec/
```

Use `npm ci` for a reproducible installation based on `package-lock.json`.
On Windows PowerShell, use `npm.cmd` instead of `npm` if the system execution
policy blocks the `npm.ps1` wrapper.

### Access from another machine on the LAN

```shell
npm run dev -- --host 0.0.0.0
```

Open `http://<host-ip>:5173/EasyCodec/` from the other machine. The operating
system firewall must allow the port. This mode is intended for development and
temporary demonstrations, not production hosting.

## 4. Create and validate a production build

```shell
npm ci
npm run build
```

The deployable files are generated in `dist/`. To validate that build locally:

```shell
npm run preview
```

`npm run preview` is a verification server, not a production server.

## 5. Host the application for a customer

Publish the **contents** of `dist/` with an HTTP(S) server under:

```text
https://<server>/EasyCodec/
```

The current build has `/EasyCodec/` hard-coded as its Vite base path. The web
server must therefore:

1. expose the static files under `/EasyCodec/`;
2. serve existing assets and JSON files directly;
3. return `/EasyCodec/index.html` for application routes that do not match a
   file or directory (SPA fallback).

An Apache `.htaccess` implementing this fallback is copied into `dist/`. It
requires `mod_rewrite` and permission to use `.htaccess` overrides. Equivalent
rewrite rules are required for Nginx, IIS, or another server.

To deploy at `/` or another path, update both `base` in `vite.config.ts` and
`RewriteBase` in `public/.htaccess`, then rebuild. `VITE_BASE_URL` does not
currently configure the base path.

For an intranet installation, also check DNS/IP addressing, the host firewall,
the listening ports, and the TLS certificate if HTTPS is used.

## 6. Update sensor configurations without rebuilding

The files from `public/` are copied unchanged into `dist/` during the build.
After deployment, configuration maintainers can therefore update:

- `config/*.json` for sensor configurations;
- `config/AvailableProductList.json` for the product list;
- `localisation/*.json` for translations.

The paths above are relative to the deployed `EasyCodec` directory. A product
must include `"EasyCodec"` in its `apps` array to appear in the application.
Keep a backup and validate JSON syntax before publishing a change.

Source changes under `src/`, dependency changes, and changes to Vite settings
still require a new `npm run build`.

## 7. Offline behaviour

The application logic, styles, images, translations, and sensor configuration
files are included in the static build. The main application can therefore run
on an isolated network once it is hosted locally.

Some optional links point to Watteco support pages, and the favicon is loaded
from `lora.watteco.fr`; these resources will not be available without internet
access. Building from source also requires dependencies to be available from
npm or from an internal package mirror/cache.

## 8. Deployment checklist

- `npm run build` completes successfully.
- The contents of `dist/` are published under `/EasyCodec/`.
- `/EasyCodec/` loads over HTTP(S).
- Direct navigation and refresh on `/EasyCodec/tabs/downlink` work.
- `/EasyCodec/config/AvailableProductList.json` returns JSON.
- `/EasyCodec/localisation/fr_FR.json` returns JSON.
- The browser console contains no missing asset or JSON errors.

Typical causes of a blank page are deployment at the wrong base path, missing
SPA rewrite rules, or missing files under `config/` or `localisation/`.
