import SwiftUI

struct OfflineBanner: View {
    @ObservedObject private var offlineManager = OfflineManager.shared

    var body: some View {
        if !offlineManager.isOnline {
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .foregroundColor(DesignSystem.Colors.textInverse)
                Text("Offline mode: changes will sync when you're back online")
                    .font(DesignSystem.Typography.caption1)
                    .foregroundColor(DesignSystem.Colors.textInverse)
            }
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(DesignSystem.Colors.accent)
        }
    }
}
