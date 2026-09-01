import SwiftUI

struct WelcomeView: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var animate = false

    var body: some View {
        ZStack(alignment: .bottom) {
            EPColor.canvas.ignoresSafeArea()
            LiquidBackdrop(animate: animate && !reduceMotion)
                .ignoresSafeArea()
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 260)
                BrandMark()
                    .padding(.bottom, 18)

                (Text("Know about\ntomorrow ") + Text("tonight").italic().foregroundColor(EPColor.gold))
                    .font(EPFont.display(40))
                    .foregroundStyle(EPColor.textPrimary)
                    .lineSpacing(-1)
                    .padding(.bottom, 14)
                    .accessibilityAddTraits(.isHeader)

                Text("EqualPath watches the gap between your work and your childcare, and tells you the evening before it opens.")
                    .font(EPFont.body(15))
                    .foregroundStyle(EPColor.textTertiary)
                    .lineSpacing(7)
                    .frame(maxWidth: 310, alignment: .leading)
                    .padding(.bottom, 28)

                Button {
                    Task { await appState.signInWithGoogle() }
                } label: {
                    HStack(spacing: 12) {
                        Text("G")
                            .font(EPFont.body(17, weight: .bold))
                            .foregroundStyle(EPColor.blue)
                            .frame(width: 28, height: 28)
                            .background(.white)
                            .clipShape(Circle())
                        Text(appState.isBusy ? "Opening Google…" : "Continue with Google")
                    }
                }
                .buttonStyle(EPPrimaryButtonStyle())
                .disabled(appState.isBusy)

                Button("Preview without signing in") {
                    appState.enterPreview()
                }
                .buttonStyle(EPSecondaryButtonStyle())
                .padding(.top, 12)

                Text("Google is used only to create your private EqualPath session. No password is stored in the app.")
                    .font(EPFont.body(11.5))
                    .foregroundStyle(EPColor.textFaintest)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 14)
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 24)
        }
        .onAppear { withAnimation(.easeInOut(duration: 5).repeatForever(autoreverses: true)) { animate = true } }
    }
}

private struct LiquidBackdrop: View {
    let animate: Bool

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                Circle()
                    .fill(EPColor.blue.opacity(0.5))
                    .frame(width: 270, height: 270)
                    .blur(radius: 4)
                    .offset(x: animate ? -110 : -155, y: animate ? -250 : -205)
                Circle()
                    .fill(EPColor.gold.opacity(0.24))
                    .frame(width: 210, height: 210)
                    .blur(radius: 9)
                    .offset(x: animate ? 95 : 45, y: animate ? -300 : -250)
                RadialGradient(
                    colors: [EPColor.blue.opacity(0.2), .clear],
                    center: .topLeading,
                    startRadius: 20,
                    endRadius: 360
                )
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
        }
    }
}
