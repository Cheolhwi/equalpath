import SwiftUI

struct OnboardingFlowView: View {
    @EnvironmentObject private var appState: AppState
    @State private var step = 0
    @State private var setupError: String?
    @State private var validationError: String?

    private let totalSteps = 8

    var body: some View {
        VStack(spacing: 0) {
            header
            if step < totalSteps {
                EPProgressRail(current: min(step, totalSteps - 1), total: totalSteps)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 12)
            }

            Group {
                switch step {
                case 0: ProfileSetupView(draft: $appState.onboarding)
                case 1: ChildrenSetupView(draft: $appState.onboarding)
                case 2: CareHoursSetupView(draft: $appState.onboarding)
                case 3: WorkWeekSetupView(draft: $appState.onboarding)
                case 4: NotificationSetupView(enabled: $appState.onboarding.notificationEnabled)
                case 5: LocationSetupView(draft: $appState.onboarding)
                case 6: CarerSetupView(carers: $appState.onboarding.carers)
                case 7: InitialSweepView(step: $step, setupError: $setupError)
                default: FirstResultView()
                }
            }
            .id(step)
            .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))
        }
        .epScreen()
        .animation(.easeInOut(duration: 0.25), value: step)
        .alert("Setup couldn’t finish", isPresented: Binding(get: { setupError != nil }, set: { if !$0 { setupError = nil } })) {
            Button("Try again", role: .cancel) {}
        } message: {
            Text(setupError ?? "Please try again.")
        }
        .alert("Check this step", isPresented: Binding(get: { validationError != nil }, set: { if !$0 { validationError = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(validationError ?? "Please complete the required fields.")
        }
    }

    private var header: some View {
        HStack {
            Button {
                if step > 0 && step < totalSteps { step -= 1 }
            } label: {
                Image(systemName: "chevron.left")
                    .frame(width: 44, height: 44)
            }
            .opacity(step > 0 && step < totalSteps ? 1 : 0)
            .disabled(step == 0 || step >= totalSteps)
            Spacer()
            Text(step >= totalSteps ? "First result" : "Set up EqualPath")
                .font(EPFont.body(16, weight: .semibold))
                .foregroundStyle(EPColor.textBody)
            Spacer()
            if step < 7 {
                Button("Next") { advance() }
                    .font(EPFont.body(14, weight: .semibold))
                    .frame(width: 58, height: 44, alignment: .trailing)
            } else {
                Color.clear.frame(width: 58, height: 44)
            }
        }
        .padding(.horizontal, 14)
        .padding(.top, 4)
    }

    private func advance() {
        if let error = validationMessage(for: step) {
            validationError = error
            return
        }
        if step == 4 && appState.onboarding.notificationEnabled && !appState.isDemoMode {
            Task { _ = await LocalNotificationManager.requestPermission() }
        }
        guard step < 7 else { return }
        step += 1
    }

    private func validationMessage(for step: Int) -> String? {
        let draft = appState.onboarding
        switch step {
        case 0 where draft.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty:
            return "Enter the name your support circle should recognise."
        case 1 where draft.children.isEmpty || draft.children.contains(where: { $0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }):
            return "Enter a name for every child, or remove the empty child row."
        case 2 where draft.providerName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty:
            return "Enter the provider or carer covering these hours."
        case 2 where draft.careDays.isEmpty:
            return "Select at least one registered-care day."
        case 2 where draft.careEndMinute <= draft.careStartMinute:
            return "Registered care must end after it starts."
        case 3 where draft.officeDays.isEmpty && draft.homeWorkDays.isEmpty:
            return "Select at least one work day."
        case 3 where (!draft.officeDays.isEmpty && draft.officeEndMinute <= draft.officeStartMinute) || (!draft.homeWorkDays.isEmpty && draft.homeWorkEndMinute <= draft.homeWorkStartMinute):
            return "Each work period must end after it starts."
        case 3 where draft.workArea.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty:
            return "Enter a work area."
        case 5 where draft.homeArea.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || draft.workArea.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty:
            return "Enter both broad areas; exact addresses are not required."
        default:
            return nil
        }
    }
}

private struct SetupPage<Content: View>: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                EPEyebrow(text: eyebrow)
                Text(title)
                    .font(EPFont.headline)
                    .foregroundStyle(EPColor.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                Text(subtitle)
                    .font(EPFont.body(14))
                    .foregroundStyle(EPColor.textTertiary)
                    .lineSpacing(6)
                content
            }
            .padding(.horizontal, 24)
            .padding(.top, 18)
            .padding(.bottom, 48)
        }
        .scrollDismissesKeyboard(.interactively)
    }
}

