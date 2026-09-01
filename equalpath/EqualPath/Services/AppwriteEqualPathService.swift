import Foundation
import Appwrite
import AppwriteEnums
import AppwriteModels

@MainActor
final class AppwriteEqualPathService: EqualPathServing {
    private enum Config {
        static let endpoint = "https://sgp.cloud.appwrite.io/v1"
        static let projectID = "6a916a6c0030a70a9d75"
        static let databaseID = "equalpath"
        static let coreFunctionID = "iteration1-core"
        static let deleteFunctionID = "delete-account"
    }

    private let client: Client
    private let account: Account
    private let tablesDB: TablesDB
    private let functions: Functions

    private struct FunctionResponse: Decodable {
        let ok: Bool
        let rowID: String?
        let preservedOverrides: Int?
        let error: String?

        enum CodingKeys: String, CodingKey {
            case ok
            case rowID = "row_id"
            case preservedOverrides = "preserved_overrides"
            case error
        }
    }

    private struct NotificationSettings: Codable {
        let notifyHour: Int?
        let timezone: String?
        let alertGap: Bool?

        enum CodingKeys: String, CodingKey {
            case notifyHour = "notify_hour"
            case timezone
            case alertGap = "alert_gap"
        }
    }

    private struct DashboardUserRecord: Codable {
        let timezone: String?
        let travelHomeCareMinutes: Int?
        let travelCareWorkMinutes: Int?
        let travelHomeWorkMinutes: Int?

        enum CodingKeys: String, CodingKey {
            case timezone
            case travelHomeCareMinutes = "travel_home_care_min"
            case travelCareWorkMinutes = "travel_care_work_min"
            case travelHomeWorkMinutes = "travel_home_work_min"
        }
    }

    private struct ChildRecord: Codable {
        let displayName: String?
        let ageGroup: String
        let active: Bool?

        enum CodingKeys: String, CodingKey {
            case displayName = "display_name"
            case ageGroup = "age_group"
            case active
        }
    }

    private struct ConflictRecord: Codable {
        let dateLocal: String
        let childID: String
        let kind: String
        let state: String
        let startMinute: Int
        let endMinute: Int
        let durationMinutes: Int
        let priority: String
        let status: String
        let sourceRecords: [String]
        let lastVerifiedAt: String
        let deterministicKey: String

        enum CodingKeys: String, CodingKey {
            case dateLocal = "date_local"
            case childID = "child_id"
            case kind
            case state
            case startMinute = "start_minute"
            case endMinute = "end_minute"
            case durationMinutes = "duration_minutes"
            case priority
            case status
            case sourceRecords = "source_records"
            case lastVerifiedAt = "last_verified_at"
            case deterministicKey = "deterministic_key"
        }
    }

    private struct CareCommitmentRecord: Codable {
        let childID: String
        let entryKind: String
        let dateLocal: String
        let startMinute: Int
        let endMinute: Int
        let patternID: String?
        let isOverride: Bool?
        let locationLabel: String?
        let collectByMinute: Int?
        let handoverInRef: String?
        let handoverOutRef: String?
        let bandState: String?
        let sourceRecords: [String]?
        let spanGroup: String?
        let spanPart: Int?
        let status: String?

        enum CodingKeys: String, CodingKey {
            case childID = "child_id"
            case entryKind = "entry_kind"
            case dateLocal = "date_local"
            case startMinute = "start_minute"
            case endMinute = "end_minute"
            case patternID = "pattern_id"
            case isOverride = "is_override"
            case locationLabel = "location_label"
            case collectByMinute = "collect_by_minute"
            case handoverInRef = "handover_in_ref"
            case handoverOutRef = "handover_out_ref"
            case bandState = "band_state"
            case sourceRecords = "source_records"
            case spanGroup = "span_group"
            case spanPart = "span_part"
            case status
        }
    }

    private struct SchedulePatternRecord: Codable {
        let kind: String
        let childID: String?
        let byweekday: [String]
        let startMinute: Int
        let endMinute: Int
        let effectiveFrom: String
        let effectiveUntil: String?
        let payloadJSON: String?
        let active: Bool?

        enum CodingKeys: String, CodingKey {
            case kind
            case childID = "child_id"
            case byweekday
            case startMinute = "start_minute"
            case endMinute = "end_minute"
            case effectiveFrom = "effective_from"
            case effectiveUntil = "effective_until"
            case payloadJSON = "payload_json"
            case active
        }
    }

    private struct SupportNetworkRecord: Codable {
        let displayName: String
        let state: String?

        enum CodingKeys: String, CodingKey {
            case displayName = "display_name"
            case state
        }
    }

    private struct WorkCommitmentRecord: Codable {
        let dateLocal: String
        let startMinute: Int
        let endMinute: Int
        let patternID: String?
        let isOverride: Bool?
        let commitmentType: String?
        let locationMode: String?
        let remotePossible: Bool?
        let flexibilityLevel: String?
        let priority: String?
        let sourceLabel: String?
        let spanGroup: String?
        let spanPart: Int?
        let status: String?

        enum CodingKeys: String, CodingKey {
            case dateLocal = "date_local"
            case startMinute = "start_minute"
            case endMinute = "end_minute"
            case patternID = "pattern_id"
            case isOverride = "is_override"
            case commitmentType = "commitment_type"
            case locationMode = "location_mode"
            case remotePossible = "remote_possible"
            case flexibilityLevel = "flexibility_level"
            case priority
            case sourceLabel = "source_label"
            case spanGroup = "span_group"
            case spanPart = "span_part"
            case status
        }
    }

