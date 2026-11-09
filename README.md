# Watteco Easy Codec
[→ En Français](localizedReadme/README-fr.md)

<p align="center">
    <a href="https://ionicframework.com/" target="_blank">
        <img alt="Ionic badge" title="Built with Ionic" src="https://img.shields.io/badge/Ionic-3880FF?style=for-the-badge&logo=ionic&logoColor=white"/>
    </a>
    <a href="https://capacitorjs.com/" target="_blank">
        <img alt="Capacitor badge" title="Built with Capacitor" src="https://img.shields.io/badge/Capacitor-119EFF?style=for-the-badge&logo=capacitor&logoColor=white"/>
    </a>
    <a href="https://vuejs.org/" target="_blank">
        <img alt="Vue.js badge" title="Built with Vue.js" src="https://img.shields.io/badge/Vue.js-42b883?style=for-the-badge&logo=vue.js&logoColor=white"/>
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
        <img alt="TypeScript badge" title="Built with TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"/>
    </a>
</p>
<p align="center">
    <img alt="Browser Support badge" title="Works in all modern browsers" src="https://img.shields.io/badge/browser-modern-brightgreen?style=for-the-badge&logo=googlechrome&logoColor=white"/>
    <img alt="Platform badge" title="Web application" src="https://img.shields.io/badge/platform-Web-orange?style=for-the-badge&logo=ionic"/>
</p>

**Watteco Easy Codec** (working title) is an intuitive application designed to simplify the configuration and usage of Watteco IoT sensors. The main objective of this project is to offer a lightweight and user-friendly alternative to the existing online codec, focusing on essential features while modernizing the user interface.  
  
## Table of Contents

- [Project Goals](#project-goals)
- [Current Features](#current-features)
  - [Web Version](#web-version)
- [Technical Stack](#technical-stack)
  - [Frameworks and Technologies](#frameworks-and-technologies)
  - [File Organization](#file-organization)
- [Current State](#current-state)
  - [Local Development and Hosting](#local-development-and-hosting)
  - [Production Version](#production-version)
- [Future Development](#future-development)

## Project Goals

1. **Simplification**: Reduce configuration complexity by focusing on the most commonly used core functionalities for standard users.
2. **Accessibility**: Provide a modern and intuitive user interface, suitable for users of all technical levels.
3. **Portability**:
   - A web application accessible via a browser.
   - Standalone versions for Windows and macOS built with [Electron](https://www.electronjs.org/).
   - Mobile applications for Android and iOS.
4. **Advanced Support**:
   - Integration of **FOTA (Firmware Over-The-Air)** configuration for the PC version.
   - Support for **NFC (Near Field Communication)** configuration on mobile versions.

## Current Features

### Web Version
The project is currently hosted at: [Watteco Easy Codec](https://lora.watteco.fr/EasyCodec/).

#### Implemented Features:
- **Simplified Interface**: A modern UI with dynamic sensor management.
- **Configuration Loading**:
  - Management of parameters via JSON files.
  - Display of sensor-specific configurations.
- **Support for Multiple Sensors**: While not exhaustive yet, the main Watteco sensors are supported.

## Technical Stack

### Frameworks and Technologies
- **Ionic**: Used to develop a modern and responsive interface.
- **Vue.js**: JavaScript framework for managing state and reactive components.
- **Electron**: Planned for the standalone (offline) version.
- **Android/iOS**: Mobile versions will be built using Ionic Capacitor.
- **FOTA**: For firmware updates and sensor configuration on the PC version.
- **NFC**: For sensor configuration on mobile versions.

### File Organization
- **Front-End**: Built with Ionic and Vue.js, following a modular architecture.
- **Assets**: Configuration JSON files are stored in `public/config/`. Once
  deployed, they can be updated in `config/` without rebuilding the project.

## Current State

### Application version

`package.json` is the source of the application version. Vite injects it into
the header.

### Local Development and Hosting

The development server can be started with:

```shell
npm ci
npm run dev
```

The production build is a static web application that can also be hosted on a
customer's local server or intranet. It is currently built for the
`/EasyCodec/` URL path and must be served over HTTP(S); opening `index.html`
directly is not supported.

See the [local installation and hosting guide](docs/local-installation.md) for
prerequisites, development, production deployment, LAN access, offline usage,
and configuration updates.

### Production Version
The functional web version is available at: [https://lora.watteco.fr/EasyCodec/](https://lora.watteco.fr/EasyCodec/). It is currently being tested with limited sensor support.

## Future Development

The next development steps include:
1. **Complete Sensor Support**: Integration of all Watteco sensors and their configurations.
2. **Mobile and PC Versions**:
   - Packaging the application with Electron for Windows/macOS.
   - Generating Android and iOS apps using Ionic Capacitor.
3. **FOTA and NFC**:
   - Integrating FOTA configuration into the PC standalone version.
   - Activating NFC configuration for mobile versions.

---

This README aims to provide an overview of the **Watteco Easy Codec** project. While this project is hosted on GitHub, it is not currently open to external contributions.