private struct ProfileSetupView: View {
    @Binding var draft: OnboardingDraft

    var body: some View {
        SetupPage(eyebrow: "1 · About you", title: "What should carers\ncall you?", subtitle: "Use the name people in your support circle will recognise.") {
            EPField(label: "Your name", placeholder: "Aina", text: $draft.name)
            EPField(label: "Email from Google", placeholder: "you@example.com", text: $draft.email, keyboard: .emailAddress)
                .disabled(true)
                .opacity(0.72)
            EPNote(text: "Carers see only this name. Your Google email remains part of your private account.")
        }
    }
}

private struct ChildrenSetupView: View {
    @Binding var draft: OnboardingDraft

    private let ageGroups = ["0-4", "5-12", "13-17"]

    var body: some View {
        SetupPage(eyebrow: "2 · Family", title: "Your children", subtitle: "Add each child once. EqualPath keeps a separate coverage result for every child.") {
            ForEach(draft.children.indices, id: \.self) { index in
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 12) {
                        TextField("Child’s name", text: $draft.children[index])
                            .font(EPFont.rowTitle)
                        if draft.children.count > 1 {
                            Button("Remove", role: .destructive) {
                                draft.children.remove(at: index)
                                if draft.childAgeGroups.indices.contains(index) { draft.childAgeGroups.remove(at: index) }
                            }
                                .font(EPFont.body(13, weight: .semibold))
                                .foregroundStyle(EPColor.roseText)
                        }
                    }
                    Picker("Age group", selection: ageBinding(index)) {
                        ForEach(ageGroups, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.segmented)
                }
                .padding(16)
                .background(EPColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
            Button {
                draft.children.append("")
                draft.childAgeGroups.append("5-12")
            } label: {
                Label("Add another child", systemImage: "plus")
                    .font(EPFont.rowTitle)
                    .foregroundStyle(EPColor.gold)
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .overlay {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(EPColor.gold.opacity(0.35), style: StrokeStyle(lineWidth: 1, dash: [6]))
                    }
            }
            .buttonStyle(.plain)
        }
    }

    private func ageBinding(_ index: Int) -> Binding<String> {
        Binding(
            get: { draft.childAgeGroups.indices.contains(index) ? draft.childAgeGroups[index] : "5-12" },
            set: { value in
                while draft.childAgeGroups.count <= index { draft.childAgeGroups.append("5-12") }
                draft.childAgeGroups[index] = value
            }
        )
    }
}

private struct CareHoursSetupView: View {
    @Binding var draft: OnboardingDraft
    @State private var editor: CareEditor?

    private enum CareEditor: String, Identifiable {
        case schedule
        case collection

        var id: String { rawValue }
    }

