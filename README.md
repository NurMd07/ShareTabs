# ShareTabs

ShareTabs is a web dashboard for collecting and sharing browser tabs. Save links from the dashboard or send open tabs using the browser extension.

## Features

- Save one or more URLs and display their page titles and favicons.
- Search saved tabs, pin favorites, copy URLs, and open tabs individually or all at once.
- Send tabs from Chrome or Firefox with the browser extension.

## Requirements

- Node.js 18 or newer.
- MongoDB, either local or hosted.

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root:

   ```dotenv
   MONGO_URI=mongodb://127.0.0.1:27017/tabs
   ENV=development
   USERNAME=your-extension-username
   PASSWORD=your-extension-password
   ```

   `MONGO_URI` defaults to the local MongoDB URL shown above. `ENV` defaults to `development`; the app uses port `8000` in development and `9004` otherwise. Set `PORT` to override the selected port.

3. Start the server:

   ```sh
   npm run dev
   ```

   Open `http://localhost:8000`. Use `npm start` to start the app with the same environment-based port selection.

## Browser extension

The same Manifest V3 package supports Chrome 121+ and Firefox 121+. Download it from the app's `/getextension` page or from [`public/sharetabs.zip`](./public/sharetabs.zip).

### Chrome and Chromium browsers

1. Download and extract the ZIP.
2. Open `chrome://extensions` (or `edge://extensions`) and enable Developer mode.
3. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.

### Firefox

1. Download and extract the same ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on** and choose `manifest.json` from the extracted folder.

Firefox temporary add-ons are removed when the browser closes. Permanent Firefox installation requires a signed add-on.

### Extension authentication

Set `USERNAME` and `PASSWORD` in the server environment. The extension asks for these credentials when sending tabs, and the server verifies them before saving. Credentials are not bundled in the extension and are not stored by it. Use HTTPS when connecting to a deployed server, and do not commit your `.env` file.

Manual URL submissions from the dashboard keep their existing behavior and do not use the extension credentials.

## Tests

Run the application syntax check and extension-credential tests:

```sh
npm test
```
