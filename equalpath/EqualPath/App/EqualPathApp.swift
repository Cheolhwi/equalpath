import SwiftUI

@main
struct EqualPathApp: App {
    @UIApplicationDelegateAdaptor(EqualPathAppDelegate.self) private var appDelegate
    @StateObject private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appState)
                .preferredColorScheme(.dark)
                .registerOAuthHandler()
        }
    }
}
