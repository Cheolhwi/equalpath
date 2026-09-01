import SwiftUI

struct ScheduleEditorPresentation: Identifiable {
    let id = UUID()
    var draft: ScheduleEntryDraft
    let visibleDates: ClosedRange<Date>
    let children: [ScheduleChild]
    let handoverPeople: [HandoverPerson]
    let weekStarting: Date
}

struct ScheduleView: View {
    @EnvironmentObject private var appState: AppState
    let addRequestID: Int
    let onPresentEditor: (ScheduleEditorPresentation) -> Void
    @State private var windowStart = Calendar.current.startOfDay(for: .now)
    @State private var selectedDateLocal: String?
    @State private var pendingDelete: ScheduleEntry?
    @State private var operationError: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                weekNavigation
                dayPicker
                scheduleLegend

                switch appState.weekScheduleLoadState {
                case .idle where appState.weekSchedule.days.isEmpty,
                     .loading where appState.weekSchedule.days.isEmpty:
                    loadingState
                case .failed(let message) where appState.weekSchedule.days.isEmpty:
                    failureState(message)
                default:
                    dayContent
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .refreshable {
            await appState.recalculateAndRefresh()
            await appState.refreshWeekSchedule(startingAt: windowStart)
        }
        .epScreen()
        .task(id: windowStart) {
            await appState.refreshWeekSchedule(startingAt: windowStart)
            selectedDateLocal = selectedDateLocal ?? appState.weekSchedule.days.first?.dateLocal
        }
        .onChange(of: addRequestID) { _, _ in
            beginAdding()
        }
        .confirmationDialog(
            "Delete this schedule entry?",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible
        ) {
            if pendingDelete?.patternID != nil {
                Button("Skip only this day", role: .destructive) { deleteSelectedOccurrence() }
                Button("Delete the weekly pattern", role: .destructive) { deleteSelectedPattern() }
            } else {
                Button("Delete", role: .destructive) { deleteSelectedOccurrence() }
            }
            Button("Cancel", role: .cancel) { pendingDelete = nil }
        } message: {
            Text(pendingDelete?.patternID == nil
                 ? "This removes the selected schedule entry."
                 : "Choose whether to skip this date only or remove the complete weekly pattern. Single-day changes are preserved when the pattern is removed.")
        }
        .alert("Schedule couldn’t update", isPresented: Binding(get: { operationError != nil }, set: { if !$0 { operationError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(operationError ?? "Please try again.")
        }
        .alert("Schedule updated", isPresented: Binding(get: { appState.scheduleNotice != nil }, set: { if !$0 { appState.scheduleNotice = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(appState.scheduleNotice ?? "Your schedule is current.")
        }
    }

    private var visibleDateRange: ClosedRange<Date> {
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: windowStart)
        let end = calendar.date(byAdding: .day, value: 13, to: start) ?? start
        return start...end
    }

    private var selectedDay: ScheduleDay? {
        let fallback = appState.weekSchedule.days.first
        guard let selectedDateLocal else { return fallback }
        return appState.weekSchedule.days.first { $0.dateLocal == selectedDateLocal } ?? fallback
    }

    private var weekNavigation: some View {
        HStack {
            Button { moveWeek(-14) } label: {
                Image(systemName: "chevron.left").frame(width: 40, height: 40)
            }
            Spacer()
            VStack(spacing: 3) {
                Text("FOURTEEN-DAY PLAN")
                    .font(EPFont.eyebrow)
                    .tracking(1.5)
                    .foregroundStyle(EPColor.gold)
                Text("\(windowStart.formatted(.dateTime.day().month(.abbreviated))) — \(visibleDateRange.upperBound.formatted(.dateTime.day().month(.abbreviated)))")
                    .font(EPFont.body(14, weight: .semibold))
                    .foregroundStyle(EPColor.textPrimary)
            }
            Spacer()
            Button { moveWeek(14) } label: {
                Image(systemName: "chevron.right").frame(width: 40, height: 40)
            }
        }
    }

    private var dayPicker: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 7), count: 7), spacing: 7) {
            ForEach(appState.weekSchedule.days) { day in
                let selected = selectedDay?.id == day.id
                Button {
                    selectedDateLocal = day.dateLocal
                } label: {
                    VStack(spacing: 6) {
                        Text(day.date.formatted(.dateTime.weekday(.narrow)))
                        Text(day.date.formatted(.dateTime.day()))
                            .font(EPFont.body(14, weight: .bold))
                        Circle()
                            .fill(day.conflicts.isEmpty ? Color.clear : day.conflicts.first?.state.color ?? EPColor.rose)
                            .frame(width: 5, height: 5)
                    }
                    .font(EPFont.body(10.5, weight: .semibold))
                    .foregroundStyle(selected ? EPColor.canvas : EPColor.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: 62)
                    .background(selected ? EPColor.goldLight : EPColor.surface)
                    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityLabel(day.date.formatted(.dateTime.weekday(.wide).day().month()))
            }
        }
    }

    @ViewBuilder private var dayContent: some View {
        if let error = appState.weekSchedule.latestSweepError {
            VStack(alignment: .leading, spacing: 10) {
                EPNote(text: error)
                Button("Retry conflict check") {
                    Task {
                        await appState.recalculateAndRefresh()
                        await appState.refreshWeekSchedule(startingAt: windowStart)
                    }
                }
                .buttonStyle(EPSecondaryButtonStyle())
            }
        }

        if let day = selectedDay {
            EPEyebrow(text: day.date.formatted(.dateTime.weekday(.wide).day().month(.wide)))
            if day.entries.isEmpty {
                EPCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("No schedule data", systemImage: "calendar.badge.exclamationmark")
                            .font(EPFont.rowTitle)
                            .foregroundStyle(EPColor.textPrimary)
                        Text("No work, required-care or coverage records exist for this day. EqualPath is not claiming the day is covered.")
                            .font(EPFont.body(12.5))
                            .foregroundStyle(EPColor.textTertiary)
                    }
                }
            } else {
                VStack(spacing: 10) {
                    ForEach(day.entries) { entry in
                        ScheduleEntryCard(entry: entry, onEdit: {
                            beginEditing(entry)
                        }, onEditPattern: {
                            beginEditingPattern(entry)
                        }, onDelete: {
                            pendingDelete = entry
                        })
                    }
                }
            }

            if day.hasRequiredCare {
                careCoverageResult(day)
            }

            if let warning = handoverWarning(for: day) {
                EPNote(text: warning)
            }

            if day.conflicts.isEmpty, !day.entries.isEmpty, handoverWarning(for: day) == nil {
                EPNote(text: "No care-work conflict was detected from the records shown for this day.")
            } else {
                ForEach(day.conflicts) { conflict in
                    ConflictExplanationCard(conflict: conflict)
                }
            }
        }
    }

