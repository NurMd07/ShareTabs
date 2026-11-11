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

Download the browser-specific Manifest V3 package from the app's `/getextension` page. Chrome uses [`public/sharetabs.zip`](./public/sharetabs.zip), and Firefox uses [`public/sharetabs-firefox.zip`](./public/sharetabs-firefox.zip); their background-script formats differ.

### Chrome and Chromium browsers

1. Download and extract the Chrome ZIP.
2. Open `chrome://extensions` (or `edge://extensions`) and enable Developer mode.
3. Choose **Load unpacked** and select the extracted folder containing `manifest.json`.

### Firefox

1. Download and extract the Firefox ZIP.
2. Open `about:debugging#/runtime/this-firefox`.
3. Select **Load Temporary Add-on** and choose `manifest.json` from the extracted folder.

Firefox temporary add-ons are removed when the browser closes. Permanent Firefox installation requires a signed add-on.

### Extension authentication

Set `USERNAME` and `PASSWORD` in the server environment. On first use, the extension asks for the dashboard domain and these credentials, then saves them locally in the browser only after a successful send. It requests access to the selected domain when sending. Use HTTPS when connecting to a deployed server, and do not commit your `.env` file. Use **Log out** in the extension to clear the saved domain and credentials.

Manual URL submissions from the dashboard keep their existing behavior and do not use the extension credentials.

## Tests

Run the application syntax check and extension-credential tests:

```sh
npm test
```
