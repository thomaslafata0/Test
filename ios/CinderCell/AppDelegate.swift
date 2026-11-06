import UIKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.backgroundColor = GameViewController.background
        let game = GameViewController()
        // Opened by tapping an invite link: start in that room.
        if let activity = launchOptions?[.userActivityDictionary] as? [String: Any],
           let ua = activity["UIApplicationLaunchOptionsUserActivityKey"] as? NSUserActivity, let url = ua.webpageURL { game.pendingURL = url }
        window.rootViewController = game
        window.makeKeyAndVisible()
        self.window = window
        return true
    }

    // An invite link tapped while the app is installed (Messages, Mail, Notes): open that room.
    func application(_ application: UIApplication, continue userActivity: NSUserActivity,
                     restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        guard userActivity.activityType == NSUserActivityTypeBrowsingWeb, let url = userActivity.webpageURL,
              let game = window?.rootViewController as? GameViewController else { return false }
        game.open(url)
        return true
    }
}
