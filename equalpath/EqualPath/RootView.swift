import SwiftUI

struct RootView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch appState.phase {
            case .launching:
                ZStack {
                    EPColor.canvas.ignoresSafeArea()
                    VStack(spacing: 18) {
                        BrandMark()
                        ProgressView().tint(EPColor.gold)
                    }
                }
                .task { await appState.bootstrap() }
            case .welcome:
                WelcomeView()
            case .onboarding:
                OnboardingFlowView()
            case .main:
                MainTabView()
            }
        }
        .animation(.easeInOut(duration: 0.3), value: appState.phase)
        .onChange(of: scenePhase) { _, newPhase in
            guard newPhase == .active else { return }
            Task {
                if appState.phase == .main { await appState.refreshTomorrowSnapshot() }
                await appState.refreshLocalNotifications()
            }
        }
        .alert(
            "EqualPath couldn’t continue",
            isPresented: Binding(
                get: { appState.errorMessage != nil },
                set: { if !$0 { appState.errorMessage = nil } }
            ),
            actions: { Button("OK", role: .cancel) {} },
            message: { Text(appState.errorMessage ?? "Please try again.") }
        )
    }
}

struct BrandMark: View {
    var body: some View {
        HStack(spacing: 10) {
            Rectangle()
                .fill(EPColor.gold)
                .frame(width: 9, height: 9)
                .rotationEffect(.degrees(45))
            Text("EQUALPATH")
                .font(EPFont.body(12, weight: .semibold))
                .tracking(2.8)
                .foregroundStyle(EPColor.gold)
        }
    }
}
