import SwiftUI

struct TonightView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                Group {
                    switch appState.snapshotLoadState {
                    case .idle where appState.snapshot.children.isEmpty,
                         .loading where appState.snapshot.children.isEmpty:
                        loadingState
                    case .failed(let message) where appState.snapshot.children.isEmpty:
                        failureState(message)
                    default:
                        dashboard
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 18)
                .padding(.bottom, 32)
            }
            .refreshable { await appState.recalculateAndRefresh() }
            .navigationTitle("Tomorrow")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbarBackground(EPColor.canvas, for: .navigationBar)
            .epScreen()
        }
        .task {
            if appState.snapshotLoadState == .idle {
                await appState.refreshTomorrowSnapshot()
            }
        }
    }

    private var loadingState: some View {
        VStack(spacing: 18) {
            Spacer().frame(height: 150)
            ProgressView().tint(EPColor.gold).controlSize(.large)
            Text("Reading tomorrow from Appwrite…")
                .font(EPFont.body(14, weight: .medium))
                .foregroundStyle(EPColor.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private func failureState(_ message: String) -> some View {
        VStack(spacing: 18) {
            Spacer().frame(height: 100)
            Image(systemName: "exclamationmark.arrow.triangle.2.circlepath")
                .font(.system(size: 42))
                .foregroundStyle(EPColor.rose)
            Text("Tomorrow couldn’t load")
                .font(EPFont.sectionTitle)
                .foregroundStyle(EPColor.textPrimary)
            Text(message)
                .font(EPFont.body(13))
                .foregroundStyle(EPColor.textTertiary)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await appState.refreshTomorrowSnapshot() }
            }
            .buttonStyle(EPPrimaryButtonStyle())
        }
    }

    private var dashboard: some View {
        VStack(alignment: .leading, spacing: 20) {
            if case .failed = appState.snapshotLoadState {
                EPNote(text: "The latest refresh failed, so EqualPath is showing the last successfully loaded Appwrite result.")
            }

            if let sweepError = appState.snapshot.latestSweepError {
                VStack(alignment: .leading, spacing: 10) {
                    EPNote(text: sweepError)
                    Button("Retry conflict check") {
                        Task { await appState.recalculateAndRefresh() }
                    }
                    .buttonStyle(EPSecondaryButtonStyle())
                }
            }

            EPEyebrow(text: "Tonight · checked \(appState.snapshot.summary.checkedAt.formatted(date: .omitted, time: .shortened))")

            Text(headline)
                .font(EPFont.headline)
                .foregroundStyle(EPColor.textPrimary)
                .accessibilityAddTraits(.isHeader)

            Text(appState.snapshot.date.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                .font(EPFont.body(14, weight: .medium))
                .foregroundStyle(EPColor.textTertiary)

            VStack(spacing: 14) {
                if appState.snapshot.hasScheduleData {
                    CoverageRing(summary: appState.snapshot.summary)
                } else {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .font(.system(size: 56, weight: .light))
                        .foregroundStyle(EPColor.unknown)
                        .frame(height: 150)
                        .accessibilityLabel("No schedule data")
                }
                if appState.snapshot.summary.endMinute > appState.snapshot.summary.startMinute {
                    Text(appState.snapshot.summary.timeRange)
                        .font(EPFont.body(13, weight: .semibold))
                        .tracking(1.1)
                        .foregroundStyle(EPColor.textSecondary)
                }
                Text(sweepStatus)
                    .font(EPFont.body(11.5))
                    .foregroundStyle(EPColor.textFaint)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)

            if !appState.snapshot.sources.isEmpty {
                EPCard {
                    VStack(alignment: .leading, spacing: 15) {
                        HStack {
                            StatusBadge(state: appState.snapshot.summary.state)
                            Spacer()
                            Text(appState.snapshot.featuredChildName ?? "Tomorrow")
                                .font(EPFont.body(12.5, weight: .semibold))
                                .foregroundStyle(EPColor.textSecondary)
                        }
                        ForEach(appState.snapshot.sources) { source in
                            SourceRecordRow(record: source)
                        }
                    }
                }
            }

            if !appState.snapshot.children.isEmpty, appState.snapshot.hasScheduleData {
                NavigationLink {
                    DayDetailView(snapshot: appState.snapshot)
                } label: {
                    HStack {
                        Text("See the day")
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                }
                .buttonStyle(EPPrimaryButtonStyle())
            }

            if appState.snapshot.children.isEmpty {
                EPNote(text: "No active children were returned by Appwrite for this account.")
            } else if !appState.snapshot.hasScheduleData {
                EPNote(text: "No work, required-care or coverage records exist for tomorrow. EqualPath is not claiming the day is covered; add the missing schedule records in Schedule.")
            } else {
                childList
            }

            Text("Every number above comes from the Appwrite records that produced it. Unknown time is kept separate from uncovered time.")
                .font(EPFont.body(11.5))
                .foregroundStyle(EPColor.textFaintest)
                .lineSpacing(4)
        }
    }

    private var childList: some View {
        VStack(spacing: 0) {
            ForEach(appState.snapshot.children) { child in
                HStack(spacing: 12) {
                    Circle()
                        .fill(child.summary.state.color.opacity(0.16))
                        .frame(width: 38, height: 38)
                        .overlay {
                            Image(systemName: child.summary.state == .noGap ? "checkmark" : child.summary.state == .unknown ? "questionmark" : "exclamationmark")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(child.summary.state.color)
                        }
                    VStack(alignment: .leading, spacing: 3) {
                        Text(child.name).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                        Text(childSummary(child.summary))
                            .font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
                    }
                    Spacer()
                    StatusBadge(state: child.summary.state)
                }
                .padding(.vertical, 14)
                if child.id != appState.snapshot.children.last?.id {
                    Divider().overlay(EPColor.divider)
                }
            }
        }
        .padding(.horizontal, 16)
        .background(EPColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    private var headline: String {
        guard appState.snapshot.hasScheduleData else {
            return "Tomorrow has\nno schedule data"
        }
        return switch appState.snapshot.summary.state {
        case .noGap: "Tomorrow has\nno care gap"
        case .uncovered: "Tomorrow needs\n\(appState.snapshot.summary.hourLabel) of cover"
        case .unknown: "Tomorrow has\n\(appState.snapshot.summary.hourLabel) to verify"
        }
    }

    private func childSummary(_ summary: CoverageSummary) -> String {
        switch summary.state {
        case .noGap: "No care gap found"
        case .uncovered: "\(summary.hourLabel) needs cover"
        case .unknown: "\(summary.hourLabel) needs verification"
        }
    }

    private var sweepStatus: String {
        if appState.snapshot.latestSweepError != nil || appState.snapshot.summary.isStale {
            return "Showing the last successful sweep"
        }
        return appState.snapshot.hasScheduleData ? "Sweep is current" : "Waiting for schedule records"
    }
}