    var body: some View {
        SetupPage(eyebrow: "3 · Registered care", title: "Care hours", subtitle: "Start with the hours your provider has registered for a normal week.") {
            EPField(label: "Provider", placeholder: "Provider name", text: $draft.providerName)
            EPCard {
                VStack(spacing: 0) {
                    Button { editor = .schedule } label: {
                        SetupRow(
                            icon: "calendar",
                            title: daySummary(draft.careDays),
                            subtitle: timeRange(start: draft.careStartMinute, end: draft.careEndMinute)
                        )
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(EPColor.divider)
                    Button { editor = .collection } label: {
                        SetupRow(icon: "person.crop.circle", title: "Collection by", subtitle: collectionSummary(draft.collectionBy))
                    }
                    .buttonStyle(.plain)
                }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("HOW THAT WEEK LOOKS")
                    .font(EPFont.eyebrow)
                    .tracking(1.6)
                    .foregroundStyle(EPColor.textFaint)
                HStack(spacing: 6) {
                    ForEach(EqualPathWeekday.allCases) { day in
                        let isSelected = draft.careDays.contains(day)
                        Button { draft.careDays = toggled(day, in: draft.careDays) } label: {
                            VStack(spacing: 7) {
                                Text(day.initial).font(EPFont.body(10.5, weight: .semibold))
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(isSelected ? EPColor.teal : EPColor.track)
                                    .frame(height: 42)
                                    .overlay {
                                        if isSelected {
                                            Image(systemName: "checkmark")
                                                .font(.caption.bold())
                                                .foregroundStyle(EPColor.canvas)
                                        }
                                    }
                            }
                            .foregroundStyle(isSelected ? EPColor.textSecondary : EPColor.textDisabled)
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(day.fullName)
                        .accessibilityValue(isSelected ? "Selected" : "Not selected")
                    }
                }
            }
            EPNote(text: "A public-holiday closure is uncovered, not unknown. EqualPath always names the source behind that result.")
        }
        .sheet(item: $editor) { editor in
            switch editor {
            case .schedule:
                ScheduleEditorSheet(
                    title: "Registered care hours",
                    days: $draft.careDays,
                    startMinute: $draft.careStartMinute,
                    endMinute: $draft.careEndMinute,
                    accent: EPColor.teal
                )
            case .collection:
                CollectionEditorSheet(selection: $draft.collectionBy, carers: draft.carers)
            }
        }
    }
}

private struct WorkWeekSetupView: View {
    @Binding var draft: OnboardingDraft
    @State private var editor: WorkEditor?

    private enum WorkEditor: String, Identifiable {
        case office
        case home
        case travel

        var id: String { rawValue }
    }

    var body: some View {
        SetupPage(eyebrow: "4 · Work", title: "Your work week", subtitle: "EqualPath compares these commitments with every child’s care hours.") {
            EPCard {
                VStack(spacing: 0) {
                    Button { editor = .office } label: {
                        SetupRow(
                            icon: "briefcase",
                            title: daySummary(draft.officeDays),
                            subtitle: "\(timeRange(start: draft.officeStartMinute, end: draft.officeEndMinute)) · in office"
                        )
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(EPColor.divider)
                    Button { editor = .home } label: {
                        SetupRow(
                            icon: "house",
                            title: daySummary(draft.homeWorkDays),
                            subtitle: "\(timeRange(start: draft.homeWorkStartMinute, end: draft.homeWorkEndMinute)) · from home"
                        )
                    }
                    .buttonStyle(.plain)
                    Divider().overlay(EPColor.divider)
                    Button { editor = .travel } label: {
                        SetupRow(icon: "car", title: "Care ↔ work", subtitle: "\(draft.travelCareWorkMinutes) minutes")
                    }
                    .buttonStyle(.plain)
                }
            }
            EPField(label: "Work area", placeholder: "KL Sentral", text: $draft.workArea)
            EPNote(text: "Travel is counted on both ends. Otherwise a 16:00 collection after a 15:30 finish could look possible when it is not.")
        }
        .sheet(item: $editor) { editor in
            switch editor {
            case .office:
                ScheduleEditorSheet(
                    title: "Office days",
                    days: $draft.officeDays,
                    startMinute: $draft.officeStartMinute,
                    endMinute: $draft.officeEndMinute,
                    accent: EPColor.gold
                )
            case .home:
                ScheduleEditorSheet(
                    title: "Work-from-home days",
                    days: $draft.homeWorkDays,
                    startMinute: $draft.homeWorkStartMinute,
                    endMinute: $draft.homeWorkEndMinute,
                    accent: EPColor.blue
                )
            case .travel:
                TravelEditorSheet(
                    title: "Care ↔ work",
                    explanation: "Used for drop-off before work and collection after an office commitment.",
                    minutes: $draft.travelCareWorkMinutes
                )
            }
        }
    }
}

private struct NotificationSetupView: View {
    @Binding var enabled: Bool

    var body: some View {
        SetupPage(eyebrow: "5 · Alerts", title: "Know the night before", subtitle: "After each sync, EqualPath schedules the next 14 days of reminders directly on this iPhone.") {
            EPCard {
                Toggle("Tomorrow’s care gap · 21:00", isOn: $enabled)
                .font(EPFont.rowTitle)
                .tint(EPColor.blue)
            }
            EPNote(text: "The reminder is stored on this device. No Apple Developer membership or APNs setup is needed. Open EqualPath after a schedule change to refresh pending reminders.")
        }
    }
}

private struct LocationSetupView: View {
    @Binding var draft: OnboardingDraft
    @State private var travelEditor: TravelRoute?

    private enum TravelRoute: String, Identifiable {
        case homeCare
        case careWork
        case homeWork
        var id: String { rawValue }
    }

    var body: some View {
        SetupPage(eyebrow: "6 · Travel", title: "Areas, not addresses", subtitle: "EqualPath uses broad home and work areas to judge whether a collection is physically possible.") {
            EPField(label: "Home area", placeholder: "Ampang", text: $draft.homeArea)
            EPField(label: "Work area", placeholder: "KL Sentral", text: $draft.workArea)
            EPCard {
                VStack(spacing: 0) {
                    Button { travelEditor = .homeCare } label: {
                        SetupRow(icon: "house.and.flag", title: "Home ↔ care", subtitle: "\(draft.travelHomeCareMinutes) minutes")
                    }.buttonStyle(.plain)
                    Divider().overlay(EPColor.divider)
                    Button { travelEditor = .careWork } label: {
                        SetupRow(icon: "building.2", title: "Care ↔ work", subtitle: "\(draft.travelCareWorkMinutes) minutes")
                    }.buttonStyle(.plain)
                    Divider().overlay(EPColor.divider)
                    Button { travelEditor = .homeWork } label: {
                        SetupRow(icon: "briefcase", title: "Home ↔ work", subtitle: "\(draft.travelHomeWorkMinutes) minutes")
                    }.buttonStyle(.plain)
                }
            }
            EPNote(text: "No live tracking. These three estimates are typed by you and let EqualPath calculate both morning drop-off and evening collection handovers.")
        }
        .sheet(item: $travelEditor) { route in
            switch route {
            case .homeCare:
                TravelEditorSheet(title: "Home ↔ care", explanation: "Used when a home-based commitment is followed by collection, or when travel starts at home.", minutes: $draft.travelHomeCareMinutes)
            case .careWork:
                TravelEditorSheet(title: "Care ↔ work", explanation: "Used between a care provider and an office commitment in both directions.", minutes: $draft.travelCareWorkMinutes)
            case .homeWork:
                TravelEditorSheet(title: "Home ↔ work", explanation: "Stored for complete journey planning; no map or live location is used.", minutes: $draft.travelHomeWorkMinutes)
            }
        }
    }
}

private struct CarerSetupView: View {
    @Binding var carers: [String]

    var body: some View {
        SetupPage(eyebrow: "7 · Support", title: "People you trust", subtitle: "Adding carers helps EqualPath suggest a path when a gap opens. Nothing is sent without your approval.") {
            ForEach(carers.indices, id: \.self) { index in
                EPField(label: "Carer \(index + 1)", placeholder: "Name", text: $carers[index])
            }
            Button { carers.append("") } label: {
                Label("Add another carer", systemImage: "plus")
            }
            .buttonStyle(EPSecondaryButtonStyle())
            EPNote(text: "Skipping this still finds gaps. It only means EqualPath cannot suggest someone from your support circle yet.")
        }
    }
}

private struct InitialSweepView: View {
    @EnvironmentObject private var appState: AppState
    @Binding var step: Int
    @Binding var setupError: String?
    @State private var progress = 0.02
    @State private var started = false

    var body: some View {
        VStack(spacing: 26) {
            Spacer()
            ZStack {
                Circle().fill(EPColor.blue.opacity(0.22)).frame(width: 210, height: 210).blur(radius: 4)
                Circle().trim(from: 0, to: progress).stroke(EPColor.gold, style: StrokeStyle(lineWidth: 8, lineCap: .round)).rotationEffect(.degrees(-90)).frame(width: 150, height: 150)
                Text("\(Int(progress * 100))%")
                    .font(EPFont.display(42))
                    .foregroundStyle(EPColor.textPrimary)
                    .contentTransition(.numericText())
            }
            VStack(spacing: 10) {
                EPEyebrow(text: "Setting up")
                Text("Reading the next\nfourteen days")
                    .font(EPFont.headline)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(EPColor.textPrimary)
                Text("Comparing each child’s care hours against your work week, day by day.")
                    .font(EPFont.body(14))
                    .foregroundStyle(EPColor.textTertiary)
                    .multilineTextAlignment(.center)
            }
            VStack(alignment: .leading, spacing: 13) {
                SweepRow(title: "Reading registered care", done: progress > 0.2)
                SweepRow(title: "Placing work and travel", done: progress > 0.45)
                SweepRow(title: "Keeping unknown time separate", done: progress > 0.7)
                SweepRow(title: "Finding tomorrow’s gaps", done: progress >= 1)
            }
            .padding(.horizontal, 34)
            Spacer()
        }
        .padding(.horizontal, 24)
        .task {
            guard !started else { return }
            started = true
            withAnimation(.easeInOut(duration: 1.2)) { progress = 0.78 }
            do {
                try await appState.finishOnboarding()
                withAnimation(.easeOut(duration: 0.35)) { progress = 1 }
                try? await Task.sleep(for: .milliseconds(450))
                step = 8
            } catch {
                setupError = error.localizedDescription
                started = false
            }
        }
    }
}

private struct SweepRow: View {
    let title: String
    let done: Bool

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(done ? EPColor.greenText : EPColor.textDisabled)
            Text(title)
                .font(EPFont.body(13.5, weight: .medium))
                .foregroundStyle(done ? EPColor.textSecondary : EPColor.textFaint)
        }
        .animation(.easeInOut, value: done)
    }
}

private struct FirstResultView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                EPEyebrow(text: "First sweep · Appwrite result", color: appState.snapshot.summary.state.color)
                Text(firstResultTitle)
                    .font(EPFont.headline)
                    .foregroundStyle(EPColor.textPrimary)
                Text(firstResultDetail)
                    .font(EPFont.body(14))
                    .foregroundStyle(EPColor.textTertiary)
                    .lineSpacing(6)
                CoverageRing(summary: appState.snapshot.summary, size: 190)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                EPCard {
                    VStack(spacing: 14) {
                        ForEach(appState.snapshot.sources) { source in
                            SourceRecordRow(record: source)
                        }
                    }
                }
                Button("Open tomorrow") { appState.enterMainExperience() }
                    .buttonStyle(EPPrimaryButtonStyle())
                Text("The server checks hourly. This iPhone refreshes its local reminders whenever EqualPath syncs.")
                    .font(EPFont.body(11.5))
                    .foregroundStyle(EPColor.textFaintest)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 24)
            .padding(.top, 18)
            .padding(.bottom, 40)
        }
    }

    private var firstResultTitle: String {
        switch appState.snapshot.summary.state {
        case .noGap: "Setup found no\ngap tomorrow"
        case .uncovered: "Setup found a\ncare gap tomorrow"
        case .unknown: "Setup found time\nto verify tomorrow"
        }
    }

    private var firstResultDetail: String {
        let child = appState.snapshot.featuredChildName ?? "Your family"
        return switch appState.snapshot.summary.state {
        case .noGap: "\(child)’s registered care covers the work commitments currently stored in Appwrite."
        case .uncovered: "\(child) needs \(appState.snapshot.summary.hourLabel) of cover based on tomorrow’s Appwrite care and work records."
        case .unknown: "\(child) has \(appState.snapshot.summary.hourLabel) that could not be verified from tomorrow’s Appwrite records."
        }
    }
}

