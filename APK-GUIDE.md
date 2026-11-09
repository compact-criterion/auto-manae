# Android APKs

Ready-made, signed APK files for all five apps are in the [`apk/`](apk/) folder:

| File | App | Package |
|---|---|---|
| `G8-Wise-Choice.apk` | Grade 8 · The Wise Choice | `ph.bbsi.wisechoice` |
| `G9-Garden-Arch.apk` | Grade 9 · The Garden Arch | `ph.bbsi.gardenarch` |
| `G10-Signal-Check.apk` | Grade 10 · Signal Check | `ph.bbsi.signalcheck` |
| `G11-Waste-Watch.apk` | Grade 11 · Kaytikling Waste Watch | `ph.bbsi.wastewatch` |
| `G12-Investor-Pitch.apk` | Grade 12 · Investor Proposal | `ph.bbsi.investorpitch` |

Each APK contains the whole app and the MathJax library, so it works **fully offline**
from the first launch (only the Google Fonts typefaces need internet; without them the app
uses the phone's own font). Android 7.0 or newer.

## Installing on a student's phone

1. Open the `.apk` file from Messenger, Google Drive, or the Downloads folder.
2. If Android asks, allow **Install unknown apps** for that app (Messenger, Drive, or Files).
3. Tap **Install**. Google Play Protect may warn about an app that is not from the Play
   Store; tap **More details → Install anyway**.

Answers are saved inside the app on that phone. The APK and the web link keep separate
saved data.

## Updating an app later

The APKs are built from the Android project in [`android/`](android/), which copies the web
apps into the package:

```
python3 android/prepare-assets.py
cd android && gradle assembleRelease
```

Raise `versionCode` in `android/app/build.gradle` first. An update installs over the old
version (keeping students' saved answers) **only if it is signed with the same key**. The
signing key (`bbsi-helpers.jks`) and its passwords (`keystore.properties`) are kept out of
this public repository; store them somewhere safe.

## iPhone

iPhones cannot install APKs. iPhone users open the GitHub Pages link in Safari and tap
**Share → Add to Home Screen**.
