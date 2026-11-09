# Making an Android APK for each app

Each app is a web app hosted on GitHub Pages. **PWABuilder** (free, by Microsoft) wraps a
web app link into an Android package. Do this on a computer, once per app.

| App | Link to paste | Suggested package ID |
|---|---|---|
| Grade 8 · Wise Choice Helper | `https://compact-criterion.github.io/auto-manae/wise-choice/` | `ph.bbsi.wisechoice` |
| Grade 9 · Garden Arch Helper | `https://compact-criterion.github.io/auto-manae/garden-arch/` | `ph.bbsi.gardenarch` |
| Grade 10 · Signal Check Helper | `https://compact-criterion.github.io/auto-manae/signal-check/` | `ph.bbsi.signalcheck` |
| Grade 11 · Waste Watch Helper | `https://compact-criterion.github.io/auto-manae/waste-watch/` | `ph.bbsi.wastewatch` |
| Grade 12 · Investor Pitch Helper | `https://compact-criterion.github.io/auto-manae/investor-pitch/` | `ph.bbsi.investorpitch` |

## Steps

1. Open **https://www.pwabuilder.com** and paste the app's link. Click **Start**.
2. When the report card appears, click **Package for stores**, then choose **Android**.
3. In the options, set the **Package ID** from the table above. Leave the signing key on
   **Create new** (the default).
4. Click **Download**. You get a ZIP file. Inside it:
   - the **`.apk`** file: this is the one to share with students;
   - an `.aab` file, only needed if you ever publish on the Google Play Store;
   - a **signing key** and its passwords. **Keep these safe.** You need the same key to
     make an update that installs over the old version.
5. Send the `.apk` through your class group chat or Google Drive.

## Installing on a student's phone

1. Open the `.apk` file from Messenger, Drive, or the Downloads folder.
2. If Android asks, allow **Install unknown apps** for that app (Messenger, Drive, or Files).
3. Tap **Install**. Google Play Protect may show a warning for apps that are not from the
   Play Store; tap **Install anyway**.

## Things to know

- The app opens the GitHub Pages site inside the APK. Students need internet the **first
  time**; after that it works offline.
- A thin browser address bar may show at the top. Removing it needs a verification file
  (`assetlinks.json`) at `https://compact-criterion.github.io/.well-known/`, which lives in a
  separate repository named `compact-criterion.github.io`. PWABuilder's download includes
  the file and instructions.
- When an app is updated on GitHub, students get the change automatically the next time
  they open it with internet. A new APK is only needed to change the icon or name.
- iPhones cannot install APKs. iPhone users open the link in Safari and tap
  **Share → Add to Home Screen**.
