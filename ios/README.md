# Cinder Cell for iPhone

A small app that shows the live game full screen. It loads https://cinder-cell.thomaslafata0.workers.dev, so game updates need no new build, and cloud saves, co-op and the leaderboard work as they do on the site. It plays in landscape only and needs an internet connection.

## Put it on your iPhone
The project is set up for the paid Apple Developer team `39BW6948KL` with automatic signing, so Xcode registers the app and your iPhone itself.

1. Install Xcode from the Mac App Store and open it once.
2. Open `ios/CinderCell.xcodeproj`. In Xcode, Settings, Accounts, add the Apple Account on that team.
3. Plug in your iPhone and unlock it. On the iPhone, turn on Settings, Privacy & Security, Developer Mode, and restart when asked.
4. Pick your iPhone at the top of Xcode and press Run.

A build installed this way keeps working for about a year, until its signing profile expires. To put it on friends' phones, use Product, Archive, then upload to TestFlight.