    private struct SweepRecord: Codable {
        let startedAt: String
        let finishedAt: String?
        let overall: String
        let errorCode: String?

        enum CodingKeys: String, CodingKey {
            case startedAt = "started_at"
            case finishedAt = "finished_at"
            case overall
            case errorCode = "error_code"
        }
    }

    init() {
        let client = Client()
            .setEndpoint(Config.endpoint)
            .setProject(Config.projectID)
        self.client = client
        account = Account(client)
        tablesDB = TablesDB(client)
        functions = Functions(client)
    }

    func currentUser() async throws -> UserProfile? {
        do {
            let user = try await account.get()
            return UserProfile(id: user.id, name: user.name, email: user.email)
        } catch {
            return nil
        }
    }

    func signInWithGoogle() async throws -> UserProfile {
        _ = try await account.createOAuth2Session(
            provider: .google,
            scopes: ["openid", "email", "profile"]
        )
        guard let profile = try await currentUser() else {
            throw EqualPathServiceError.notSignedIn
        }
        return profile
    }

    func completeOnboarding(_ draft: OnboardingDraft) async throws {
        guard let user = try await currentUser() else {
            throw EqualPathServiceError.notSignedIn
        }

        _ = try await execute(
            functionID: Config.coreFunctionID,
            payload: [
                "action": "update_profile",
                "data": [
                    "display_name": draft.name,
                    "home_area": draft.homeArea,
                    "work_area": draft.workArea,
                    "travel_home_care_min": draft.travelHomeCareMinutes,
                    "travel_care_work_min": draft.travelCareWorkMinutes,
                    "travel_home_work_min": draft.travelHomeWorkMinutes,
                    "notify_hour": 21,
                    "alert_gap": draft.notificationEnabled,
                    "alert_reply": false,
                    "alert_break": false,
                    "onboarding_completed": true
                ]
            ]
        )

        let effectiveFrom = Date().formatted(.iso8601.year().month().day())
        let careWeekdays = draft.careDays.map(\.backendCode)
        let requiredWeekdays = Array(Set((draft.officeDays + draft.homeWorkDays).map(\.backendCode))).sorted()
        let allWorkStarts = [draft.officeStartMinute, draft.homeWorkStartMinute]
        let allWorkEnds = [draft.officeEndMinute + draft.travelCareWorkMinutes, draft.homeWorkEndMinute + draft.travelHomeCareMinutes]
        let requiredStart = min(draft.careStartMinute, allWorkStarts.min() ?? draft.careStartMinute)
        let requiredEnd = min(24 * 60, max(draft.careEndMinute, allWorkEnds.max() ?? draft.careEndMinute))
        for (index, rawName) in draft.children.enumerated() {
            let child = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !child.isEmpty else { continue }
            let childResponse = try await execute(
                functionID: Config.coreFunctionID,
                payload: [
                    "action": "save_row",
                    "table_id": "children",
                    "row_id": stableID(userID: user.id, kind: "child", index: index),
                    "data": [
                        "display_name": child,
                        "age_group": draft.childAgeGroups.indices.contains(index) ? draft.childAgeGroups[index] : "5-12",
                        "active": true
                    ]
                ]
            )
            guard let childID = childResponse.rowID else {
                throw EqualPathServiceError.invalidResponse
            }

            _ = try await execute(
                functionID: Config.coreFunctionID,
                payload: [
                    "action": "save_row",
                    "table_id": "schedule_patterns",
                    "row_id": stableID(userID: user.id, kind: "required", index: index),
                    "data": [
                        "kind": "care_required",
                        "child_id": childID,
                        "byweekday": requiredWeekdays,
                        "start_minute": requiredStart,
                        "end_minute": requiredEnd,
                        "effective_from": effectiveFrom,
                        "payload_json": "{\"source_label\":\"Care needed while parent works\"}",
                        "active": true
                    ]
                ]
            )

            _ = try await execute(
                functionID: Config.coreFunctionID,
                payload: [
                    "action": "save_row",
                    "table_id": "schedule_patterns",
                    "row_id": stableID(userID: user.id, kind: "coverage", index: index),
                    "data": [
                        "kind": "care_coverage",
                        "child_id": childID,
                        "byweekday": careWeekdays,
                        "start_minute": draft.careStartMinute,
                        "end_minute": draft.careEndMinute,
                        "effective_from": effectiveFrom,
                        "payload_json": "{\"collect_by\":\"\(jsonEscaped(draft.collectionBy))\",\"collect_by_minute\":\(draft.careEndMinute),\"handover_in_ref\":\"\(user.id)\",\"handover_out_ref\":\"\(user.id)\",\"location_label\":\"\(jsonEscaped(draft.providerName))\",\"resource_type\":\"registered_provider\",\"source_label\":\"\(jsonEscaped(draft.providerName)) · registered hours\"}",
                        "active": true
                    ]
                ]
            )
        }

        _ = try await execute(
            functionID: Config.coreFunctionID,
            payload: [
                "action": "save_row",
                "table_id": "schedule_patterns",
                "row_id": stableID(userID: user.id, kind: "work", index: 0),
                "data": [
                    "kind": "work",
                    "byweekday": draft.officeDays.map(\.backendCode),
                    "start_minute": draft.officeStartMinute,
                    "end_minute": draft.officeEndMinute,
                    "effective_from": effectiveFrom,
                    "payload_json": "{\"location_mode\":\"office\",\"source_label\":\"Regular office days\"}",
                    "active": true
                ]
            ]
        )

        _ = try await execute(
            functionID: Config.coreFunctionID,
            payload: [
                "action": "save_row",
                "table_id": "schedule_patterns",
                "row_id": stableID(userID: user.id, kind: "workhome", index: 0),
                "data": [
                    "kind": "work",
                    "byweekday": draft.homeWorkDays.map(\.backendCode),
                    "start_minute": draft.homeWorkStartMinute,
                    "end_minute": draft.homeWorkEndMinute,
                    "effective_from": effectiveFrom,
                    "payload_json": "{\"location_mode\":\"home\",\"source_label\":\"Regular work-from-home days\"}",
                    "active": true
                ]
            ]
        )

        for (index, rawName) in draft.carers.enumerated() {
            let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { continue }
            _ = try await execute(
                functionID: Config.coreFunctionID,
                payload: [
                    "action": "save_row",
                    "table_id": "support_network",
                    "row_id": stableID(userID: user.id, kind: "carer", index: index),
                    "data": [
                        "display_name": name,
                        "relationship": index == 0 ? "partner" : "family",
                        "pickup_possible": true,
                        "emergency_only": false,
                        "state": "active"
                    ]
                ]
            )
        }
    }