    private func handoverWarning(for day: ScheduleDay) -> String? {
        let coverages = day.entries.filter { $0.kind == .careCoverage }
        guard !coverages.isEmpty else { return nil }
        let missingAssignment = coverages.contains {
            $0.collectByMinute == nil || $0.handoverInRef == nil || $0.handoverOutRef == nil
        }
        if missingAssignment {
            return "Handover gap not calculated: add the provider’s collection deadline and choose who handles drop-off and collection."
        }
        if !appState.weekSchedule.travelTimes.isComplete {
            return "Handover gap not calculated: enter home ↔ care, care ↔ work and home ↔ work travel minutes."
        }
        return nil
    }

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView().tint(EPColor.gold)
            Text("Loading the week from Appwrite…")
                .font(EPFont.body(13))
                .foregroundStyle(EPColor.textTertiary)
        }
        .frame(maxWidth: .infinity, minHeight: 220)
    }

    private var scheduleLegend: some View {
        HStack(spacing: 12) {
            legendItem("Work", color: EPColor.blue)
            legendItem("Care needed", color: EPColor.amber)
            legendItem("Coverage", color: EPColor.teal)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Legend: work, care needed, care coverage")
    }

    private func legendItem(_ label: String, color: Color) -> some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(label).font(EPFont.body(9.5, weight: .semibold)).foregroundStyle(EPColor.textTertiary)
        }
    }

    @ViewBuilder private func careCoverageResult(_ day: ScheduleDay) -> some View {
        if day.careGaps.isEmpty {
            EPNote(text: "Required care is fully covered after overlapping coverage records are merged.")
        } else {
            EPCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("UNCOVERED CARE", systemImage: "exclamationmark.triangle.fill")
                        .font(EPFont.body(10.5, weight: .bold))
                        .tracking(1.1)
                        .foregroundStyle(EPColor.rose)
                    ForEach(day.careGaps) { gap in
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(gap.childName).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                                Text(gap.timeRange).font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
                            }
                            Spacer()
                            Text(gap.durationLabel).font(EPFont.body(13, weight: .bold)).foregroundStyle(EPColor.roseText)
                        }
                    }
                    Text("Overlapping coverage is merged before these remaining periods are calculated.")
                        .font(EPFont.body(11.5)).foregroundStyle(EPColor.textFaint)
                }
            }
        }
    }

    private func failureState(_ message: String) -> some View {
        EPCard {
            VStack(alignment: .leading, spacing: 12) {
                Label("The schedule couldn’t load", systemImage: "exclamationmark.triangle")
                    .font(EPFont.rowTitle)
                    .foregroundStyle(EPColor.roseText)
                Text(message).font(EPFont.body(12.5)).foregroundStyle(EPColor.textTertiary)
                Button("Try again") { Task { await appState.refreshWeekSchedule(startingAt: windowStart) } }
                    .buttonStyle(EPSecondaryButtonStyle())
            }
        }
    }

    private func beginAdding() {
        var draft = ScheduleEntryDraft()
        draft.kind = .work
        draft.date = selectedDay?.date ?? windowStart
        draft.childID = appState.weekSchedule.children.first?.id
        draft.effectiveFrom = draft.date
        draft.weekdays = weekday(for: draft.date).map { [$0] } ?? []
        applyHandoverDefaults(to: &draft)
        onPresentEditor(
            ScheduleEditorPresentation(
                draft: draft,
                visibleDates: visibleDateRange,
                children: appState.weekSchedule.children,
                handoverPeople: appState.weekSchedule.handoverPeople,
                weekStarting: windowStart
            )
        )
    }

    private func beginEditing(_ entry: ScheduleEntry) {
        var draft = ScheduleEntryDraft(entry: entry)
        applyHandoverDefaults(to: &draft)
        if entry.spanPart == 0,
           let spanGroup = entry.spanGroup,
           let continuation = appState.weekSchedule.days
            .flatMap(\.entries)
            .first(where: { $0.spanGroup == spanGroup && $0.spanPart == 1 }) {
            draft.endMinute = continuation.endMinute
        }
        onPresentEditor(
            ScheduleEditorPresentation(
                draft: draft,
                visibleDates: visibleDateRange,
                children: appState.weekSchedule.children,
                handoverPeople: appState.weekSchedule.handoverPeople,
                weekStarting: windowStart
            )
        )
    }

    private func beginEditingPattern(_ entry: ScheduleEntry) {
        guard let patternID = entry.patternID,
              let pattern = appState.weekSchedule.patterns.first(where: { $0.id == patternID }) else {
            operationError = "The weekly pattern could not be loaded. Refresh the schedule and try again."
            return
        }
        var draft = ScheduleEntryDraft(pattern: pattern)
        applyHandoverDefaults(to: &draft)
        onPresentEditor(
            ScheduleEditorPresentation(
                draft: draft,
                visibleDates: visibleDateRange,
                children: appState.weekSchedule.children,
                handoverPeople: appState.weekSchedule.handoverPeople,
                weekStarting: windowStart
            )
        )
    }

    private func applyHandoverDefaults(to draft: inout ScheduleEntryDraft) {
        let owner = appState.weekSchedule.handoverPeople.first(where: \.isAccountOwner)
        draft.handoverInRef = draft.handoverInRef ?? owner?.id
        draft.handoverOutRef = draft.handoverOutRef ?? owner?.id
        draft.collectByMinute = draft.collectByMinute ?? draft.endMinute
        draft.travelHomeCareMinutes = appState.weekSchedule.travelTimes.homeToCareMinutes
        draft.travelCareWorkMinutes = appState.weekSchedule.travelTimes.careToWorkMinutes
        draft.travelHomeWorkMinutes = appState.weekSchedule.travelTimes.homeToWorkMinutes
    }

    private func weekday(for date: Date) -> EqualPathWeekday? {
        let index = Calendar.current.component(.weekday, from: date)
        return [1: .sunday, 2: .monday, 3: .tuesday, 4: .wednesday, 5: .thursday, 6: .friday, 7: .saturday][index]
    }

    private func moveWeek(_ days: Int) {
        let next = Calendar.current.date(byAdding: .day, value: days, to: windowStart) ?? windowStart
        windowStart = Calendar.current.startOfDay(for: next)
        selectedDateLocal = nil
    }

    private func deleteSelectedOccurrence() {
        guard let entry = pendingDelete else { return }
        Task {
            do {
                try await appState.deleteScheduleEntry(entry, weekStarting: windowStart)
            } catch {
                operationError = error.localizedDescription
            }
            pendingDelete = nil
        }
    }

    private func deleteSelectedPattern() {
        guard let patternID = pendingDelete?.patternID else { return }
        Task {
            do {
                try await appState.deleteSchedulePattern(patternID, planningFrom: windowStart)
            } catch {
                operationError = error.localizedDescription
            }
            pendingDelete = nil
        }
    }
}