private struct SetupRow: View {
    let icon: String
    let title: String
    let subtitle: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(EPColor.gold).frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                Text(subtitle).font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(EPColor.textDisabled)
        }
        .padding(.vertical, 13)
        .contentShape(Rectangle())
    }
}

private struct ScheduleEditorSheet: View {
    let title: String
    @Binding var days: [EqualPathWeekday]
    @Binding var startMinute: Int
    @Binding var endMinute: Int
    let accent: Color

    @Environment(\.dismiss) private var dismiss

    private var isValid: Bool { endMinute > startMinute && !days.isEmpty }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("DAYS")
                            .font(EPFont.eyebrow)
                            .tracking(1.6)
                            .foregroundStyle(EPColor.textFaint)
                        EditorWeekdayPicker(days: $days, accent: accent)
                    }

                    EPCard {
                        VStack(spacing: 0) {
                            DatePicker("Starts", selection: timeBinding($startMinute), displayedComponents: .hourAndMinute)
                                .font(EPFont.rowTitle)
                                .tint(accent)
                                .padding(.vertical, 10)
                            Divider().overlay(EPColor.divider)
                            DatePicker("Ends", selection: timeBinding($endMinute), displayedComponents: .hourAndMinute)
                                .font(EPFont.rowTitle)
                                .tint(accent)
                                .padding(.vertical, 10)
                        }
                    }

                    if !isValid {
                        Label("Choose at least one day and an end time after the start time.", systemImage: "exclamationmark.circle")
                            .font(EPFont.body(12.5))
                            .foregroundStyle(EPColor.roseText)
                    }
                }
                .padding(24)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .disabled(!isValid)
                }
            }
            .epScreen()
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(!isValid)
    }
}

