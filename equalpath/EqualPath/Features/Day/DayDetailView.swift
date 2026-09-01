import SwiftUI

struct DayDetailView: View {
    let snapshot: TomorrowSnapshot

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                EPEyebrow(text: "The day · \(snapshot.featuredChildName ?? "Tomorrow")", color: snapshot.summary.state.color)
                Text(!snapshot.hasScheduleData ? "No schedule data" : snapshot.summary.state == .noGap ? "Tomorrow’s records" : "Where the gap opens")
                    .font(EPFont.headline)
                    .foregroundStyle(EPColor.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                Text("These work, registered-care and conflict bands were loaded from Appwrite for this date.")
                    .font(EPFont.body(14))
                    .foregroundStyle(EPColor.textTertiary)
                    .lineSpacing(6)

                DayTimeline(records: snapshot.timeline)

                if !snapshot.sources.isEmpty {
                    EPCard {
                        VStack(alignment: .leading, spacing: 16) {
                            Text(snapshot.summary.state == .noGap ? "SOURCE RECORDS" : "WHY EQUALPATH FLAGGED THIS")
                                .font(EPFont.eyebrow)
                                .tracking(1.6)
                                .foregroundStyle(snapshot.summary.state.color)
                            ForEach(snapshot.sources) { source in SourceRecordRow(record: source) }
                        }
                    }
                }

                if snapshot.summary.state != .noGap, snapshot.hasScheduleData {
                    NavigationLink {
                        PlansView()
                    } label: {
                        HStack {
                            Text("See possible paths")
                            Spacer()
                            Image(systemName: "arrow.right")
                        }
                    }
                    .buttonStyle(EPPrimaryButtonStyle())
                }

                EPNote(text: "Unknown records stay separate from uncovered records. Times shown here are taken from tomorrow’s materialised Appwrite commitments and conflicts.")
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 20)
        }
        .navigationTitle(snapshot.date.formatted(.dateTime.weekday(.wide).day().month(.abbreviated)))
        .navigationBarTitleDisplayMode(.inline)
        .epScreen()
    }
}

private struct DayTimeline: View {
    let records: [TimelineRecord]

    var body: some View {
        EPCard {
            if records.isEmpty {
                HStack(spacing: 12) {
                    Image(systemName: "calendar.badge.checkmark")
                        .foregroundStyle(EPColor.greenText)
                    Text("No care, work or conflict records were materialised for this date.")
                        .font(EPFont.body(13))
                        .foregroundStyle(EPColor.textTertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(records) { record in
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(CoverageSummary.time(record.startMinute))
                            Text(CoverageSummary.time(record.endMinute))
                        }
                        .font(EPFont.body(10.5, weight: .semibold))
                        .foregroundStyle(EPColor.textFaint)
                        .frame(width: 48)

                        Capsule()
                            .fill(color(for: record.kind))
                            .frame(width: 5, height: 46)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(record.title)
                                .font(EPFont.rowTitle)
                                .foregroundStyle(EPColor.textPrimary)
                            if !record.detail.isEmpty {
                                Text(record.detail)
                                    .font(EPFont.rowSubtitle)
                                    .foregroundStyle(EPColor.textDim)
                            }
                            Text(label(for: record.kind))
                                .font(EPFont.body(9.5, weight: .bold))
                                .tracking(1)
                                .foregroundStyle(color(for: record.kind))
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 12)
                    if record.id != records.last?.id {
                        Divider().overlay(EPColor.divider)
                    }
                    }
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Tomorrow’s Appwrite schedule and conflict records")
    }

    private func color(for kind: TimelineRecord.Kind) -> Color {
        switch kind {
        case .careRequired: EPColor.amber
        case .careCoverage: EPColor.teal
        case .work: EPColor.blue
        case .uncovered: EPColor.rose
        case .unknown: EPColor.unknown
        }
    }

    private func label(for kind: TimelineRecord.Kind) -> String {
        switch kind {
        case .careRequired: "CARE NEEDED"
        case .careCoverage: "CARE COVERAGE"
        case .work: "WORK"
        case .uncovered: "UNCOVERED"
        case .unknown: "UNKNOWN"
        }
    }
}
