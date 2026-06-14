import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Dialog, Divider, List, Portal, Switch, TextInput } from 'react-native-paper';
import { colors, spacing } from '../../constants/theme';
import { isFirebaseConfigured, getFirebaseConfigErrorMessage } from '../../constants/env';
import { useMockApp } from '../../context/MockAppContext';
import { AppScreen } from '../../components/AppScreen';
import { AppHeader } from '../../components/AppHeader';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    user,
    notificationsEnabled,
    setNotificationsEnabled,
    tempUnit,
    setTempUnit,
    tdsUnit,
    setTdsUnit,
    themePref,
    setThemePref,
    cctvCameras,
    addCctvCamera,
    updateCctvCamera,
    removeCctvCamera,
    logout,
    firebaseRtdbConnected,
  } = useMockApp();
  const [cameraDialogVisible, setCameraDialogVisible] = useState(false);
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);
  const [cameraName, setCameraName] = useState('');
  const [cameraUrl, setCameraUrl] = useState('');
  const [cameraLocation, setCameraLocation] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [removeCameraId, setRemoveCameraId] = useState<string | null>(null);
  const removeCamera = cctvCameras.find((camera) => camera.id === removeCameraId);

  const openAddCamera = () => {
    console.log('[CCTV Settings] open add camera dialog');
    setEditingCameraId(null);
    setCameraName('');
    setCameraUrl('');
    setCameraLocation('');
    setCameraError(null);
    setCameraDialogVisible(true);
  };

  const openEditCamera = (cameraId: string) => {
    const camera = cctvCameras.find((item) => item.id === cameraId);
    if (!camera) {
      console.warn('[CCTV Settings] edit requested for missing camera', { cameraId });
      return;
    }
    console.log('[CCTV Settings] open edit camera dialog', {
      cameraId: camera.id,
      name: camera.name,
      url: camera.streamUrl,
    });
    setEditingCameraId(camera.id);
    setCameraName(camera.name);
    setCameraUrl(camera.streamUrl);
    setCameraLocation(camera.location ?? '');
    setCameraError(null);
    setCameraDialogVisible(true);
  };

  const closeCameraDialog = () => {
    console.log('[CCTV Settings] close camera dialog');
    setCameraDialogVisible(false);
    setCameraError(null);
  };

  const saveCamera = async () => {
    const name = cameraName.trim();
    const streamUrl = cameraUrl.trim();
    console.log('[CCTV Settings] save camera requested', {
      editingCameraId,
      name,
      streamUrl,
      location: cameraLocation.trim(),
    });
    if (!streamUrl) {
      console.warn('[CCTV Settings] save blocked: missing URL');
      setCameraError('Camera URL is required.');
      return;
    }
    if (!/^https?:\/\//i.test(streamUrl)) {
      console.warn('[CCTV Settings] save blocked: invalid URL protocol', { streamUrl });
      setCameraError('Use an HTTP or HTTPS camera URL.');
      return;
    }
    const payload = {
      name: name || `Camera ${cctvCameras.length + 1}`,
      streamUrl,
      location: cameraLocation.trim() || undefined,
    };
    if (editingCameraId) {
      await updateCctvCamera(editingCameraId, payload);
      console.log('[CCTV Settings] camera updated', { cameraId: editingCameraId, ...payload });
    } else {
      await addCctvCamera(payload);
      console.log('[CCTV Settings] camera added', payload);
    }
    closeCameraDialog();
  };

  const deleteEditingCamera = async () => {
    if (!editingCameraId) return;
    console.log('[CCTV Settings] delete camera requested', { cameraId: editingCameraId });
    await removeCctvCamera(editingCameraId);
    closeCameraDialog();
  };

  const openRemoveCamera = (cameraId: string) => {
    const camera = cctvCameras.find((item) => item.id === cameraId);
    console.log('[CCTV Settings] open remove camera confirm', {
      cameraId,
      name: camera?.name,
      url: camera?.streamUrl,
    });
    setRemoveCameraId(cameraId);
  };

  const runRemoveCamera = async () => {
    if (!removeCameraId) return;
    console.log('[CCTV Settings] remove camera confirmed', { cameraId: removeCameraId });
    await removeCctvCamera(removeCameraId);
    setRemoveCameraId(null);
  };

  return (
    <AppScreen contentStyle={{ paddingBottom: spacing.xxl }}>
      <AppHeader title="Settings" subtitle="Preferences and account" />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Account</List.Subheader>
        <List.Item title="Name" titleStyle={{ fontWeight: '700' }} description={user.firstName} descriptionStyle={{ color: colors.mutedStrong }} />
        <List.Item title="Email" titleStyle={{ fontWeight: '700' }} description={user.email} descriptionStyle={{ color: colors.mutedStrong }} />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Ponds & devices</List.Subheader>
        <List.Item title="Ponds" titleStyle={{ fontWeight: '700' }} description="Manage pond workspaces" onPress={() => router.push('/(tabs)/ponds')} />
        <List.Item title="Devices" titleStyle={{ fontWeight: '700' }} description="Roles, parents, diagnostics" onPress={() => router.push('/(tabs)/devices')} />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>CCTV</List.Subheader>
        <List.Item
          title="Add CCTV camera"
          titleStyle={{ fontWeight: '700' }}
          description="Use an HTTP/HTTPS camera page, snapshot, or MJPEG feed"
          descriptionStyle={{ color: colors.mutedStrong }}
          onPress={openAddCamera}
        />
        {cctvCameras.length === 0 ? (
          <List.Item
            title="No CCTV cameras configured"
            titleStyle={{ fontWeight: '700', color: colors.mutedStrong }}
            description="Dashboard will keep showing the default vector background"
            descriptionStyle={{ color: colors.mutedStrong }}
          />
        ) : (
          cctvCameras.map((camera) => (
            <List.Item
              key={camera.id}
              title={camera.name}
              titleStyle={{ fontWeight: '700' }}
              description={camera.location ? `${camera.location} - ${camera.streamUrl}` : camera.streamUrl}
              descriptionNumberOfLines={2}
              descriptionStyle={{ color: colors.mutedStrong }}
              onPress={() => openEditCamera(camera.id)}
              right={() => (
                <Button compact textColor={colors.danger} onPress={() => openRemoveCamera(camera.id)}>
                  Remove
                </Button>
              )}
            />
          ))
        )}
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Notifications</List.Subheader>
        <List.Item
          title="Push alerts"
          titleStyle={{ fontWeight: '700' }}
          right={() => <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Units</List.Subheader>
        <List.Item
          title="Temperature"
          titleStyle={{ fontWeight: '700' }}
          description={tempUnit === 'C' ? '°C' : '°F'}
          descriptionStyle={{ color: colors.mutedStrong }}
          onPress={() => setTempUnit(tempUnit === 'C' ? 'F' : 'C')}
        />
        <List.Item
          title="TDS"
          titleStyle={{ fontWeight: '700' }}
          description={tdsUnit === 'ppm' ? 'ppm' : 'EC (mock)'}
          descriptionStyle={{ color: colors.mutedStrong }}
          onPress={() => setTdsUnit(tdsUnit === 'ppm' ? 'ec' : 'ppm')}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Data sync</List.Subheader>
        <List.Item
          title="Firebase Realtime DB"
          titleStyle={{ fontWeight: '700' }}
          description={
            !isFirebaseConfigured()
              ? getFirebaseConfigErrorMessage() ?? 'Not configured'
              : firebaseRtdbConnected
                ? 'Connected'
                : 'Disconnected'
          }
          descriptionStyle={{ color: colors.mutedStrong }}
        />
        <List.Item
          title="Legacy mock sync"
          titleStyle={{ fontWeight: '700' }}
          description="Ponds / alerts / thresholds remain mock in Stage 1"
          descriptionStyle={{ color: colors.mutedStrong }}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>App theme</List.Subheader>
        <List.Item
          title="Theme preference"
          titleStyle={{ fontWeight: '700' }}
          description={themePref}
          descriptionStyle={{ color: colors.mutedStrong }}
          onPress={() => setThemePref(themePref === 'light' ? 'system' : 'light')}
        />
      </List.Section>
      <Divider />
      <List.Section>
        <List.Subheader style={{ color: colors.mutedStrong, fontWeight: '800' }}>Support</List.Subheader>
        <List.Item title="Help & Support" titleStyle={{ fontWeight: '700' }} onPress={() => {}} />
        <List.Item title="About AquaNode" titleStyle={{ fontWeight: '700' }} description="v1.0.0 UI prototype" descriptionStyle={{ color: colors.mutedStrong }} />
      </List.Section>

      <View style={{ paddingVertical: spacing.xl }}>
        <List.Item
          title="Logout"
          titleStyle={{ color: colors.danger, fontWeight: '900' }}
          onPress={async () => {
            await logout();
            router.replace('/login');
          }}
        />
      </View>
      <Text style={{ color: colors.mutedStrong, marginBottom: spacing.xxl, lineHeight: 20, fontSize: 13 }}>
        AquaNode Stage 1: live telemetry for one registered ESP32 via Firebase; BLE provisioning requires a development build.
      </Text>
      <Portal>
        <Dialog visible={cameraDialogVisible} onDismiss={closeCameraDialog}>
          <Dialog.Title>{editingCameraId ? 'Edit CCTV camera' : 'Add CCTV camera'}</Dialog.Title>
          <Dialog.Content>
            <View style={{ gap: spacing.md }}>
              <TextInput mode="outlined" label="Camera name" value={cameraName} onChangeText={setCameraName} />
              <TextInput
                mode="outlined"
                label="Camera URL"
                value={cameraUrl}
                onChangeText={setCameraUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TextInput mode="outlined" label="Location optional" value={cameraLocation} onChangeText={setCameraLocation} />
              {cameraError ? <Text style={{ color: colors.danger, fontWeight: '700' }}>{cameraError}</Text> : null}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            {editingCameraId ? (
              <Button textColor={colors.danger} onPress={() => void deleteEditingCamera()}>
                Delete
              </Button>
            ) : null}
            <Button onPress={closeCameraDialog}>Cancel</Button>
            <Button mode="contained" onPress={() => void saveCamera()}>
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={!!removeCameraId} onDismiss={() => setRemoveCameraId(null)}>
          <Dialog.Title>Remove CCTV camera?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: colors.mutedStrong, lineHeight: 20 }}>
              {removeCamera
                ? `Remove ${removeCamera.name} from the dashboard CCTV carousel?`
                : 'Remove this CCTV camera from the dashboard carousel?'}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRemoveCameraId(null)}>Cancel</Button>
            <Button mode="contained" buttonColor={colors.danger} textColor="#FFFFFF" onPress={() => void runRemoveCamera()}>
              Remove
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </AppScreen>
  );
}