private struct EditorWeekdayPicker: View {
    @Binding var days: [EqualPathWeekday]
    let accent: Color

    var body: some View {
        HStack(spacing: 7) {
            ForEach(EqualPathWeekday.allCases) { day in
                EditorWeekdayButton(
                    day: day,
                    isSelected: days.contains(day),
                    accent: accent,
                    action: { days = toggled(day, in: days) }
                )
            }
        }
    }
}

private struct EditorWeekdayButton: View {
    let day: EqualPathWeekday
    let isSelected: Bool
    let accent: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(day.initial)
                .font(EPFont.body(12, weight: .bold))
                .foregroundStyle(isSelected ? EPColor.canvas : EPColor.textDim)
                .frame(maxWidth: .infinity)
                .frame(height: 42)
                .background(isSelected ? accent : EPColor.input)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(day.fullName)
        .accessibilityValue(isSelected ? "Selected" : "Not selected")
    }
}

private struct CollectionEditorSheet: View {
    @Binding var selection: String
    let carers: [String]

    @Environment(\.dismiss) private var dismiss

    private var options: [String] {
        var values = ["You"]
        values.append(contentsOf: carers.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty })
        values.append("Arrange later")
        return values.reduce(into: []) { result, value in
            if !result.contains(value) { result.append(value) }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                EPCard {
                    VStack(spacing: 0) {
                        ForEach(Array(options.enumerated()), id: \.element) { index, option in
                            Button {
                                selection = option
                                dismiss()
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: option == "You" ? "person.crop.circle" : "person.2")
                                        .foregroundStyle(EPColor.gold)
                                        .frame(width: 24)
                                    Text(collectionSummary(option))
                                        .font(EPFont.rowTitle)
                                        .foregroundStyle(EPColor.textPrimary)
                                    Spacer()
                                    if selection == option {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(EPColor.teal)
                                    }
                                }
                                .padding(.vertical, 15)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            if index < options.count - 1 {
                                Divider().overlay(EPColor.divider)
                            }
                        }
                    }
                }
                .padding(24)
            }
            .navigationTitle("Collection by")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .epScreen()
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

