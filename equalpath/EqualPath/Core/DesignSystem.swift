import SwiftUI

enum EPColor {
    static let canvas = Color(hex: 0x080D1E)
    static let canvasDeep = Color(hex: 0x04060F)
    static let surface = Color(hex: 0x0C1226)
    static let surfaceAlt = Color(hex: 0x0B1024)
    static let input = Color(hex: 0x0D1330)
    static let inputActive = Color(hex: 0x101940)
    static let tabBar = Color(hex: 0x060A18)

    static let gold = Color(hex: 0xE3B85C)
    static let goldLight = Color(hex: 0xF3D391)
    static let goldMuted = Color(hex: 0xDCC79C)
    static let blue = Color(hex: 0x4A6BE8)
    static let blueDeep = Color(hex: 0x3C55C4)
    static let green = Color(hex: 0x2FB98A)
    static let greenText = Color(hex: 0x3FD09B)
    static let rose = Color(hex: 0xFF6B81)
    static let roseText = Color(hex: 0xFF7A8C)
    static let teal = Color(hex: 0x4FC7C7)
    static let orange = Color(hex: 0xE28A3E)
    static let amber = Color(hex: 0xF0B65E)
    static let unknown = Color(hex: 0x3A4570)

    static let textPrimary = Color(hex: 0xF6EFDE)
    static let textBody = Color(hex: 0xEFE7D6)
    static let textSecondary = Color(hex: 0xBFC7E2)
    static let textTertiary = Color(hex: 0xA6AECC)
    static let textMuted = Color(hex: 0x9AA3C4)
    static let textDim = Color(hex: 0x8F97BA)
    static let textFaint = Color(hex: 0x7983A8)
    static let textFaintest = Color(hex: 0x6E779C)
    static let textDisabled = Color(hex: 0x5E6790)
    static let track = Color(hex: 0x242E58)
    static let divider = Color(red: 226 / 255, green: 214 / 255, blue: 186 / 255).opacity(0.09)
    static let border = Color(red: 226 / 255, green: 214 / 255, blue: 186 / 255).opacity(0.14)
    static let borderStrong = Color(red: 226 / 255, green: 214 / 255, blue: 186 / 255).opacity(0.24)
}

enum EPFont {
    static func display(_ size: CGFloat, weight: Font.Weight = .medium) -> Font {
        .custom(displayName(for: weight), size: size)
    }

    static func body(_ size: CGFloat = 14, weight: Font.Weight = .regular) -> Font {
        .custom(bodyName(for: weight), size: size)
    }

    static let headline = display(34)
    static let sectionTitle = display(25)
    static let ringLarge = display(44)
    static let rowTitle = body(15, weight: .semibold)
    static let rowSubtitle = body(12.5)
    static let eyebrow = body(10.5, weight: .semibold)

    private static func displayName(for weight: Font.Weight) -> String {
        if weight == .bold { return "CormorantGaramond-Bold" }
        if weight == .semibold { return "CormorantGaramond-SemiBold" }
        if weight == .regular { return "CormorantGaramond-Regular" }
        return "CormorantGaramond-Medium"
    }

    private static func bodyName(for weight: Font.Weight) -> String {
        if weight == .bold { return "InstrumentSans-Bold" }
        if weight == .semibold { return "InstrumentSans-SemiBold" }
        if weight == .medium { return "InstrumentSans-Medium" }
        return "InstrumentSans-Regular"
    }
}

extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xff) / 255,
            green: Double((hex >> 8) & 0xff) / 255,
            blue: Double(hex & 0xff) / 255,
            opacity: alpha
        )
    }
}

struct EPBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(EPColor.canvas.ignoresSafeArea())
            .foregroundStyle(EPColor.textBody)
            .tint(EPColor.gold)
    }
}

extension View {
    func epScreen() -> some View { modifier(EPBackground()) }
}

struct EPPrimaryButtonStyle: ButtonStyle {
    let color: Color

    init(color: Color = EPColor.blue) {
        self.color = color
    }

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(EPFont.body(16, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(color.opacity(configuration.isPressed ? 0.74 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .shadow(color: color.opacity(0.28), radius: configuration.isPressed ? 8 : 15, y: 8)
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.16), value: configuration.isPressed)
    }
}

struct EPSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(EPFont.body(15, weight: .semibold))
            .foregroundStyle(configuration.isPressed ? EPColor.gold : EPColor.textSecondary)
            .frame(maxWidth: .infinity, minHeight: 54)
            .background(EPColor.surface.opacity(configuration.isPressed ? 0.8 : 0.25))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(configuration.isPressed ? EPColor.gold : EPColor.borderStrong)
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

struct EPCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(EPColor.surface)
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(EPColor.border)
            }
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}