private struct ScheduleEntryCard: View {
    let entry: ScheduleEntry
    let onEdit: () -> Void
    let onEditPattern: () -> Void
    let onDelete: () -> Void

    var body: some View {
        EPCard {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: entry.kind.icon)
                    .foregroundStyle(color)
                    .frame(width: 34, height: 34)
                    .background(color.opacity(0.13))
                    .clipShape(Circle())
                VStack(alignment: .leading, spacing: 5) {
                    Text(entry.title).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                    Text("\(entry.timeRange) · \(entry.kind.label)")
                        .font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
                    if let childName = entry.childName {
                        Text(childName).font(EPFont.body(11.5, weight: .medium)).foregroundStyle(EPColor.textSecondary)
                    }
                    if entry.generatedFromPattern {
                        Text("WEEKLY PATTERN")
                            .font(EPFont.body(9, weight: .bold)).tracking(1).foregroundStyle(EPColor.gold)
                    }
                    if entry.kind == .careCoverage {
                        handoverSummary
                    }
                    if entry.spanPart == 1 {
                        Text("CONTINUES FROM PREVIOUS DAY")
                            .font(EPFont.body(9, weight: .bold)).tracking(1).foregroundStyle(EPColor.textFaint)
                    }
                }
                Spacer(minLength: 0)
                Menu {
                    if entry.spanPart != 1 {
                        Button(entry.patternID == nil ? "Edit" : "Edit only this day", systemImage: "pencil", action: onEdit)
                        if entry.patternID != nil {
                            Button("Edit weekly pattern", systemImage: "repeat", action: onEditPattern)
                        }
                    }
                    Button(entry.patternID == nil ? "Delete" : "Delete or skip…", systemImage: "trash", role: .destructive, action: onDelete)
                } label: {
                    Image(systemName: "ellipsis.circle").frame(width: 36, height: 36)
                }
            }
        }
    }

    private var handoverSummary: some View {
        VStack(alignment: .leading, spacing: 4) {
            Label("Drop-off · \(entry.handoverInName ?? "Not assigned") · \(CoverageSummary.time(entry.startMinute))", systemImage: "arrow.right.to.line")
            Label("Collect · \(entry.handoverOutName ?? "Not assigned") · \(entry.collectByMinute.map(CoverageSummary.time) ?? "Time missing")", systemImage: "arrow.left.to.line")
        }
        .font(EPFont.body(10.5, weight: .medium))
        .foregroundStyle(entry.handoverInRef == nil || entry.handoverOutRef == nil || entry.collectByMinute == nil ? EPColor.roseText : EPColor.textFaint)
        .padding(.top, 2)
    }

    private var color: Color {
        switch entry.kind {
        case .work: EPColor.blue
        case .careRequired: EPColor.amber
        case .careCoverage: EPColor.teal
        }
    }
}

