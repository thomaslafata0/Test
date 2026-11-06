import UIKit
import WebKit

/// Cinder Cell in a full-screen web view. It loads the live site, so the app always runs the latest
/// deploy and keeps cloud saves, co-op and the leaderboard working without any changes to the game.
final class GameViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    static let gameURL = URL(string: "https://cinder-cell.thomaslafata0.workers.dev/")!
    static let background = UIColor(red: 0.05, green: 0.06, blue: 0.08, alpha: 1)

    private var webView: WKWebView!
    private let offlineLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.background

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default() // keeps the save between launches

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = Self.background
        webView.scrollView.backgroundColor = Self.background
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never // the page handles the notch itself
        view.addSubview(webView)

        offlineLabel.text = "Can\u{2019}t reach Cinder Cell. Check your connection."
        offlineLabel.textColor = .lightGray
        offlineLabel.textAlignment = .center
        offlineLabel.numberOfLines = 0
        retryButton.setTitle("Try again", for: .normal)
        retryButton.addTarget(self, action: #selector(load), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [offlineLabel, retryButton])
        stack.axis = .vertical
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, constant: -48),
        ])
        setOffline(false)

        UIApplication.shared.isIdleTimerDisabled = true // no sleeping mid-fight
        load()
    }

    @objc private func load() {
        setOffline(false)
        webView.load(URLRequest(url: Self.gameURL))
    }

    private func setOffline(_ offline: Bool) {
        offlineLabel.superview?.isHidden = !offline
        webView.isHidden = offline
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { setOffline(true) }
    }

    // iOS can kill the page while the app is in the background. Bring it back instead of showing a blank screen.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    // Anything that isn't the game opens in Safari.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, let host = url.host,
           host != Self.gameURL.host, navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // The game's confirm and alert dialogs, if any, as native ones.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }
}