private struct TravelEditorSheet: View {
    let title: String
    let explanation: String
    @Binding var minutes: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 30) {
                Text("\(minutes)")
                    .font(EPFont.display(72))
                    .foregroundStyle(EPColor.textPrimary)
                    .contentTransition(.numericText())
                Text("minutes")
                    .font(EPFont.body(14))
                    .foregroundStyle(EPColor.textTertiary)

                HStack(spacing: 16) {
                    Button { minutes = max(0, minutes - 5) } label: {
                        Image(systemName: "minus")
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.bordered)
                    .disabled(minutes == 0)

                    Slider(
                        value: Binding(get: { Double(minutes) }, set: { minutes = Int($0.rounded()) }),
                        in: 0...120,
                        step: 5
                    )
                    .tint(EPColor.gold)

                    Button { minutes = min(120, minutes + 5) } label: {
                        Image(systemName: "plus")
                            .frame(width: 44, height: 44)
                    }
                    .buttonStyle(.bordered)
                    .disabled(minutes == 120)
                }

                EPNote(text: explanation)
                Spacer()
            }
            .padding(24)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .epScreen()
        }
        .presentationDetents([.medium])
        .presentationDragIndicator(.visible)
    }
}

private func toggled(_ day: EqualPathWeekday, in days: [EqualPathWeekday]) -> [EqualPathWeekday] {
    var result = days
    if let index = result.firstIndex(of: day) {
        guard result.count > 1 else { return result }
        result.remove(at: index)
    } else {
        result.append(day)
        result.sort { $0.rawValue < $1.rawValue }
    }
    return result
}