private struct ConflictExplanationCard: View {
    let conflict: ConflictItem

    var body: some View {
        EPCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    StatusBadge(state: conflict.state)
                    Spacer()
                    Text(conflict.priority.uppercased())
                        .font(EPFont.body(9.5, weight: .bold))
                        .tracking(1)
                        .foregroundStyle(conflict.state.color)
                }
                Text("\(conflict.childName) · \(conflict.timeRange) · \(conflict.durationLabel)")
                    .font(EPFont.rowTitle)
                    .foregroundStyle(EPColor.textPrimary)
                if conflict.kind.hasPrefix("handover_") {
                    HStack(spacing: 8) {
                        Image(systemName: "mappin.circle.fill")
                        Text("\(CoverageSummary.time(conflict.startMinute))")
                        Rectangle().fill(conflict.state.color).frame(height: 3)
                        Text("\(CoverageSummary.time(conflict.endMinute))")
                        Image(systemName: "mappin.circle.fill")
                    }
                    .font(EPFont.body(10.5, weight: .bold))
                    .foregroundStyle(conflict.state.color)
                    .accessibilityLabel("Handover gap from \(CoverageSummary.time(conflict.startMinute)) to \(CoverageSummary.time(conflict.endMinute))")
                }
                Text(conflict.priorityExplanation)
                    .font(EPFont.body(12.5))
                    .foregroundStyle(EPColor.textTertiary)
                ForEach(conflict.sourceRecords, id: \.self) { source in
                    Label(source, systemImage: "doc.text")
                        .font(EPFont.body(11.5))
                        .foregroundStyle(EPColor.textSecondary)
                }
            }
        }
    }
}

struct ScheduleEntryEditor: View {
    @Environment(\.dismiss) private var dismiss
    @State private var draft: ScheduleEntryDraft
    @State private var validationMessages: [String] = []
    @State private var isSaving = false
    let visibleDates: ClosedRange<Date>
    let children: [ScheduleChild]
    let handoverPeople: [HandoverPerson]
    let onSave: (ScheduleEntryDraft) async throws -> Void

    init(
        initialDraft: ScheduleEntryDraft,
        visibleDates: ClosedRange<Date>,
        children: [ScheduleChild],
        handoverPeople: [HandoverPerson],
        onSave: @escaping (ScheduleEntryDraft) async throws -> Void
    ) {
        _draft = State(initialValue: initialDraft)
        self.visibleDates = visibleDates
        self.children = children
        self.handoverPeople = handoverPeople
        self.onSave = onSave
    }

