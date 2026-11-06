# Cinder Cell for iPhone

A small app that shows the live game full screen. It loads https://cinder-cell.thomaslafata0.workers.dev, so game updates need no new build, and cloud saves, co-op and the leaderboard work as they do on the site. It plays in landscape only and needs an internet connection.

## Put it on your iPhone
1. Install Xcode from the Mac App Store and open it once.
2. Open `ios/CinderCell.xcodeproj`.
3. In Xcode: Settings, Accounts, add your Apple ID.
4. Select the CinderCell target, then Signing & Capabilities, and choose your team. If Xcode says the bundle ID is taken, change `com.thomaslafata.cindercell` to something unique.
5. Plug in your iPhone and unlock it. On the iPhone, turn on Settings, Privacy & Security, Developer Mode, and restart when asked.
6. Pick your iPhone at the top of Xcode and press Run.
7. The first time, trust yourself on the iPhone: Settings, General, VPN & Device Management.

With a free Apple ID the app stops opening after 7 days until you press Run again. A paid Apple Developer membership lasts a year and adds TestFlight for sharing it with friends.