private func daySummary(_ days: [EqualPathWeekday]) -> String {
    let sorted = Array(Set(days.map(\.rawValue)))
        .sorted()
        .compactMap(EqualPathWeekday.init(rawValue:))
    guard let first = sorted.first, let last = sorted.last else { return "Choose days" }
    if sorted.count == 1 { return first.fullName }

    let isContiguous = zip(sorted, sorted.dropFirst()).allSatisfy { $1.rawValue == $0.rawValue + 1 }
    if isContiguous {
        return "\(sorted.count > 2 ? first.fullName : first.shortName) – \(sorted.count > 2 ? last.fullName : last.shortName)"
    }
    return sorted.map(\.shortName).joined(separator: ", ")
}

private func timeRange(start: Int, end: Int) -> String {
    "\(CoverageSummary.time(start)) — \(CoverageSummary.time(end))"
}

private func collectionSummary(_ value: String) -> String {
    switch value {
    case "You": "You, unless arranged"
    case "Arrange later": "To be arranged"
    default: value
    }
}

private func timeBinding(_ minute: Binding<Int>) -> Binding<Date> {
    Binding(
        get: {
            var components = DateComponents()
            components.calendar = Calendar(identifier: .gregorian)
            components.year = 2001
            components.month = 1
            components.day = 1
            components.hour = minute.wrappedValue / 60
            components.minute = minute.wrappedValue % 60
            return components.date ?? .now
        },
        set: { date in
            let components = Calendar.current.dateComponents([.hour, .minute], from: date)
            minute.wrappedValue = (components.hour ?? 0) * 60 + (components.minute ?? 0)
        }
    )
}