    var body: some View {
        VStack(spacing: 0) {
            editorHeader

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 8) {
                        EPEyebrow(text: draft.id == nil ? "New schedule entry" : "Schedule entry")
                        Text(draft.id == nil ? "Add to schedule" : "Edit schedule")
                            .font(EPFont.sectionTitle)
                            .foregroundStyle(EPColor.textPrimary)
                        Text("Choose what this record represents, then add the time and details EqualPath should use.")
                            .font(EPFont.body(13))
                            .foregroundStyle(EPColor.textTertiary)
                            .lineSpacing(4)
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        EditorSectionLabel(text: "Record type")
                        recordTypePicker
                    }

                    repeatSection

                    VStack(alignment: .leading, spacing: 10) {
                        EditorSectionLabel(text: "When")
                        EPCard {
                            VStack(spacing: 0) {
                                if !draft.repeatWeekly {
                                    editorDateRow
                                    Divider().overlay(EPColor.divider)
                                }
                                editorTimeRow("Starts", icon: "sunrise", minute: $draft.startMinute)
                                Divider().overlay(EPColor.divider)
                                editorTimeRow("Ends", icon: "sunset", minute: $draft.endMinute)
                            }
                        }
                    }

                    if draft.endMinute < draft.startMinute {
                        EPNote(text: "This entry ends after midnight. EqualPath will split it across the two calendar days and keep both parts linked.")
                    }

                    VStack(alignment: .leading, spacing: 10) {
                        EditorSectionLabel(text: draft.kind == .work ? "Work details" : "Care details")
                        detailsSection
                    }

                    if !validationMessages.isEmpty {
                        validationCard
                    }
                }
                .padding(.horizontal, 22)
                .padding(.top, 18)
                .padding(.bottom, 22)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 0) {
                Divider().overlay(EPColor.divider)
                Button(action: save) {
                    HStack(spacing: 10) {
                        if isSaving { ProgressView().tint(.white) }
                        Text(isSaving ? "Saving…" : (draft.id == nil ? "Add to schedule" : "Save changes"))
                        if !isSaving { Image(systemName: "arrow.right") }
                    }
                }
                .buttonStyle(EPPrimaryButtonStyle())
                .disabled(isSaving)
                .opacity(isSaving ? 0.78 : 1)
                .padding(.horizontal, 22)
                .padding(.vertical, 12)
                .background(EPColor.canvas.opacity(0.98))
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .navigationBarBackButtonHidden()
        .epScreen()
        .onChange(of: draft.kind) { oldKind, newKind in
            if newKind == .careRequired && draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                draft.title = "Care needed"
            } else if oldKind == .careRequired && draft.title == "Care needed" {
                draft.title = ""
            }
            validationMessages = []
        }
    }

    private var editorHeader: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(EPColor.textSecondary)
                    .frame(width: 42, height: 42)
                    .background(EPColor.surface)
                    .overlay { Circle().stroke(EPColor.border) }
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Cancel")

            Spacer()

            Text(draft.id == nil ? "NEW ENTRY" : "EDIT ENTRY")
                .font(EPFont.eyebrow)
                .tracking(1.7)
                .foregroundStyle(EPColor.textFaint)

            Spacer()

            Color.clear.frame(width: 42, height: 42)
        }
        .padding(.horizontal, 22)
        .padding(.top, 10)
        .padding(.bottom, 8)
        .background(EPColor.canvas)
    }

    private var recordTypePicker: some View {
        HStack(spacing: 10) {
            ForEach(ScheduleEntryKind.allCases) { kind in
                let isSelected = draft.kind == kind
                let accent = EPColor.gold
                Button {
                    guard draft.id == nil, !draft.editingPattern else { return }
                    draft.kind = kind
                } label: {
                    VStack(spacing: 9) {
                        Image(systemName: kind.icon)
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundStyle(isSelected ? EPColor.canvas : accent)
                            .frame(width: 38, height: 38)
                            .background(isSelected ? accent : accent.opacity(0.12))
                            .clipShape(Circle())
                        Text(kind.label)
                            .font(EPFont.body(10.5, weight: .semibold))
                            .foregroundStyle(isSelected ? EPColor.textPrimary : EPColor.textSecondary)
                            .multilineTextAlignment(.center)
                            .lineLimit(2)
                            .frame(height: 30, alignment: .top)
                    }
                    .padding(.horizontal, 7)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, minHeight: 102)
                    .background(isSelected ? accent.opacity(0.12) : EPColor.surface)
                    .overlay {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(isSelected ? accent.opacity(0.8) : EPColor.border, lineWidth: isSelected ? 1.5 : 1)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(draft.id != nil || draft.editingPattern)
                .accessibilityLabel(kind.label)
                .accessibilityValue(isSelected ? "Selected" : "Not selected")
            }
        }
    }

    private var repeatSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            EditorSectionLabel(text: "Repeat")
            EPCard {
                VStack(alignment: .leading, spacing: 14) {
                    Toggle(isOn: $draft.repeatWeekly) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text("Repeat every week").font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                            Text("Creates one occurrence for each selected day in the rolling 14-day plan.")
                                .font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
                        }
                    }
                    .tint(EPColor.gold)
                    .disabled(draft.id != nil || draft.editingPattern)

                    if draft.repeatWeekly {
                        Divider().overlay(EPColor.divider)
                        HStack(spacing: 6) {
                            ForEach(EqualPathWeekday.allCases, id: \.rawValue) { day in
                                let selected = draft.weekdays.contains(day)
                                Button {
                                    if selected {
                                        draft.weekdays.removeAll { $0 == day }
                                    } else {
                                        draft.weekdays.append(day)
                                        draft.weekdays.sort { $0.rawValue < $1.rawValue }
                                    }
                                } label: {
                                    Text(day.initial)
                                        .font(EPFont.body(10.5, weight: .bold))
                                        .foregroundStyle(selected ? EPColor.canvas : EPColor.textSecondary)
                                        .frame(maxWidth: .infinity, minHeight: 36)
                                        .background(selected ? EPColor.goldLight : EPColor.surface)
                                        .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(day.fullName)
                            }
                        }
                        DatePicker("Effective from", selection: $draft.effectiveFrom, in: visibleDates, displayedComponents: .date)
                            .font(EPFont.rowTitle)
                            .tint(EPColor.gold)
                        Toggle("Set an end date", isOn: effectiveUntilEnabled)
                            .font(EPFont.rowTitle)
                            .tint(EPColor.gold)
                        if draft.effectiveUntil != nil {
                            DatePicker(
                                "Effective until",
                                selection: Binding(get: { draft.effectiveUntil ?? draft.effectiveFrom }, set: { draft.effectiveUntil = $0 }),
                                in: draft.effectiveFrom...,
                                displayedComponents: .date
                            )
                            .font(EPFont.rowTitle)
                            .tint(EPColor.gold)
                        }
                    }
                }
            }
        }
    }

    private var effectiveUntilEnabled: Binding<Bool> {
        Binding(
            get: { draft.effectiveUntil != nil },
            set: { enabled in draft.effectiveUntil = enabled ? draft.effectiveFrom : nil }
        )
    }

    private var editorDateRow: some View {
        HStack(spacing: 12) {
            editorRowIcon("calendar", color: EPColor.gold)
            Text("Date").font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
            Spacer()
            DatePicker("Date", selection: $draft.date, in: visibleDates, displayedComponents: .date)
                .labelsHidden()
                .font(EPFont.body(13, weight: .semibold))
                .tint(EPColor.gold)
        }
        .padding(.vertical, 9)
    }

    private func editorTimeRow(_ label: String, icon: String, minute: Binding<Int>) -> some View {
        HStack(spacing: 12) {
            editorRowIcon(icon, color: EPColor.gold)
            Text(label).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
            Spacer()
            DatePicker(label, selection: minuteBinding(minute), displayedComponents: .hourAndMinute)
                .labelsHidden()
                .font(EPFont.body(13, weight: .semibold))
                .tint(EPColor.gold)
        }
        .padding(.vertical, 9)
    }

    @ViewBuilder private var detailsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            EPField(
                label: draft.kind == .work ? "Commitment" : (draft.kind == .careRequired ? "Care label" : "Provider or carer"),
                placeholder: draft.kind == .work ? "Client review" : (draft.kind == .careRequired ? "Care needed" : "TASKA Seri Kasih"),
                text: $draft.title
            )

            if draft.kind == .work {
                workDetails
            } else {
                careDetails
            }
        }
    }

    private var workDetails: some View {
        VStack(alignment: .leading, spacing: 16) {
            EditorSectionLabel(text: "Location")
            HStack(spacing: 9) {
                choiceButton("Office", value: "office", selection: $draft.locationMode, icon: "building.2")
                choiceButton("Home", value: "home", selection: $draft.locationMode, icon: "house")
                choiceButton("Other", value: "other", selection: $draft.locationMode, icon: "mappin")
            }

            EPCard {
                Toggle(isOn: $draft.remotePossible) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Can be attended remotely")
                            .font(EPFont.rowTitle)
                            .foregroundStyle(EPColor.textPrimary)
                        Text("Used when EqualPath ranks a conflict")
                            .font(EPFont.rowSubtitle)
                            .foregroundStyle(EPColor.textDim)
                    }
                }
                .tint(EPColor.blue)
            }

            EditorSectionLabel(text: "Priority")
            HStack(spacing: 10) {
                choiceButton("Fixed", value: "fixed", selection: $draft.priority, icon: "lock.fill")
                choiceButton("Flexible", value: "flexible", selection: $draft.priority, icon: "arrow.left.and.right")
            }
        }
    }

    private var careDetails: some View {
        VStack(alignment: .leading, spacing: 16) {
            EPCard {
                HStack(spacing: 12) {
                    editorRowIcon("person.crop.circle", color: accentColor(for: draft.kind))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Child").font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                        Text("Care is calculated separately for each child")
                            .font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
                    }
                    Spacer(minLength: 8)
                    Picker("Child", selection: $draft.childID) {
                        Text("Choose").tag(String?.none)
                        ForEach(children) { child in
                            Text("\(child.name) · \(child.ageGroup)").tag(String?.some(child.id))
                        }
                    }
                    .labelsHidden()
                    .tint(EPColor.gold)
                }
            }

            EPField(label: "Notes", placeholder: "Optional context", text: $draft.notes)

            if draft.kind == .careCoverage {
                handoverDetails
            }
        }
    }

    private var handoverDetails: some View {
        VStack(alignment: .leading, spacing: 12) {
            EditorSectionLabel(text: "Handover")
            Text("EqualPath uses these hand-entered times to check both drop-off before work and collection after work.")
                .font(EPFont.body(11.5))
                .foregroundStyle(EPColor.textTertiary)
            EPCard {
                VStack(spacing: 0) {
                    editorTimeRow("Collect by", icon: "clock.badge", minute: collectByBinding)
                    Divider().overlay(EPColor.divider)
                    handoverPersonRow("Drop-off by", icon: "arrow.right.to.line", selection: $draft.handoverInRef)
                    Divider().overlay(EPColor.divider)
                    handoverPersonRow("Collection by", icon: "arrow.left.to.line", selection: $draft.handoverOutRef)
                }
            }

            EditorSectionLabel(text: "Travel times")
            EPCard {
                VStack(spacing: 0) {
                    travelRow("Home ↔ care", value: $draft.travelHomeCareMinutes)
                    Divider().overlay(EPColor.divider)
                    travelRow("Care ↔ work", value: $draft.travelCareWorkMinutes)
                    Divider().overlay(EPColor.divider)
                    travelRow("Home ↔ work", value: $draft.travelHomeWorkMinutes)
                }
            }
            EPNote(text: "These are your estimates, not live location data. Missing values keep the handover state as ‘not calculated’ instead of claiming there is no conflict.")
        }
    }

    private var collectByBinding: Binding<Int> {
        Binding(get: { draft.collectByMinute ?? draft.endMinute }, set: { draft.collectByMinute = $0 })
    }

    private func handoverPersonRow(_ label: String, icon: String, selection: Binding<String?>) -> some View {
        HStack(spacing: 12) {
            editorRowIcon(icon, color: EPColor.gold)
            Text(label).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
            Spacer()
            Picker(label, selection: selection) {
                Text("Choose").tag(String?.none)
                ForEach(handoverPeople) { person in
                    Text(person.isAccountOwner ? "You" : person.name).tag(String?.some(person.id))
                }
            }
            .labelsHidden()
            .tint(EPColor.gold)
        }
        .padding(.vertical, 9)
    }

    private func travelRow(_ label: String, value: Binding<Int?>) -> some View {
        HStack(spacing: 12) {
            editorRowIcon("car", color: EPColor.gold)
            VStack(alignment: .leading, spacing: 2) {
                Text(label).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                Text(value.wrappedValue == nil ? "Required for handover calculation" : "User estimate")
                    .font(EPFont.rowSubtitle)
                    .foregroundStyle(value.wrappedValue == nil ? EPColor.roseText : EPColor.textDim)
            }
            Spacer()
            Stepper(
                "\(value.wrappedValue ?? 0) min",
                value: Binding(get: { value.wrappedValue ?? 0 }, set: { value.wrappedValue = $0 }),
                in: 0...360,
                step: 5
            )
            .labelsHidden()
            Text("\(value.wrappedValue ?? 0) min")
                .font(EPFont.body(12, weight: .semibold))
                .foregroundStyle(EPColor.gold)
                .frame(width: 48, alignment: .trailing)
        }
        .padding(.vertical, 9)
    }

    private var validationCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Label("Please check these details", systemImage: "exclamationmark.triangle.fill")
                .font(EPFont.body(12.5, weight: .bold))
                .foregroundStyle(EPColor.roseText)
            ForEach(validationMessages, id: \.self) { message in
                Text("• \(message)")
                    .font(EPFont.body(12))
                    .foregroundStyle(EPColor.textSecondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(EPColor.rose.opacity(0.08))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(EPColor.rose.opacity(0.24))
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private func editorRowIcon(_ name: String, color: Color) -> some View {
        Image(systemName: name)
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(color)
            .frame(width: 32, height: 32)
            .background(color.opacity(0.12))
            .clipShape(Circle())
    }

    private func choiceButton(
        _ label: String,
        value: String,
        selection: Binding<String>,
        icon: String
    ) -> some View {
        let selected = selection.wrappedValue == value
        return Button {
            selection.wrappedValue = value
        } label: {
            HStack(spacing: 7) {
                Image(systemName: icon)
                Text(label)
            }
            .font(EPFont.body(11.5, weight: .semibold))
            .foregroundStyle(selected ? EPColor.canvas : EPColor.textSecondary)
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(selected ? EPColor.goldLight : EPColor.surface)
            .overlay {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(selected ? Color.clear : EPColor.border)
            }
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func accentColor(for kind: ScheduleEntryKind) -> Color {
        switch kind {
        case .work: EPColor.blue
        case .careRequired: EPColor.amber
        case .careCoverage: EPColor.teal
        }
    }

    private func minuteBinding(_ value: Binding<Int>) -> Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(bySettingHour: value.wrappedValue / 60, minute: value.wrappedValue % 60, second: 0, of: .now) ?? .now
            },
            set: { date in
                let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
                value.wrappedValue = (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
            }
        )
    }

    private func save() {
        validationMessages = draft.validationMessages(visibleDates: visibleDates)
        guard validationMessages.isEmpty else { return }
        isSaving = true
        Task {
            do {
                try await onSave(draft)
                dismiss()
            } catch {
                validationMessages = [error.localizedDescription]
                isSaving = false
            }
        }
    }
}

private struct EditorSectionLabel: View {
    let text: String

    var body: some View {
        Text(text.uppercased())
            .font(EPFont.eyebrow)
            .tracking(1.6)
            .foregroundStyle(EPColor.textFaint)
    }
}

struct PlansView: View {
    @State private var reviewedPlan: PlanOption?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    EPEyebrow(text: "For tomorrow")
                    Text("Two possible paths")
                        .font(EPFont.headline)
                        .foregroundStyle(EPColor.textPrimary)
                    Text("These are drafts based on the people and flexibility you added. EqualPath will never contact anyone until you review and approve a request.")
                        .font(EPFont.body(14))
                        .foregroundStyle(EPColor.textTertiary)
                        .lineSpacing(6)

                    ForEach(PlanOption.samples) { plan in
                        PlanCard(plan: plan) { reviewedPlan = plan }
                    }

                    EPNote(text: "Plan delivery and carer confirmation are later-iteration services. This build shows the review flow without claiming a request has been sent.")
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 18)
            }
            .navigationTitle("Plans")
            .navigationBarTitleDisplayMode(.inline)
            .epScreen()
            .sheet(item: $reviewedPlan) { plan in
                PlanReviewSheet(plan: plan)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }
}

