import UIKit
import WebKit
import Network

/// Cinder Cell in a full-screen web view. It loads the live site, so the app always runs the latest
/// deploy and keeps cloud saves, co-op and the leaderboard working without any changes to the game.
///
/// The page talks back through three message handlers:
/// - `ready`: the first screen is drawn, so the splash can fade out.
/// - `haptic`: a vibration (`light`, `medium`, `heavy`, `soft`, `rigid`, `selection`, `success`, `warning`, `error`).
/// - `share`: text or a link for the share sheet (co-op invites).
final class GameViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    static let gameURL = URL(string: "https://cinder-cell.thomaslafata0.workers.dev/")!
    static let background = UIColor(named: "LaunchBackground") ?? UIColor(red: 0.07, green: 0.08, blue: 0.09, alpha: 1)
    static let sodium = UIColor(red: 0.91, green: 0.59, blue: 0.23, alpha: 1)

    private var webView: WKWebView!
    private let splash = UIView()
    private let spinner = UIActivityIndicatorView(style: .medium)
    private let offline = UIView()
    private let offlineDetail = UILabel()
    private let monitor = NWPathMonitor()
    private var pageReady = false
    private var showingOffline = false
    private var readyFallback: DispatchWorkItem?

    private let impacts: [String: UIImpactFeedbackGenerator] = [
        "light": UIImpactFeedbackGenerator(style: .light), "medium": UIImpactFeedbackGenerator(style: .medium),
        "heavy": UIImpactFeedbackGenerator(style: .heavy), "soft": UIImpactFeedbackGenerator(style: .soft),
        "rigid": UIImpactFeedbackGenerator(style: .rigid),
    ]
    private let notify = UINotificationFeedbackGenerator()
    private let selection = UISelectionFeedbackGenerator()

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    // Swipes near the edges go to the game first; the system needs a second swipe.
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Self.background
        buildWebView()
        buildOffline()
        buildSplash()

        NotificationCenter.default.addObserver(self, selector: #selector(cameBack),
                                               name: UIApplication.willEnterForegroundNotification, object: nil)
        // Back online while the "no signal" screen is up: try again on our own.
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .satisfied else { return }
            DispatchQueue.main.async { if let self, self.showingOffline { self.load() } }
        }
        monitor.start(queue: DispatchQueue(label: "cinder.net"))

        UIApplication.shared.isIdleTimerDisabled = true // no sleeping mid-fight
        load()
    }

    deinit { monitor.cancel() }

    // MARK: - Views

    private func buildWebView() {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.websiteDataStore = .default() // keeps the save between launches
        config.applicationNameForUserAgent = "Mobile/15E148 CinderCellApp/\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1")"
        let content = config.userContentController
        let proxy = WeakHandler(self)
        for name in ["ready", "haptic", "share"] { content.add(proxy, name: name) }
        // A game, not a document: no pinch zoom, no double-tap zoom.
        content.addUserScript(WKUserScript(source: """
            (function () {
              var m = document.querySelector('meta[name=viewport]');
              if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
              m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
            })();
            """, injectionTime: .atDocumentEnd, forMainFrameOnly: true))

        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = Self.background
        webView.allowsLinkPreview = false
        webView.allowsBackForwardNavigationGestures = false
        webView.scrollView.backgroundColor = Self.background
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never // the page handles the notch itself
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true } // Safari, Develop menu
        #endif
        view.addSubview(webView)
    }

    /// Looks exactly like the launch screen, then adds the name and a spinner, so opening the app has no flash.
    private func buildSplash() {
        splash.backgroundColor = Self.background
        splash.frame = view.bounds
        splash.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        let logo = UIImageView(image: UIImage(named: "LaunchLogo"))
        logo.translatesAutoresizingMaskIntoConstraints = false
        logo.contentMode = .center
        let title = UILabel()
        title.attributedText = NSAttributedString(string: "CINDER CELL", attributes: [
            .font: UIFont.systemFont(ofSize: 26, weight: .black, width: .compressed),
            .foregroundColor: Self.sodium, .kern: 3,
        ])
        title.translatesAutoresizingMaskIntoConstraints = false
        spinner.color = UIColor(white: 0.7, alpha: 1)
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimating()
        [logo, title, spinner].forEach(splash.addSubview)
        NSLayoutConstraint.activate([
            logo.centerXAnchor.constraint(equalTo: splash.centerXAnchor),
            logo.centerYAnchor.constraint(equalTo: splash.centerYAnchor),
            logo.widthAnchor.constraint(equalToConstant: 240), logo.heightAnchor.constraint(equalToConstant: 240),
            title.centerXAnchor.constraint(equalTo: splash.centerXAnchor),
            title.topAnchor.constraint(equalTo: logo.bottomAnchor, constant: -22),
            spinner.centerXAnchor.constraint(equalTo: splash.centerXAnchor),
            spinner.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 8),
        ])
        view.addSubview(splash)
    }

    private func buildOffline() {
        offline.backgroundColor = Self.background
        offline.frame = view.bounds
        offline.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        offline.isHidden = true
        let icon = UIImageView(image: UIImage(systemName: "antenna.radiowaves.left.and.right.slash"))
        icon.tintColor = Self.sodium
        icon.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 34, weight: .semibold)
        let title = UILabel()
        title.attributedText = NSAttributedString(string: "NO SIGNAL", attributes: [
            .font: UIFont.systemFont(ofSize: 28, weight: .black, width: .compressed), .foregroundColor: Self.sodium, .kern: 3,
        ])
        offlineDetail.text = "Cinder Cell needs a connection for cloud saves, co-op and the leaderboard. It will reconnect on its own."
        offlineDetail.font = .systemFont(ofSize: 15)
        offlineDetail.textColor = UIColor(white: 0.72, alpha: 1)
        offlineDetail.textAlignment = .center
        offlineDetail.numberOfLines = 0
        var cfg = UIButton.Configuration.filled()
        cfg.baseBackgroundColor = Self.sodium
        cfg.baseForegroundColor = UIColor(red: 0.1, green: 0.07, blue: 0.03, alpha: 1)
        cfg.cornerStyle = .fixed
        cfg.background.cornerRadius = 2
        cfg.contentInsets = NSDirectionalEdgeInsets(top: 12, leading: 28, bottom: 12, trailing: 28)
        cfg.attributedTitle = AttributedString("TRY AGAIN", attributes: AttributeContainer([
            .font: UIFont.systemFont(ofSize: 17, weight: .heavy, width: .condensed), .kern: 2,
        ]))
        let retry = UIButton(configuration: cfg)
        retry.addTarget(self, action: #selector(retryTapped), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [icon, title, offlineDetail, retry])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        stack.setCustomSpacing(22, after: offlineDetail)
        stack.translatesAutoresizingMaskIntoConstraints = false
        offline.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: offline.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: offline.centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 420),
            stack.widthAnchor.constraint(lessThanOrEqualTo: offline.widthAnchor, constant: -64),
        ])
        view.addSubview(offline)
    }

    // MARK: - Loading

    @objc private func retryTapped() {
        selection.selectionChanged()
        load()
    }

    @objc private func load() {
        setOffline(false)
        pageReady = false
        spinner.startAnimating()
        webView.load(URLRequest(url: Self.gameURL, cachePolicy: .useProtocolCachePolicy, timeoutInterval: 20))
    }

    @objc private func cameBack() {
        if showingOffline { load() }
    }

    private func setOffline(_ on: Bool) {
        showingOffline = on
        offline.isHidden = !on
        if on { hideSplash(animated: false) }
    }

    private func hideSplash(animated: Bool) {
        readyFallback?.cancel()
        guard splash.superview != nil, splash.alpha > 0 else { return }
        UIView.animate(withDuration: animated ? 0.35 : 0, delay: 0, options: [.curveEaseOut]) {
            self.splash.alpha = 0
        } completion: { _ in
            self.splash.isHidden = true
            self.spinner.stopAnimating()
        }
    }

    private func failed(_ error: Error) {
        let e = error as NSError
        if e.code == NSURLErrorCancelled || e.domain == "WebKitErrorDomain" && e.code == 102 { return }
        if !pageReady { setOffline(true) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { failed(error) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { failed(error) }

    // If an older version of the site never says it's ready, don't keep the splash up forever.
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let work = DispatchWorkItem { [weak self] in self?.hideSplash(animated: true) }
        readyFallback = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: work)
    }

    // iOS can kill the page while the app is in the background. Bring it back instead of showing a blank screen.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    // Anything that isn't the game opens in Safari.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, let host = url.host, host != Self.gameURL.host,
           navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    // Links that want a new window load here (same site) or in Safari (anything else).
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if url.host == Self.gameURL.host { webView.load(navigationAction.request) } else { UIApplication.shared.open(url) }
        }
        return nil
    }

    // The game's alert, confirm and prompt dialogs, as native ones.
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(alert.textFields?.first?.text) })
        present(alert, animated: true)
    }

    // MARK: - Messages from the page

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case "ready":
            pageReady = true
            setOffline(false)
            hideSplash(animated: true)
            impacts.values.forEach { $0.prepare() }
        case "haptic":
            buzz(message.body as? String ?? "light")
        case "share":
            guard let text = message.body as? String, !text.isEmpty else { return }
            share(text)
        default:
            break
        }
    }

    private func buzz(_ kind: String) {
        switch kind {
        case "selection": selection.selectionChanged()
        case "success": notify.notificationOccurred(.success)
        case "warning": notify.notificationOccurred(.warning)
        case "error": notify.notificationOccurred(.error)
        default:
            let g = impacts[kind] ?? impacts["light"]!
            g.impactOccurred()
            g.prepare()
        }
    }

    private func share(_ text: String) {
        guard presentedViewController == nil else { return }
        let item: Any = URL(string: text).flatMap { $0.scheme?.hasPrefix("http") == true ? $0 : nil } ?? text
        let sheet = UIActivityViewController(activityItems: [item], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
        present(sheet, animated: true)
    }
}

/// WKUserContentController keeps its handlers alive; this stops it keeping the view controller alive too.
private final class WeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(c, didReceive: message)
    }
}
