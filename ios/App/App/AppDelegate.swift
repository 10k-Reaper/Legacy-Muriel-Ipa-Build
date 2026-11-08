import UIKit
import AVFoundation
import MediaPlayer
import WebKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Music app: keep playing with the screen locked or the app in the background,
        // and ignore the silent switch. The session is not activated here: that would stop other
        // apps' audio the moment Muriel opens; WebKit activates it when a song starts.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // the lyrics Live Activity can't follow the song once the app is gone
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) { LyricsActivity.shared.endAllBeforeExit() }
        #endif
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}


// Muriel's web view. WebKit has a (private) preference that mutes a page's audio while the page
// is hidden: playback keeps "running" and shows on the lock screen, but nothing is audible once the
// app is backgrounded or the phone is locked. Turn it off, if this iOS version has it.
class MurielBridgeViewController: CAPBridgeViewController {
    override open func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        if config.preferences.responds(to: NSSelectorFromString("_setRequiresPageVisibilityToPlayAudio:")) {
            config.preferences.setValue(false, forKey: "requiresPageVisibilityToPlayAudio")
        }
        return config
    }

    // plugins that live in the app itself (not in an npm package) are registered by hand
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MurielLiveActivityPlugin())
        bridge?.registerPluginInstance(MurielAudioSessionPlugin())
        bridge?.registerPluginInstance(MurielVolumePlugin())
    }
}

// Another app's sound (a call, Siri, a video) interrupting Muriel: the page (mobile/audio-interruption.js) is
// told when it starts and when it ends, and whether iOS says to play again, so a song that was playing starts
// again like it does in Spotify (#26). Paused in the background the app is suspended soon after; iOS wakes it
// for the end of the interruption, and a short background task keeps it awake until the page has asked the
// song to play again (or a lock screen play has arrived).
@objc(MurielAudioSessionPlugin)
public class MurielAudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MurielAudioSessionPlugin"
    public let jsName = "MurielAudioSession"
    public let pluginMethods: [CAPPluginMethod] = []
    private var awake: UIBackgroundTaskIdentifier = .invalid
    private var awakeEnd: DispatchWorkItem?

    override public func load() {
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
            guard let self = self,
                  let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: raw) else { return }
            switch type {
            case .began:
                self.notifyListeners("interruption", data: ["type": "began"])
            case .ended:
                let opts = AVAudioSession.InterruptionOptions(rawValue: note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0)
                self.stayAwake(seconds: 20)
                self.notifyListeners("interruption", data: ["type": "ended", "shouldResume": opts.contains(.shouldResume)])
            @unknown default:
                break
            }
        }
    }

    // once the song plays again iOS keeps the app running by itself; this only bridges the moment until then
    private func stayAwake(seconds: Double) {
        if awake == .invalid {
            awake = UIApplication.shared.beginBackgroundTask(withName: "MurielInterruptionEnd") { [weak self] in self?.endAwake() }
        }
        awakeEnd?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.endAwake() }
        awakeEnd = work
        DispatchQueue.main.asyncAfter(deadline: .now() + seconds, execute: work)
    }

    private func endAwake() {
        awakeEnd?.cancel()
        awakeEnd = nil
        guard awake != .invalid else { return }
        UIApplication.shared.endBackgroundTask(awake)
        awake = .invalid
    }
}

// The volume bars on a phone (mobile/mobile-ui.js): iOS ignores an <audio> element's volume, so a bar moves
// the system volume with an off-screen MPVolumeView. Changes made with the hardware buttons (or Control
// Center) are observed on the audio session and sent back, keeping the page's bars in step.
@objc(MurielVolumePlugin)
public class MurielVolumePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MurielVolumePlugin"
    public let jsName = "MurielVolume"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVolume", returnType: CAPPluginReturnPromise),
    ]

    private let volumeView = MPVolumeView(frame: CGRect(x: -1000, y: -1000, width: 10, height: 10))
    private var volumeObservation: NSKeyValueObservation?

    override public func load() {
        DispatchQueue.main.async { [weak self] in self?.installVolumeView() }
        // KVO on outputVolume is public API (the AVSystemController notification is not) and works on iOS 15
        volumeObservation = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.new]) { [weak self] _, change in
            guard let self = self, let volume = change.newValue else { return }
            DispatchQueue.main.async {
                self.notifyListeners("volumeChange", data: ["volume": Double(volume)])
            }
        }
    }

    @objc func getVolume(_ call: CAPPluginCall) {
        call.resolve(["volume": Double(AVAudioSession.sharedInstance().outputVolume)])
    }

    @objc func setVolume(_ call: CAPPluginCall) {
        guard let raw = call.getDouble("volume") else {
            call.reject("volume is required")
            return
        }
        let volume = Float(max(0, min(1, raw)))
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("system volume control unavailable")
                return
            }
            if self.apply(volume) {
                call.resolve(["volume": Double(volume)])
                return
            }
            // the MPVolumeView's slider appears a moment after the view is added to a window
            self.installVolumeView()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                if self.apply(volume) {
                    call.resolve(["volume": Double(volume)])
                } else {
                    call.reject("system volume control unavailable")
                }
            }
        }
    }

    private func installVolumeView() {
        guard volumeView.superview == nil else { return }
        volumeView.showsRouteButton = false
        // not hidden: a hidden MPVolumeView may not install its slider, and 0.01 is invisible anyway
        volumeView.alpha = 0.01
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap { $0.windows }
        let window = windows.first(where: { $0.isKeyWindow }) ?? windows.first
        window?.addSubview(volumeView)
    }

    @discardableResult
    private func apply(_ volume: Float) -> Bool {
        installVolumeView()
        guard let slider = volumeView.subviews.compactMap({ $0 as? UISlider }).first else { return false }
        slider.value = volume
        slider.sendActions(for: .valueChanged)
        return true
    }
}
