import UIKit
import SwiftUI

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        // Create the SwiftUI view and provide the environment objects
        let locationManager = LocationManager()
        let notificationManager = NotificationManager()
        let contentView = ContentView()
            .environmentObject(locationManager)
            .environmentObject(notificationManager)

        // Use a UIHostingController as window root view controller
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = UIHostingController(rootView: contentView)
        self.window = window
        window.makeKeyAndVisible()
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        // Called as the scene is being released by the system.
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Called when the scene has moved from an inactive state to an active state.
        Task {
            if !await AnalyticsService.shared.isSessionActive {
                await AnalyticsService.shared.startSession()
            }
        }
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Called when the scene will move from an active state to an inactive state.
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        // Called as the scene transitions from the background to the foreground.
        Task {
            if !await AnalyticsService.shared.isSessionActive {
                await AnalyticsService.shared.startSession()
            }
        }
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        // Called as the scene transitions from the foreground to the background.
        // Don't end session here, just let it timeout naturally
    }
}