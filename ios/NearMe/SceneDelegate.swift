import UIKit
import SwiftUI

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        let locationManager = LocationManager()
        let notificationManager = NotificationManager()
        let contentView = ContentView()
            .environmentObject(locationManager)
            .environmentObject(notificationManager)

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UIHostingController(rootView: contentView)
        self.window = window
        window.makeKeyAndVisible()
    }

    func sceneDidDisconnect(_ scene: UIScene) {}

    func sceneDidBecomeActive(_ scene: UIScene) {
        Task {
            if !(await AnalyticsService.shared.isSessionActive) {
                await AnalyticsService.shared.startSession()
            }
        }
    }

    func sceneWillResignActive(_ scene: UIScene) {}

    func sceneWillEnterForeground(_ scene: UIScene) {
        Task {
            if !(await AnalyticsService.shared.isSessionActive) {
                await AnalyticsService.shared.startSession()
            }
        }
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Let the session time out naturally
    }
}
