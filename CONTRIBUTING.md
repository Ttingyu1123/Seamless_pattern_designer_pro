# Contributing

Thank you for considering a contribution to Seamless Pattern Designer PRO.

This project is a local-first browser tool for artists and pattern designers. Contributions should preserve the core promise: artwork is processed in the browser and does not need to be uploaded to a server.

## Local setup

Requirements:

- Node.js 18 or newer, with Node.js 20 recommended.
- npm.

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run validation before opening a pull request:

```bash
npm run lint
npm run build
```

## Useful contribution areas

- Accessibility improvements for controls, canvas interactions, keyboard flow, and status messages.
- Export reliability for large canvases, DPI handling, PDF output, and browser edge cases.
- Seam detection improvements, including better visual overlays and calibration guidance.
- Documentation for designers who are new to repeat patterns or print export settings.
- Focused bug reports with source image dimensions, browser version, repeat mode, and export settings.

## Pull request guidelines

- Keep changes focused on one behavior or feature.
- Include screenshots or short notes for visible UI changes.
- Describe how you verified image preview, seam overlays, and export behavior when relevant.
- Avoid adding backend services unless the project direction has been discussed first.

## Privacy expectation

The application should remain local-first. If a proposed change sends artwork, image metadata, or export data outside the browser, call that out clearly in the pull request and explain why it is needed.