    func runInitialSweep() async throws {
        _ = try await execute(
            functionID: Config.coreFunctionID,
            payload: ["action": "initial_sweep"]
        )
    }

    func runRefreshSweep() async throws {
        _ = try await execute(
            functionID: Config.coreFunctionID,
            payload: ["action": "refresh"]
        )
    }

    func tomorrowSnapshot() async throws -> TomorrowSnapshot {
        guard let user = try await currentUser() else {
            throw EqualPathServiceError.notSignedIn
        }

        let settings = try? await tablesDB.getRow(
            databaseId: Config.databaseID,
            tableId: "users",
            rowId: user.id,
            nestedType: DashboardUserRecord.self
        ).data
        let timezoneIdentifier = settings?.timezone ?? "Asia/Kuala_Lumpur"
        let tomorrowLocal = localTomorrow(timezoneIdentifier: timezoneIdentifier)

        async let childrenRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "children",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.equal("active", value: true),
                Query.limit(100)
            ],
            total: false,
            ttl: 0,
            nestedType: ChildRecord.self
        )
        async let conflictsRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "conflicts",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.equal("date_local", value: tomorrowLocal.dateString),
                Query.limit(100)
            ],
            total: false,
            ttl: 0,
            nestedType: ConflictRecord.self
        )
        async let careRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "care_commitments",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.equal("date_local", value: tomorrowLocal.dateString),
                Query.limit(100)
            ],
            total: false,
            ttl: 0,
            nestedType: CareCommitmentRecord.self
        )
        async let workRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "work_commitments",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.equal("date_local", value: tomorrowLocal.dateString),
                Query.limit(100)
            ],
            total: false,
            ttl: 0,
            nestedType: WorkCommitmentRecord.self
        )
        async let sweepsRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "sweeps",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.orderDesc("started_at"),
                Query.limit(20)
            ],
            total: false,
            ttl: 0,
            nestedType: SweepRecord.self
        )

        let (childrenRows, conflictRows, careRows, workRows, sweepRows) = try await (
            childrenRequest,
            conflictsRequest,
            careRequest,
            workRequest,
            sweepsRequest
        )
        let conflicts = conflictRows.rows.map(\.data).filter { $0.status == "open" }
        let care = careRows.rows.map { (id: $0.id, value: $0.data) }.filter { $0.value.status != "cancelled" }
        let work = workRows.rows.map { (id: $0.id, value: $0.data) }
        let successfulSweep = sweepRows.rows.map(\.data).first { $0.overall == "success" }
        let verifiedDates = conflicts.compactMap { isoDate($0.lastVerifiedAt) }
        let checkedAt = successfulSweep?.finishedAt.flatMap(isoDate) ?? verifiedDates.max() ?? .now
        let stale = successfulSweep == nil || Date().timeIntervalSince(checkedAt) > 2 * 60 * 60

        let children = childrenRows.rows.map { row -> ChildCoverage in
            let childConflicts = conflicts.filter { $0.childID == row.id }
            let childRequirements = care
                .map(\.value)
                .filter { $0.childID == row.id && $0.entryKind == "required" }
                .map { ($0.startMinute, $0.endMinute) }
            return ChildCoverage(
                id: row.id,
                name: row.data.displayName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? "Child",
                summary: coverageSummary(
                    conflicts: childConflicts,
                    requiredIntervals: childRequirements,
                    checkedAt: checkedAt,
                    stale: stale
                )
            )
        }
        let featuredChild = children.first { $0.summary.state == .uncovered }
            ?? children.first { $0.summary.state == .unknown }
            ?? children.first
        let featuredConflicts = conflicts.filter { $0.childID == featuredChild?.id }
        let requiredIntervals = care
            .map(\.value)
            .filter { $0.entryKind == "required" }
            .map { ($0.startMinute, $0.endMinute) }
        let globalSummary = coverageSummary(
            conflicts: conflicts,
            requiredIntervals: requiredIntervals,
            checkedAt: checkedAt,
            stale: stale,
            childSummaries: children.map(\.summary)
        )
        let sourceStrings = featuredConflicts.flatMap(\.sourceRecords)
        let fallbackSources = care
            .map(\.value)
            .filter { $0.childID == featuredChild?.id && $0.entryKind == "coverage" }
            .flatMap { $0.sourceRecords ?? [$0.locationLabel].compactMap { $0 } }
            + work.compactMap { $0.value.sourceLabel }

        return TomorrowSnapshot(
            date: tomorrowLocal.date,
            summary: globalSummary,
            children: children,
            sources: sourceRecords(from: sourceStrings.isEmpty ? fallbackSources : sourceStrings),
            featuredChildName: featuredChild?.name,
            timeline: timelineRecords(
                featuredChildID: featuredChild?.id,
                featuredChildName: featuredChild?.name,
                conflicts: featuredConflicts,
                care: care,
                work: work
            ),
            conflicts: conflictItems(
                rows: conflictRows.rows.map { (id: $0.id, value: $0.data) }.filter { $0.value.status == "open" },
                childNames: Dictionary(uniqueKeysWithValues: children.map { ($0.id, $0.name) })
            ),
            hasScheduleData: !care.isEmpty || !work.isEmpty,
            latestSweepError: latestSweepError(from: sweepRows.rows.map(\.data))
        )
    }

    func weekSchedule(startingAt startDate: Date) async throws -> WeekSchedule {
        guard let user = try await currentUser() else {
            throw EqualPathServiceError.notSignedIn
        }

        let settings = try? await tablesDB.getRow(
            databaseId: Config.databaseID,
            tableId: "users",
            rowId: user.id,
            nestedType: DashboardUserRecord.self
        ).data
        let timezoneIdentifier = settings?.timezone ?? "Asia/Kuala_Lumpur"
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timezoneIdentifier) ?? .current
        let start = calendar.startOfDay(for: startDate)
        let end = calendar.date(byAdding: .day, value: 13, to: start) ?? start
        let firstDate = localDateString(start, calendar: calendar)
        let lastDate = localDateString(end, calendar: calendar)

        async let childrenRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "children",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.equal("active", value: true),
                Query.limit(100)
            ],
            total: false,
            ttl: 0,
            nestedType: ChildRecord.self
        )
        async let workRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "work_commitments",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.between("date_local", start: firstDate, end: lastDate),
                Query.limit(250)
            ],
            total: false,
            ttl: 0,
            nestedType: WorkCommitmentRecord.self
        )
        async let careRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "care_commitments",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.between("date_local", start: firstDate, end: lastDate),
                Query.limit(250)
            ],
            total: false,
            ttl: 0,
            nestedType: CareCommitmentRecord.self
        )
        async let conflictsRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "conflicts",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.between("date_local", start: firstDate, end: lastDate),
                Query.limit(250)
            ],
            total: false,
            ttl: 0,
            nestedType: ConflictRecord.self
        )
        async let sweepsRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "sweeps",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.orderDesc("started_at"),
                Query.limit(20)
            ],
            total: false,
            ttl: 0,
            nestedType: SweepRecord.self
        )
        async let patternsRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "schedule_patterns",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.limit(100)
            ],
            total: false,
            ttl: 0,
            nestedType: SchedulePatternRecord.self
        )
        async let supportRequest = tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "support_network",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.limit(100)
            ],
            total: false,
            ttl: 0,
            nestedType: SupportNetworkRecord.self
        )

        let (childRows, workRows, careRows, conflictRows, sweepRows, patternRows, supportRows) = try await (
            childrenRequest,
            workRequest,
            careRequest,
            conflictsRequest,
            sweepsRequest,
            patternsRequest,
            supportRequest
        )
        let children = childRows.rows.map {
            ScheduleChild(
                id: $0.id,
                name: $0.data.displayName?.nilIfEmpty ?? "Child",
                ageGroup: $0.data.ageGroup
            )
        }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let childNames = Dictionary(uniqueKeysWithValues: children.map { ($0.id, $0.name) })
        let handoverPeople = [HandoverPerson(id: user.id, name: user.name.nilIfEmpty ?? "You", isAccountOwner: true)]
            + supportRows.rows
                .filter { $0.data.state != "inactive" }
                .map { HandoverPerson(id: $0.id, name: $0.data.displayName, isAccountOwner: false) }
        let handoverNames = Dictionary(uniqueKeysWithValues: handoverPeople.map { ($0.id, $0.name) })
        let workEntries = workRows.rows.compactMap { row -> ScheduleEntry? in
            let value = row.data
            guard value.status != "cancelled",
                  let date = localDate(value.dateLocal, calendar: calendar) else { return nil }
            return ScheduleEntry(
                id: row.id,
                spanGroup: value.spanGroup,
                spanPart: value.spanPart,
                kind: .work,
                date: date,
                dateLocal: value.dateLocal,
                childID: nil,
                childName: nil,
                title: value.sourceLabel?.nilIfEmpty ?? value.commitmentType?.nilIfEmpty ?? "Work commitment",
                notes: value.commitmentType?.nilIfEmpty ?? "Work",
                startMinute: value.startMinute,
                endMinute: value.endMinute,
                locationMode: value.locationMode ?? "office",
                remotePossible: value.remotePossible ?? false,
                priority: value.priority ?? "fixed",
                collectByMinute: nil,
                generatedFromPattern: value.patternID != nil && value.isOverride != true,
                patternID: value.patternID,
                isOverride: value.isOverride ?? false
            )
        }
        let careEntries = careRows.rows.compactMap { row -> ScheduleEntry? in
            let value = row.data
            guard value.status != "cancelled",
                  let date = localDate(value.dateLocal, calendar: calendar) else { return nil }
            let kind: ScheduleEntryKind = value.entryKind == "required" ? .careRequired : .careCoverage
            let source = value.sourceRecords?.first?.nilIfEmpty
            return ScheduleEntry(
                id: row.id,
                spanGroup: value.spanGroup,
                spanPart: value.spanPart,
                kind: kind,
                date: date,
                dateLocal: value.dateLocal,
                childID: value.childID,
                childName: childNames[value.childID] ?? "Child",
                title: value.locationLabel?.nilIfEmpty ?? source ?? kind.label,
                notes: value.sourceRecords?.dropFirst().joined(separator: " · ") ?? "",
                startMinute: value.startMinute,
                endMinute: value.endMinute,
                locationMode: value.locationLabel ?? "",
                remotePossible: false,
                priority: "normal",
                collectByMinute: value.collectByMinute,
                generatedFromPattern: value.patternID != nil && value.isOverride != true,
                patternID: value.patternID,
                isOverride: value.isOverride ?? false,
                handoverInRef: value.handoverInRef,
                handoverOutRef: value.handoverOutRef,
                handoverInName: value.handoverInRef.flatMap { handoverNames[$0] },
                handoverOutName: value.handoverOutRef.flatMap { handoverNames[$0] }
            )
        }
        let openConflicts = conflictRows.rows
            .map { (id: $0.id, value: $0.data) }
            .filter { $0.value.status == "open" }
        let conflicts = conflictItems(rows: openConflicts, childNames: childNames)
        let entries = (workEntries + careEntries).sorted(by: scheduleEntryOrder)
        let days = (0..<14).map { offset -> ScheduleDay in
            let date = calendar.date(byAdding: .day, value: offset, to: start) ?? start
            let dateLocal = localDateString(date, calendar: calendar)
            return ScheduleDay(
                date: date,
                dateLocal: dateLocal,
                entries: entries.filter { $0.dateLocal == dateLocal },
                conflicts: conflicts.filter { item in
                    openConflicts.first(where: { $0.id == item.id })?.value.dateLocal == dateLocal
                }
            )
        }
        let sweeps = sweepRows.rows.map(\.data)
        let successful = sweeps.first { $0.overall == "success" }?.finishedAt.flatMap(isoDate)
        let patterns = patternRows.rows.compactMap { row -> SchedulePattern? in
            guard let kind = scheduleKind(row.data.kind),
                  let effectiveFrom = localDate(row.data.effectiveFrom, calendar: calendar) else { return nil }
            let payload = jsonObject(row.data.payloadJSON)
            return SchedulePattern(
                id: row.id,
                kind: kind,
                childID: row.data.childID,
                title: stringValue(payload, key: kind == .work ? "source_label" : "location_label") ?? kind.label,
                notes: stringValue(payload, key: "notes") ?? "",
                weekdays: row.data.byweekday.compactMap(EqualPathWeekday.init(backendCode:)),
                startMinute: row.data.startMinute,
                endMinute: row.data.endMinute,
                effectiveFrom: effectiveFrom,
                effectiveUntil: row.data.effectiveUntil.flatMap { localDate($0, calendar: calendar) },
                locationMode: stringValue(payload, key: "location_mode") ?? "office",
                remotePossible: boolValue(payload, key: "remote_possible") ?? false,
                priority: stringValue(payload, key: "priority") ?? "fixed",
                collectByMinute: intValue(payload, key: "collect_by_minute"),
                handoverInRef: stringValue(payload, key: "handover_in_ref"),
                handoverOutRef: stringValue(payload, key: "handover_out_ref"),
                active: row.data.active ?? true
            )
        }
        return WeekSchedule(
            startDate: start,
            endDate: end,
            days: days,
            children: children,
            lastSuccessfulSweepAt: successful,
            latestSweepError: latestSweepError(from: sweeps),
            patterns: patterns,
            handoverPeople: handoverPeople,
            travelTimes: TravelTimes(
                homeToCareMinutes: settings?.travelHomeCareMinutes,
                careToWorkMinutes: settings?.travelCareWorkMinutes,
                homeToWorkMinutes: settings?.travelHomeWorkMinutes
            )
        )
    }

    func saveScheduleEntry(_ draft: ScheduleEntryDraft) async throws -> ScheduleSaveResult {
        guard try await currentUser() != nil else { throw EqualPathServiceError.notSignedIn }
        if draft.kind == .careCoverage {
            guard let travelHomeCareMinutes = draft.travelHomeCareMinutes,
                  let travelCareWorkMinutes = draft.travelCareWorkMinutes,
                  let travelHomeWorkMinutes = draft.travelHomeWorkMinutes else {
                throw EqualPathServiceError.backend("Enter all three travel times.")
            }
            _ = try await execute(
                functionID: Config.coreFunctionID,
                payload: [
                    "action": "update_profile",
                    "data": [
                        "travel_home_care_min": travelHomeCareMinutes,
                        "travel_care_work_min": travelCareWorkMinutes,
                        "travel_home_work_min": travelHomeWorkMinutes
                    ]
                ]
            )
        }
        if draft.repeatWeekly {
            return try await saveSchedulePattern(draft)
        }
        let calendar = Calendar(identifier: .gregorian)
        let dateLocal = localDateString(draft.date, calendar: calendar)
        let baseID = draft.id ?? manualRowID()
        let spanGroup = draft.spanGroup ?? manualRowID(prefix: "s")
        let parts: [(id: String, dateLocal: String, start: Int, end: Int, part: Int)]
        if draft.endMinute > draft.startMinute {
            parts = [(baseID, dateLocal, draft.startMinute, draft.endMinute, 0)]
        } else {
            let next = calendar.date(byAdding: .day, value: 1, to: draft.date) ?? draft.date
            parts = [
                (baseID, dateLocal, draft.startMinute, 1440, 0),
                (crossMidnightRowID(baseID), localDateString(next, calendar: calendar), 0, draft.endMinute, 1)
            ]
        }

        for part in parts {
            var data: [String: Any] = [
                "date_local": part.dateLocal,
                "start_minute": part.start,
                "end_minute": part.end,
                "span_group": spanGroup,
                "span_part": part.part,
                "status": "active"
            ]
            let tableID: String
            switch draft.kind {
            case .work:
                tableID = "work_commitments"
                data.merge([
                    "commitment_type": draft.title,
                    "location_mode": draft.locationMode,
                    "remote_possible": draft.remotePossible,
                    "flexibility_level": draft.priority == "fixed" ? "fixed" : "flexible",
                    "priority": draft.priority,
                    "source_label": draft.title
                ]) { _, new in new }
            case .careRequired, .careCoverage:
                guard let childID = draft.childID else {
                    throw EqualPathServiceError.backend("Choose a child for this care record.")
                }
                tableID = "care_commitments"
                let sources = [draft.title, draft.notes].filter { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                var careData: [String: Any] = [
                    "child_id": childID,
                    "entry_kind": draft.kind == .careRequired ? "required" : "coverage",
                    "resource_type": draft.kind == .careCoverage ? "provider_or_carer" : "requirement",
                    "location_label": draft.title,
                    "band_state": "covered",
                    "source_records": sources
                ]
                if draft.kind == .careCoverage {
                    careData["collect_by_minute"] = min(part.end, draft.collectByMinute ?? part.end)
                    careData["handover_in_ref"] = draft.handoverInRef ?? ""
                    careData["handover_out_ref"] = draft.handoverOutRef ?? ""
                }
                data.merge(careData) { _, new in new }
            }
            _ = try await execute(
                functionID: Config.coreFunctionID,
                payload: [
                    "action": "save_row",
                    "table_id": tableID,
                    "row_id": part.id,
                    "data": data
                ]
            )
        }
        if draft.id != nil, draft.spanGroup != nil {
            _ = try await execute(
                functionID: Config.coreFunctionID,
                payload: [
                    "action": "prune_schedule_span",
                    "table_id": draft.kind == .work ? "work_commitments" : "care_commitments",
                    "span_group": spanGroup,
                    "keep_row_ids": parts.map { $0.id }
                ]
            )
        }
        return ScheduleSaveResult()
    }

    func deleteScheduleEntry(_ entry: ScheduleEntry) async throws {
        _ = try await execute(
            functionID: Config.coreFunctionID,
            payload: [
                "action": "delete_row",
                "table_id": entry.kind == .work ? "work_commitments" : "care_commitments",
                "row_id": entry.id
            ]
        )
    }

    func deleteSchedulePattern(_ patternID: String) async throws -> ScheduleSaveResult {
        let response = try await execute(
            functionID: Config.coreFunctionID,
            payload: [
                "action": "delete_row",
                "table_id": "schedule_patterns",
                "row_id": patternID
            ]
        )
        return ScheduleSaveResult(preservedOverrideCount: response.preservedOverrides ?? 0)
    }

    private func saveSchedulePattern(_ draft: ScheduleEntryDraft) async throws -> ScheduleSaveResult {
        let calendar = Calendar(identifier: .gregorian)
        var payload: [String: Any] = [
            "source_label": draft.title,
            "notes": draft.notes
        ]
        switch draft.kind {
        case .work:
            payload.merge([
                "commitment_type": draft.title,
                "location_mode": draft.locationMode,
                "remote_possible": draft.remotePossible,
                "flexibility_level": draft.priority == "fixed" ? "fixed" : "flexible",
                "priority": draft.priority
            ]) { _, new in new }
        case .careRequired:
            payload.merge([
                "location_label": draft.title,
                "resource_type": "requirement",
                "band_state": "covered"
            ]) { _, new in new }
        case .careCoverage:
            payload.merge([
                "location_label": draft.title,
                "resource_type": "provider_or_carer",
                "collect_by_minute": draft.collectByMinute ?? draft.endMinute,
                "handover_in_ref": draft.handoverInRef ?? "",
                "handover_out_ref": draft.handoverOutRef ?? "",
                "band_state": "covered"
            ]) { _, new in new }
        }
        let payloadData = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
        guard let payloadString = String(data: payloadData, encoding: .utf8) else {
            throw EqualPathServiceError.invalidResponse
        }
        var data: [String: Any] = [
            "kind": draft.kind == .work ? "work" : draft.kind == .careRequired ? "care_required" : "care_coverage",
            "byweekday": draft.weekdays.map(\.backendCode),
            "start_minute": draft.startMinute,
            "end_minute": draft.endMinute,
            "effective_from": localDateString(draft.effectiveFrom, calendar: calendar),
            "payload_json": payloadString,
            "active": true
        ]
        if draft.kind != .work { data["child_id"] = draft.childID ?? "" }
        data["effective_until"] = draft.effectiveUntil.map { localDateString($0, calendar: calendar) } ?? NSNull()
        let response = try await execute(
            functionID: Config.coreFunctionID,
            payload: [
                "action": "save_row",
                "table_id": "schedule_patterns",
                "row_id": draft.patternID ?? manualRowID(prefix: "p"),
                "data": data
            ]
        )
        return ScheduleSaveResult(preservedOverrideCount: response.preservedOverrides ?? 0)
    }

    func localNotificationPlans() async throws -> [LocalNotificationPlan] {
        guard let user = try await currentUser() else {
            throw EqualPathServiceError.notSignedIn
        }
        let settingsRow = try await tablesDB.getRow(
            databaseId: Config.databaseID,
            tableId: "users",
            rowId: user.id,
            nestedType: NotificationSettings.self
        )
        let settings = settingsRow.data
        guard settings.alertGap != false else { return [] }

        let timezoneIdentifier = settings.timezone ?? "Asia/Kuala_Lumpur"
        let (firstDate, lastDate) = reminderDateRange(timezoneIdentifier: timezoneIdentifier)
        let rows = try await tablesDB.listRows(
            databaseId: Config.databaseID,
            tableId: "conflicts",
            queries: [
                Query.equal("user_id", value: user.id),
                Query.equal("status", value: "open"),
                Query.limit(100)
            ],
            total: false,
            nestedType: ConflictRecord.self
        )
        let relevant = rows.rows
            .map(\.data)
            .filter { $0.dateLocal >= firstDate && $0.dateLocal <= lastDate }

        return Dictionary(grouping: relevant, by: \.dateLocal)
            .map { dateLocal, conflicts in
                LocalNotificationPlan(
                    dateLocal: dateLocal,
                    notifyHour: settings.notifyHour ?? 21,
                    timezoneIdentifier: timezoneIdentifier,
                    uncoveredMinutes: conflicts
                        .filter { $0.state == "uncovered" }
                        .reduce(0) { $0 + $1.durationMinutes },
                    needsVerification: conflicts.contains { $0.state == "unknown" }
                )
            }
            .sorted { $0.dateLocal < $1.dateLocal }
    }

    func logout() async throws {
        _ = try await account.deleteSession(sessionId: "current")
    }

    func deleteAccount() async throws {
        _ = try await execute(
            functionID: Config.deleteFunctionID,
            payload: ["confirm": "DELETE"]
        )
    }

    private func execute(functionID: String, payload: [String: Any]) async throws -> FunctionResponse {
        let data = try JSONSerialization.data(withJSONObject: payload)
        let body = String(decoding: data, as: UTF8.self)
        let execution = try await functions.createExecution(
            functionId: functionID,
            body: body,
            async: false
        )
        guard let responseData = execution.responseBody.data(using: .utf8),
              let response = try? JSONDecoder().decode(FunctionResponse.self, from: responseData) else {
            throw EqualPathServiceError.invalidResponse
        }
        guard (200..<300).contains(execution.responseStatusCode), response.ok else {
            throw EqualPathServiceError.backend(response.error ?? "EqualPath could not save this change.")
        }
        return response
    }

    private func stableID(userID: String, kind: String, index: Int) -> String {
        let prefix = userID.filter { $0.isLetter || $0.isNumber }.prefix(16)
        return "ep_\(prefix)_\(kind.prefix(8))_\(index)"
    }

    private func jsonEscaped(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
    }

    private func coverageSummary(
        conflicts: [ConflictRecord],
        requiredIntervals: [(Int, Int)],
        checkedAt: Date,
        stale: Bool,
        childSummaries: [CoverageSummary]? = nil
    ) -> CoverageSummary {
        let state: CoverageState
        if conflicts.contains(where: { $0.state == "uncovered" }) {
            state = .uncovered
        } else if conflicts.contains(where: { $0.state == "unknown" }) {
            state = .unknown
        } else {
            state = .noGap
        }

        let relevantIntervals = conflicts
            .filter { state == .uncovered ? $0.state == "uncovered" : $0.state == "unknown" }
            .map { ($0.startMinute, $0.endMinute) }
        let gapMinutes: Int
        if let childSummaries {
            gapMinutes = Int(childSummaries
                .filter { $0.state == state }
                .reduce(0.0) { $0 + $1.gapHours * 60 })
        } else {
            gapMinutes = mergedDuration(relevantIntervals)
        }
        let rangeIntervals = relevantIntervals.isEmpty ? requiredIntervals : relevantIntervals
        let start = rangeIntervals.map(\.0).min() ?? 0
        let end = rangeIntervals.map(\.1).max() ?? start
        let requiredMinutes = mergedDuration(requiredIntervals)
        let spanMinutes = max(requiredMinutes, end - start)

        return CoverageSummary(
            state: state,
            gapHours: Double(gapMinutes) / 60,
            spanHours: Double(spanMinutes) / 60,
            startMinute: start,
            endMinute: end,
            checkedAt: checkedAt,
            isStale: stale
        )
    }

    private func mergedDuration(_ intervals: [(Int, Int)]) -> Int {
        let sorted = intervals
            .filter { $0.1 > $0.0 }
            .sorted { $0.0 == $1.0 ? $0.1 < $1.1 : $0.0 < $1.0 }
        guard var current = sorted.first else { return 0 }
        var total = 0
        for interval in sorted.dropFirst() {
            if interval.0 <= current.1 {
                current.1 = max(current.1, interval.1)
            } else {
                total += current.1 - current.0
                current = interval
            }
        }
        return total + current.1 - current.0
    }

    private func sourceRecords(from values: [String]) -> [SourceRecord] {
        var seen = Set<String>()
        return values.compactMap { raw -> SourceRecord? in
            let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !value.isEmpty, seen.insert(value).inserted else { return nil }
            let lower = value.lowercased()
            let icon: String
            let detail: String
            if lower.contains("travel") || lower.contains("arrival") {
                icon = "car"
                detail = "Travel used in the handover check"
            } else if lower.contains("work") || lower.contains("office") || lower.contains("home") {
                icon = "briefcase"
                detail = "Work commitment"
            } else if lower.contains("care") || lower.contains("registered") || lower.contains("provider") || lower.contains("taska") {
                icon = "building.2"
                detail = "Care record"
            } else {
                icon = "doc.text"
                detail = "Source record"
            }
            return SourceRecord(id: value, icon: icon, title: value, detail: detail)
        }
    }

    private func conflictItems(
        rows: [(id: String, value: ConflictRecord)],
        childNames: [String: String]
    ) -> [ConflictItem] {
        rows.map { row in
            ConflictItem(
                id: row.id,
                childID: row.value.childID,
                childName: childNames[row.value.childID] ?? "Child",
                state: row.value.state == "unknown" ? .unknown : .uncovered,
                kind: row.value.kind,
                priority: row.value.priority,
                startMinute: row.value.startMinute,
                endMinute: row.value.endMinute,
                durationMinutes: row.value.durationMinutes,
                sourceRecords: row.value.sourceRecords
            )
        }.sorted {
            let ranks = ["high": 0, "normal": 1, "review": 2]
            let left = ranks[$0.priority] ?? 9
            let right = ranks[$1.priority] ?? 9
            if left != right { return left < right }
            if $0.startMinute != $1.startMinute { return $0.startMinute < $1.startMinute }
            return $0.id < $1.id
        }
    }

    private func latestSweepError(from sweeps: [SweepRecord]) -> String? {
        guard let latest = sweeps.first, latest.overall == "failed" else { return nil }
        let code = latest.errorCode?.nilIfEmpty ?? "recalculation_failed"
        return "The latest conflict check failed (\(code)). The last verified result is still shown."
    }

    private func scheduleEntryOrder(_ left: ScheduleEntry, _ right: ScheduleEntry) -> Bool {
        if left.dateLocal != right.dateLocal { return left.dateLocal < right.dateLocal }
        if left.startMinute != right.startMinute { return left.startMinute < right.startMinute }
        if left.kind.rawValue != right.kind.rawValue { return left.kind.rawValue < right.kind.rawValue }
        return left.id < right.id
    }

    private func timelineRecords(
        featuredChildID: String?,
        featuredChildName: String?,
        conflicts: [ConflictRecord],
        care: [(id: String, value: CareCommitmentRecord)],
        work: [(id: String, value: WorkCommitmentRecord)]
    ) -> [TimelineRecord] {
        let careRecords = care.compactMap { row -> TimelineRecord? in
            guard row.value.childID == featuredChildID else { return nil }
            let isRequired = row.value.entryKind == "required"
            return TimelineRecord(
                id: "care-\(row.id)",
                kind: row.value.bandState == "unknown" ? .unknown : isRequired ? .careRequired : .careCoverage,
                title: row.value.locationLabel?.nilIfEmpty ?? (isRequired ? "Care needed" : "Registered care"),
                detail: row.value.sourceRecords?.first ?? (isRequired ? "Required care" : "Care coverage"),
                startMinute: row.value.startMinute,
                endMinute: isRequired ? row.value.endMinute : row.value.collectByMinute ?? row.value.endMinute
            )
        }
        let workRecords = work.map { row in
            TimelineRecord(
                id: "work-\(row.id)",
                kind: .work,
                title: row.value.sourceLabel?.nilIfEmpty ?? "Work commitment",
                detail: [row.value.locationMode, row.value.priority].compactMap { $0?.nilIfEmpty }.joined(separator: " · "),
                startMinute: row.value.startMinute,
                endMinute: row.value.endMinute
            )
        }
        let conflictRecords = conflicts.map { conflict in
            TimelineRecord(
                id: "conflict-\(conflict.childID)-\(conflict.startMinute)-\(conflict.endMinute)-\(conflict.kind)",
                kind: conflict.state == "unknown" ? .unknown : .uncovered,
                title: conflict.state == "unknown" ? "Needs verification" : "\(featuredChildName ?? "Child") needs cover",
                detail: conflict.sourceRecords.first ?? conflict.kind,
                startMinute: conflict.startMinute,
                endMinute: conflict.endMinute
            )
        }
        return (careRecords + workRecords + conflictRecords).sorted {
            $0.startMinute == $1.startMinute ? $0.kind.rawValue < $1.kind.rawValue : $0.startMinute < $1.startMinute
        }
    }

    private func localTomorrow(timezoneIdentifier: String) -> (date: Date, dateString: String) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timezoneIdentifier) ?? .current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: .now) ?? .now
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return (tomorrow, formatter.string(from: tomorrow))
    }

    private func localDateString(_ date: Date, calendar: Calendar) -> String {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private func localDate(_ value: String, calendar: Calendar) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }

    private func scheduleKind(_ rawValue: String) -> ScheduleEntryKind? {
        switch rawValue {
        case "work": .work
        case "care_required": .careRequired
        case "care_coverage": .careCoverage
        default: nil
        }
    }

    private func jsonObject(_ value: String?) -> [String: Any] {
        guard let value,
              let data = value.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return object
    }

    private func stringValue(_ object: [String: Any], key: String) -> String? {
        (object[key] as? String)?.nilIfEmpty
    }

    private func intValue(_ object: [String: Any], key: String) -> Int? {
        (object[key] as? NSNumber)?.intValue
    }

    private func boolValue(_ object: [String: Any], key: String) -> Bool? {
        (object[key] as? NSNumber)?.boolValue
    }

    private func manualRowID(prefix: String = "m") -> String {
        "\(prefix)_\(UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased())"
    }

    private func crossMidnightRowID(_ base: String) -> String {
        "\(base.prefix(33))_x"
    }

    private func isoDate(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private func reminderDateRange(timezoneIdentifier: String) -> (String, String) {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: timezoneIdentifier) ?? .current
        let now = Date()
        let first = calendar.date(byAdding: .day, value: 1, to: now) ?? now
        let last = calendar.date(byAdding: .day, value: 14, to: now) ?? first
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return (formatter.string(from: first), formatter.string(from: last))
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
