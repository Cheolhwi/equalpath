import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var appState: AppState
    @Namespace private var scheduleNavigation
    @State private var selection: Int
    @State private var scheduleEditor: ScheduleEditorPresentation?
    @State private var scheduleAddRequest = 0

    init() {
#if DEBUG
        _selection = State(initialValue: ProcessInfo.processInfo.arguments.contains("-EqualPathPreviewSchedule") ? 1 : 0)
#else
        _selection = State(initialValue: 0)
#endif
    }

    var body: some View {
        NavigationStack {
            TabView(selection: $selection) {
                TonightView()
                    .tabItem { Label("Tonight", systemImage: "moon.stars") }
                    .tag(0)
                ScheduleView(addRequestID: scheduleAddRequest) { presentation in
                    scheduleEditor = presentation
                }
                .tabItem { Label("Schedule", systemImage: "calendar") }
                .tag(1)
                PeopleView()
                    .tabItem { Label("People", systemImage: "person.2") }
                    .tag(2)
                SettingsView()
                    .tabItem { Label("Me", systemImage: "person.crop.circle") }
                    .tag(3)
            }
            .navigationTitle(selection == 1 ? "Schedule" : "")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar(selection == 1 ? .visible : .hidden, for: .navigationBar)
            .toolbar {
                if selection == 1 {
                    ToolbarItem(placement: .topBarTrailing) {
                        addButton
                    }
                }
            }
            .navigationDestination(isPresented: scheduleEditorPresented) {
                if let presentation = scheduleEditor {
                    editorDestination(presentation)
                }
            }
        }
        .tint(EPColor.gold)
        .toolbarBackground(EPColor.tabBar, for: .tabBar)
        .toolbarBackground(.visible, for: .tabBar)
        .epScreen()
    }

    @ViewBuilder private var addButton: some View {
        if #available(iOS 26.0, *) {
            Button {
                scheduleAddRequest += 1
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(EPColor.gold)
                    .accessibilityHidden(true)
            }
            .tint(EPColor.gold)
            .buttonBorderShape(.circle)
            .controlSize(.regular)
            .contentShape(Circle())
            .matchedTransitionSource(id: "schedule-add", in: scheduleNavigation) { source in
                source.clipShape(RoundedRectangle(cornerRadius: 100, style: .continuous))
            }
            .overlay {
                Image(systemName: "plus")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(EPColor.gold)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
            }
            .accessibilityLabel("Add schedule entry")
        } else if #available(iOS 18.0, *) {
            Button {
                scheduleAddRequest += 1
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(EPColor.gold)
                    .accessibilityHidden(true)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.circle)
            .controlSize(.regular)
            .contentShape(Circle())
            .matchedTransitionSource(id: "schedule-add", in: scheduleNavigation) { source in
                source.clipShape(RoundedRectangle(cornerRadius: 100, style: .continuous))
            }
            .accessibilityLabel("Add schedule entry")
        } else {
            Button {
                scheduleAddRequest += 1
            } label: {
                Image(systemName: "plus")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(EPColor.gold)
                    .accessibilityHidden(true)
            }
            .buttonStyle(.bordered)
            .buttonBorderShape(.circle)
            .controlSize(.regular)
            .accessibilityLabel("Add schedule entry")
        }
    }

    private var scheduleEditorPresented: Binding<Bool> {
        Binding(
            get: { scheduleEditor != nil },
            set: { isPresented in
                if !isPresented { scheduleEditor = nil }
            }
        )
    }

    @ViewBuilder
    private func editorDestination(_ presentation: ScheduleEditorPresentation) -> some View {
        let editor = ScheduleEntryEditor(
            initialDraft: presentation.draft,
            visibleDates: presentation.visibleDates,
            children: presentation.children,
            handoverPeople: presentation.handoverPeople
        ) { draft in
            try await appState.saveScheduleEntry(draft, weekStarting: presentation.weekStarting)
        }

        if #available(iOS 18.0, *) {
            editor.navigationTransition(.zoom(sourceID: "schedule-add", in: scheduleNavigation))
        } else {
            editor
        }
    }
}