private struct PlanOption: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String
    let color: Color
    let icon: String
    let steps: [String]

    static let samples = [
        PlanOption(title: "Farid collects Nia", subtitle: "Family cover · one request", color: EPColor.orange, icon: "person.2.fill", steps: ["Farid covers 15:30 — 18:00", "You collect from Farid after work"]),
        PlanOption(title: "Move the flexible block", subtitle: "Work change · no carer request", color: EPColor.blue, icon: "arrow.left.arrow.right", steps: ["Move the 12:00 focus block", "Leave work in time for collection"])
    ]
}

private struct PlanCard: View {
    let plan: PlanOption
    let action: () -> Void

    var body: some View {
        EPCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(spacing: 12) {
                    Image(systemName: plan.icon)
                        .foregroundStyle(plan.color)
                        .frame(width: 40, height: 40)
                        .background(plan.color.opacity(0.13))
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        Text(plan.title).font(EPFont.sectionTitle).foregroundStyle(EPColor.textPrimary)
                        Text(plan.subtitle).font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
                    }
                }
                ForEach(plan.steps, id: \.self) { step in
                    Label(step, systemImage: "diamond.fill")
                        .font(EPFont.body(12.5))
                        .foregroundStyle(EPColor.textSecondary)
                        .labelStyle(PlanStepLabelStyle(color: plan.color))
                }
                Button("Review this path", action: action)
                    .buttonStyle(EPSecondaryButtonStyle())
            }
        }
    }
}

private struct PlanStepLabelStyle: LabelStyle {
    let color: Color
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 10) {
            configuration.icon.font(.system(size: 6)).foregroundStyle(color)
            configuration.title
        }
    }
}

private struct PlanReviewSheet: View {
    let plan: PlanOption
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                EPEyebrow(text: "Review only")
                Text(plan.title).font(EPFont.headline).foregroundStyle(EPColor.textPrimary)
                ForEach(plan.steps, id: \.self) { step in
                    Label(step, systemImage: "checkmark.circle")
                        .font(EPFont.body(14, weight: .medium))
                        .foregroundStyle(EPColor.textSecondary)
                }
                EPNote(text: "Sending and confirmation are not enabled in this iteration, so this review cannot contact anyone.")
                Spacer()
                Button("Done") { dismiss() }.buttonStyle(EPPrimaryButtonStyle())
            }
            .padding(24)
            .epScreen()
        }
    }
}
