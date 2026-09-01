import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appState: AppState
    @State private var showDelete = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    EPEyebrow(text: appState.isDemoMode ? "Preview account" : "Private account")
                    Text(appState.profile?.name ?? "Your account")
                        .font(EPFont.headline)
                        .foregroundStyle(EPColor.textPrimary)
                    if let email = appState.profile?.email {
                        Text(email).font(EPFont.body(13)).foregroundStyle(EPColor.textDim)
                    }

                    SettingsSection(title: "SCHEDULE SOURCES") {
                        SettingsRow(icon: "person.2", title: "Children", detail: appState.onboarding.children.joined(separator: ", "))
                        SettingsRow(icon: "building.2", title: "Registered care", detail: appState.onboarding.providerName)
                        SettingsRow(icon: "briefcase", title: "Work week", detail: "Mon — Fri · travel included")
                    }

                    SettingsSection(title: "PRIVACY") {
                        SettingsRow(icon: "location.slash", title: "Location", detail: "Areas only · no live tracking")
                        SettingsRow(icon: "lock.shield", title: "Cloud data", detail: appState.isDemoMode ? "Local preview · nothing uploaded" : "Private owner-scoped rows")
                        SettingsRow(icon: "bell", title: "Notifications", detail: appState.onboarding.notificationEnabled ? "On this iPhone · 21:00" : "Check manually")
                    }

                    Button("Sign out") { Task { await appState.logout() } }
                        .buttonStyle(EPSecondaryButtonStyle())
                        .disabled(appState.isBusy)

                    Button("Delete account and data", role: .destructive) { showDelete = true }
                        .font(EPFont.body(14, weight: .semibold))
                        .foregroundStyle(EPColor.roseText)
                        .frame(maxWidth: .infinity, minHeight: 50)

                    Text("Account deletion withdraws pending requests, removes your owned EqualPath rows, and deletes the authentication account last.")
                        .font(EPFont.body(11.5))
                        .foregroundStyle(EPColor.textFaintest)
                        .lineSpacing(4)
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 18)
            }
            .navigationTitle("Me")
            .navigationBarTitleDisplayMode(.inline)
            .epScreen()
            .sheet(isPresented: $showDelete) {
                DeleteAccountSheet()
                    .presentationDetents([.medium])
                    .presentationDragIndicator(.visible)
            }
        }
    }
}

private struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title).font(EPFont.eyebrow).tracking(1.8).foregroundStyle(EPColor.textFaint)
            EPCard { VStack(spacing: 0) { content } }
        }
    }
}

private struct SettingsRow: View {
    let icon: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon).foregroundStyle(EPColor.gold).frame(width: 25)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                Text(detail).font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 12)
    }
}

private struct DeleteAccountSheet: View {
    @EnvironmentObject private var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var confirmation = ""
    @State private var errorMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            EPEyebrow(text: "Permanent action", color: EPColor.roseText)
            Text("Delete EqualPath?").font(EPFont.headline).foregroundStyle(EPColor.textPrimary)
            Text("Type DELETE to remove the account and its owned data. This cannot be undone.")
                .font(EPFont.body(14)).foregroundStyle(EPColor.textTertiary)
            TextField("DELETE", text: $confirmation)
                .textInputAutocapitalization(.characters)
                .font(EPFont.body(16, weight: .semibold))
                .padding(.horizontal, 16)
                .frame(height: 56)
                .background(EPColor.input)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            if let errorMessage {
                Text(errorMessage).font(EPFont.body(12.5)).foregroundStyle(EPColor.roseText)
            }
            Button("Delete account", role: .destructive) {
                Task {
                    do {
                        try await appState.deleteAccount()
                        dismiss()
                    } catch {
                        errorMessage = error.localizedDescription
                    }
                }
            }
            .buttonStyle(EPPrimaryButtonStyle(color: EPColor.rose))
            .disabled(confirmation != "DELETE" || appState.isBusy)
            .opacity(confirmation == "DELETE" ? 1 : 0.45)
        }
        .padding(24)
        .epScreen()
    }
}
