import SwiftUI

struct PeopleView: View {
    @EnvironmentObject private var appState: AppState

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    EPEyebrow(text: "Support circle")
                    Text("People Nia knows")
                        .font(EPFont.headline)
                        .foregroundStyle(EPColor.textPrimary)
                    Text("No request is automatic. A person receives only the details you approve for a specific gap.")
                        .font(EPFont.body(14))
                        .foregroundStyle(EPColor.textTertiary)
                        .lineSpacing(6)

                    EPCard {
                        VStack(spacing: 0) {
                            PersonRow(name: "Farid", relationship: "Partner", state: "AVAILABLE", color: EPColor.greenText)
                            Divider().overlay(EPColor.divider)
                            PersonRow(name: "Mother", relationship: "Family", state: "ADDED", color: EPColor.orange)
                        }
                    }

                    Button { } label: {
                        Label("Add someone", systemImage: "plus")
                    }
                    .buttonStyle(EPSecondaryButtonStyle())

                    EPNote(text: "Carers do not need to install EqualPath. The carer-side confirmation experience is designed to work from a secure link.")
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 18)
            }
            .navigationTitle("People")
            .navigationBarTitleDisplayMode(.inline)
            .epScreen()
        }
    }
}

private struct PersonRow: View {
    let name: String
    let relationship: String
    let state: String
    let color: Color

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(color.opacity(0.14))
                .frame(width: 44, height: 44)
                .overlay { Text(String(name.prefix(1))).font(EPFont.display(21)).foregroundStyle(color) }
            VStack(alignment: .leading, spacing: 4) {
                Text(name).font(EPFont.rowTitle).foregroundStyle(EPColor.textPrimary)
                Text(relationship).font(EPFont.rowSubtitle).foregroundStyle(EPColor.textDim)
            }
            Spacer()
            Text(state).font(EPFont.body(9.5, weight: .bold)).tracking(1).foregroundStyle(color)
        }
        .padding(.vertical, 13)
    }
}
