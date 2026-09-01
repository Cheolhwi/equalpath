import SwiftUI

struct EPEyebrow: View {
    let text: String
    var color: Color = EPColor.gold

    var body: some View {
        HStack(spacing: 10) {
            Rectangle()
                .fill(color)
                .frame(width: 8, height: 8)
                .rotationEffect(.degrees(45))
            Text(text.uppercased())
                .font(EPFont.eyebrow)
                .tracking(2.2)
                .foregroundStyle(color)
        }
        .accessibilityElement(children: .combine)
    }
}

struct CoverageRing: View {
    let summary: CoverageSummary
    var size: CGFloat = 220

    private var ringColor: Color {
        summary.isStale ? Color(hex: 0x6E5A38) : summary.state.color
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(EPColor.track, lineWidth: 18)

            Circle()
                .trim(from: 0, to: summary.state == .noGap ? 1 : summary.ringFraction)
                .stroke(ringColor, style: StrokeStyle(lineWidth: 18, lineCap: .round))
                .rotationEffect(.degrees(-90))

            VStack(spacing: 5) {
                Text(summary.hourLabel)
                    .font(EPFont.ringLarge)
                    .foregroundStyle(EPColor.textPrimary)
                    .contentTransition(.numericText())
                Text(summary.isStale ? "AS OF \(summary.checkedAt.formatted(date: .omitted, time: .shortened))" : summary.state.label)
                    .font(EPFont.body(10.5, weight: .bold))
                    .tracking(1.8)
                    .foregroundStyle(ringColor)
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(summary.hourLabel), \(summary.state.label.lowercased()), \(summary.timeRange)")
    }
}

struct StatusBadge: View {
    let state: CoverageState

    var body: some View {
        HStack(spacing: 7) {
            Image(systemName: state == .noGap ? "checkmark.circle.fill" : state == .unknown ? "questionmark.diamond.fill" : "exclamationmark.triangle.fill")
            Text(state.label)
        }
        .font(EPFont.body(10.5, weight: .bold))
        .tracking(1.1)
        .foregroundStyle(state.color)
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(state.color.opacity(0.11))
        .clipShape(Capsule())
    }
}

struct SourceRecordRow: View {
    let record: SourceRecord

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: record.icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(EPColor.gold)
                .frame(width: 24, height: 24)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 4) {
                Text(record.title)
                    .font(EPFont.rowTitle)
                    .foregroundStyle(EPColor.textPrimary)
                Text(record.detail)
                    .font(EPFont.rowSubtitle)
                    .foregroundStyle(EPColor.textDim)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }
}

struct EPNote: View {
    let text: String

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "diamond.fill")
                .font(.system(size: 7))
                .foregroundStyle(EPColor.gold)
                .padding(.top, 5)
                .accessibilityHidden(true)
            Text(text)
                .font(EPFont.body(12.5))
                .foregroundStyle(EPColor.textMuted)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
        .padding(14)
        .background(EPColor.surfaceAlt)
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(EPColor.gold.opacity(0.18))
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

struct EPField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label.uppercased())
                .font(EPFont.eyebrow)
                .tracking(1.6)
                .foregroundStyle(EPColor.textFaint)
            TextField(placeholder, text: $text)
                .font(EPFont.body(16, weight: .semibold))
                .foregroundStyle(EPColor.textPrimary)
                .keyboardType(keyboard)
                .textInputAutocapitalization(keyboard == .emailAddress ? .never : .words)
                .autocorrectionDisabled(keyboard == .emailAddress)
                .padding(.horizontal, 16)
                .frame(height: 58)
                .background(EPColor.input)
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .stroke(EPColor.border)
                }
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }
}

struct EPProgressRail: View {
    let current: Int
    let total: Int

    var body: some View {
        HStack(spacing: 7) {
            ForEach(0..<total, id: \.self) { index in
                Capsule()
                    .fill(index <= current ? EPColor.gold : EPColor.track)
                    .frame(maxWidth: .infinity, minHeight: 5, maxHeight: 5)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: current)
        .accessibilityLabel("Setup step \(current + 1) of \(total)")
    }
}
