import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Bug, Flag, Camera, History, ChevronDown, ChevronRight, Trash2, RotateCcw, Plus, Layers, Shield, Zap } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Spacing, BorderRadius, FontSize, FontWeight } from '@/constants/theme';
import { versionString, APP_VERSION, APP_COMPONENTS } from '@/constants/versionManifest';
import { useFeatureFlags, StabilityChannel } from '@/providers/FeatureFlagsProvider';
import { useSnapshots } from '@/providers/SnapshotProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DevToolsPanelProps {
  visible: boolean;
  onClose: () => void;
}

type TabKey = 'flags' | 'snapshots' | 'changelog' | 'info';

export default function DevToolsPanel({ visible, onClose }: DevToolsPanelProps) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabKey>('flags');
  const [newSnapName, setNewSnapName] = useState<string>('');
  const [newSnapDesc, setNewSnapDesc] = useState<string>('');
  const [showCreateSnap, setShowCreateSnap] = useState<boolean>(false);
  const [expandedSnap, setExpandedSnap] = useState<string | null>(null);

  const {
    isEnabled,
    setFlag,
    resetFlag,
    resetAllFlags,
    channel,
    setChannel,
    overrides,
    resolved,
    flagDefinitions,
  } = useFeatureFlags();

  const {
    snapshots,
    changelog,
    createSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    flagDiffBetween,
  } = useSnapshots();

  const handleCreateSnapshot = useCallback(async () => {
    if (!newSnapName.trim()) return;
    await createSnapshot(
      newSnapName.trim(),
      newSnapDesc.trim() || 'Manual snapshot',
      [...APP_COMPONENTS]
    );
    setNewSnapName('');
    setNewSnapDesc('');
    setShowCreateSnap(false);
  }, [newSnapName, newSnapDesc, createSnapshot]);

  const handleRestoreSnapshot = useCallback(async (id: string) => {
    await restoreSnapshot(id);
  }, [restoreSnapshot]);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'flags', label: 'Flags', icon: <Flag size={14} color={activeTab === 'flags' ? Colors.primary : Colors.textMuted} /> },
    { key: 'snapshots', label: 'Snapshots', icon: <Camera size={14} color={activeTab === 'snapshots' ? Colors.primary : Colors.textMuted} /> },
    { key: 'changelog', label: 'Changes', icon: <History size={14} color={activeTab === 'changelog' ? Colors.primary : Colors.textMuted} /> },
    { key: 'info', label: 'Info', icon: <Bug size={14} color={activeTab === 'info' ? Colors.primary : Colors.textMuted} /> },
  ];

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const renderFlagsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.channelSection}>
        <Text style={styles.sectionTitle}>Stability Channel</Text>
        <View style={styles.channelToggle}>
          <TouchableOpacity
            style={[styles.channelBtn, channel === 'stable' && styles.channelBtnActive]}
            onPress={() => setChannel('stable')}
          >
            <Shield size={14} color={channel === 'stable' ? Colors.white : Colors.textMuted} />
            <Text style={[styles.channelBtnText, channel === 'stable' && styles.channelBtnTextActive]}>
              Stable
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.channelBtn, channel === 'experimental' && styles.channelBtnActiveExp]}
            onPress={() => setChannel('experimental')}
          >
            <Zap size={14} color={channel === 'experimental' ? Colors.white : Colors.textMuted} />
            <Text style={[styles.channelBtnText, channel === 'experimental' && styles.channelBtnTextActive]}>
              Experimental
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.channelHint}>
          {channel === 'stable'
            ? 'Only stable features enabled. Experimental flags are off unless manually overridden.'
            : 'All features available. Experimental flags use their defaults.'}
        </Text>
      </View>

      <View style={styles.flagsHeader}>
        <Text style={styles.sectionTitle}>Feature Flags</Text>
        <TouchableOpacity onPress={resetAllFlags} style={styles.resetBtn}>
          <RotateCcw size={12} color={Colors.warning} />
          <Text style={styles.resetBtnText}>Reset All</Text>
        </TouchableOpacity>
      </View>

      {flagDefinitions.map((flag) => {
        const isOn = resolved[flag.key] ?? false;
        const hasOverride = flag.key in overrides;
        return (
          <View key={flag.key} style={styles.flagRow}>
            <View style={styles.flagInfo}>
              <View style={styles.flagLabelRow}>
                <Text style={styles.flagLabel}>{flag.label}</Text>
                <View style={[styles.channelBadge, flag.channel === 'experimental' ? styles.expBadge : styles.stableBadge]}>
                  <Text style={styles.channelBadgeText}>{flag.channel}</Text>
                </View>
                {hasOverride && (
                  <TouchableOpacity onPress={() => resetFlag(flag.key)} style={styles.overrideBadge}>
                    <Text style={styles.overrideBadgeText}>override</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.flagDesc}>{flag.description}</Text>
            </View>
            <Switch
              value={isOn}
              onValueChange={(val) => setFlag(flag.key, val)}
              trackColor={{ false: Colors.surfaceLight, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderSnapshotsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.createSnapBtn}
        onPress={() => setShowCreateSnap(!showCreateSnap)}
      >
        <Plus size={16} color={Colors.primary} />
        <Text style={styles.createSnapBtnText}>Create Snapshot</Text>
      </TouchableOpacity>

      {showCreateSnap && (
        <View style={styles.createSnapForm}>
          <TextInput
            style={styles.snapInput}
            placeholder="Snapshot name"
            placeholderTextColor={Colors.textMuted}
            value={newSnapName}
            onChangeText={setNewSnapName}
          />
          <TextInput
            style={[styles.snapInput, styles.snapDescInput]}
            placeholder="Description (optional)"
            placeholderTextColor={Colors.textMuted}
            value={newSnapDesc}
            onChangeText={setNewSnapDesc}
            multiline
          />
          <TouchableOpacity
            style={[styles.snapSaveBtn, !newSnapName.trim() && styles.snapSaveBtnDisabled]}
            onPress={handleCreateSnapshot}
            disabled={!newSnapName.trim()}
          >
            <Text style={styles.snapSaveBtnText}>Save Snapshot</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.snapshotNotice}>
        <Text style={styles.snapshotNoticeText}>
          Snapshots save flag overrides and channel state only. They do not revert code or UI changes.
        </Text>
      </View>

      {snapshots.length === 0 && (
        <View style={styles.emptyState}>
          <Camera size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No snapshots yet</Text>
          <Text style={styles.emptySubtext}>Create a snapshot before making changes</Text>
        </View>
      )}

      {snapshots.map((snap, idx) => {
        const isExpanded = expandedSnap === snap.id;
        const prevSnap = idx < snapshots.length - 1 ? snapshots[idx + 1] : null;
        const flagDiffs = prevSnap ? flagDiffBetween(prevSnap.id, snap.id) : null;

        return (
          <View key={snap.id} style={styles.snapCard}>
            <TouchableOpacity
              style={styles.snapHeader}
              onPress={() => setExpandedSnap(isExpanded ? null : snap.id)}
            >
              <View style={styles.snapHeaderLeft}>
                {isExpanded
                  ? <ChevronDown size={14} color={Colors.textMuted} />
                  : <ChevronRight size={14} color={Colors.textMuted} />}
                <View>
                  <Text style={styles.snapName}>{snap.name}</Text>
                  <Text style={styles.snapTime}>{formatTime(snap.timestamp)}</Text>
                </View>
              </View>
              <View style={[styles.channelBadge, snap.channel === 'experimental' ? styles.expBadge : styles.stableBadge]}>
                <Text style={styles.channelBadgeText}>{snap.channel}</Text>
              </View>
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.snapDetails}>
                <Text style={styles.snapDescText}>{snap.description}</Text>
                <Text style={styles.snapMetaText}>
                  {snap.components.length} components tracked
                </Text>

                {flagDiffs && flagDiffs.length > 0 && (
                  <View style={styles.diffSection}>
                    <Text style={styles.diffTitle}>Flag changes from previous:</Text>
                    {flagDiffs.map(d => (
                      <Text key={d.key} style={styles.diffLine}>
                        {d.key}: {d.before ? 'ON' : 'OFF'} → {d.after ? 'ON' : 'OFF'}
                      </Text>
                    ))}
                  </View>
                )}

                <View style={styles.snapActions}>
                  <TouchableOpacity
                    style={styles.snapActionBtn}
                    onPress={() => handleRestoreSnapshot(snap.id)}
                  >
                    <RotateCcw size={13} color={Colors.primary} />
                    <Text style={styles.snapActionText}>Restore</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.snapActionBtn}
                    onPress={() => deleteSnapshot(snap.id)}
                  >
                    <Trash2 size={13} color={Colors.negative} />
                    <Text style={[styles.snapActionText, { color: Colors.negative }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderChangelogTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {changelog.length === 0 && (
        <View style={styles.emptyState}>
          <History size={32} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No changes tracked yet</Text>
          <Text style={styles.emptySubtext}>Changes will appear here as you iterate</Text>
        </View>
      )}

      {changelog.map((entry, idx) => (
        <View key={`${entry.timestamp}_${idx}`} style={styles.changeCard}>
          <Text style={styles.changeTime}>{formatTime(entry.timestamp)}</Text>
          <Text style={styles.changeSummary}>{entry.summary}</Text>
          {entry.filesModified.length > 0 && (
            <Text style={styles.changeFiles}>
              {entry.filesModified.length} file{entry.filesModified.length > 1 ? 's' : ''} affected
            </Text>
          )}
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderInfoTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>App Version</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>{versionString()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Build Date</Text>
          <Text style={styles.infoValue}>{APP_VERSION.buildDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Channel</Text>
          <Text style={[styles.infoValue, { color: channel === 'experimental' ? Colors.warning : Colors.positive }]}>
            {channel}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Platform</Text>
          <Text style={styles.infoValue}>{Platform.OS}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Data Sources</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Backend URL</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {process.env.EXPO_PUBLIC_NBA_API_URL || 'Not configured'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mode</Text>
          <Text style={styles.infoValue}>
            {process.env.EXPO_PUBLIC_NBA_API_URL ? 'Hybrid' : 'Direct CDN'}
          </Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Tracked Components ({APP_COMPONENTS.length})</Text>
        {APP_COMPONENTS.map(c => (
          <Text key={c} style={styles.componentPath}>{c}</Text>
        ))}
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Active Flags</Text>
        {Object.entries(resolved)
          .filter(([_, v]) => v)
          .map(([k]) => (
            <Text key={k} style={styles.activeFlagText}>{k}</Text>
          ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Layers size={18} color={Colors.primary} />
            <Text style={styles.headerTitle}>Dev Tools</Text>
            <View style={[styles.versionBadge]}>
              <Text style={styles.versionText}>{versionString()}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'flags' && renderFlagsTab()}
        {activeTab === 'snapshots' && renderSnapshotsTab()}
        {activeTab === 'changelog' && renderChangelogTab()}
        {activeTab === 'info' && renderInfoTab()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    color: Colors.textPrimary,
  },
  versionBadge: {
    backgroundColor: Colors.primaryMuted,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  versionText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: FontWeight.medium,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  channelSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  channelToggle: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  channelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  channelBtnActive: {
    backgroundColor: Colors.positive,
    borderColor: Colors.positive,
  },
  channelBtnActiveExp: {
    backgroundColor: Colors.warning,
    borderColor: Colors.warning,
  },
  channelBtnText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textMuted,
  },
  channelBtnTextActive: {
    color: Colors.white,
  },
  channelHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    lineHeight: 16,
  },
  flagsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.warningMuted,
  },
  resetBtnText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: FontWeight.medium,
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  flagInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  flagLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  flagLabel: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    color: Colors.textPrimary,
  },
  flagDesc: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  channelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  stableBadge: {
    backgroundColor: Colors.positiveMuted,
  },
  expBadge: {
    backgroundColor: Colors.warningMuted,
  },
  channelBadgeText: {
    fontSize: 9,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
  },
  overrideBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accentMuted,
  },
  overrideBadgeText: {
    fontSize: 9,
    color: Colors.accent,
    fontWeight: FontWeight.medium,
  },
  createSnapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  createSnapBtnText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  createSnapForm: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  snapInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  snapDescInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  snapSaveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  snapSaveBtnDisabled: {
    opacity: 0.4,
  },
  snapSaveBtnText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.white,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  snapCard: {
    marginTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  snapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  snapHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  snapName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    color: Colors.textPrimary,
  },
  snapTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  snapDetails: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
  },
  snapDescText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  snapMetaText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  diffSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  diffTitle: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: FontWeight.semibold,
    marginBottom: 4,
  },
  diffLine: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 18,
  },
  snapActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  snapActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  snapActionText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: FontWeight.medium,
  },
  changeCard: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  changeTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  changeSummary: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
  },
  changeFiles: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  infoSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  infoLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  infoValue: {
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: FontWeight.medium,
    maxWidth: '60%' as unknown as number,
  },
  componentPath: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingVertical: 2,
    lineHeight: 18,
  },
  activeFlagText: {
    fontSize: FontSize.sm,
    color: Colors.positive,
    paddingVertical: 2,
  },
  snapshotNotice: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.warningMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  snapshotNoticeText: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    lineHeight: 16,
    fontWeight: FontWeight.medium,
  },
});
