import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmHandshake, getHandshake, issueQrPayload, registerQrScan } from '@/services/connection-service';
import type { ConnectionHandshake, HandshakeScanResult, QrPayload } from '@/types/domain';

export default function ConnectScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [qrPayload, setQrPayload] = useState<QrPayload | null>(null);
  const [isHandlingScan, setIsHandlingScan] = useState(false);
  const [activeHandshakeId, setActiveHandshakeId] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<HandshakeScanResult | null>(null);
  const [handshake, setHandshake] = useState<ConnectionHandshake | null>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const shortestSide = Math.min(width, height);
  const isLargeLayout = width >= 960;
  const scanResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigatedToCelebrationRef = useRef(false);
  const hasTriggeredLegacyAutoConfirmRef = useRef<string | null>(null);
  const hasSavedScan = Boolean(activeHandshakeId);
  const qrSize = Math.round(Math.min(Math.max(shortestSide * 0.45, 200), isLargeLayout ? 300 : 260));
  const scanTargetSize = Math.round(Math.min(Math.max(shortestSide * 0.62, 220), isLargeLayout ? 340 : 300));
  const scanGuidance =
    Platform.OS === 'web'
      ? 'Move the QR code closer until it fills most of the frame. The orange box is only a guide on laptop and desktop cameras.'
      : 'Move the QR code closer until it fills most of the frame. The orange box is only a guide.';
  const isConnected = useMemo(
    () => handshake?.status === 'connected' || scanResult?.status === 'connected',
    [handshake?.status, scanResult?.status]
  );
  const scan1At = handshake?.scan_1_at ?? scanResult?.scan_1_at ?? null;
  const scan2At = handshake?.scan_2_at ?? scanResult?.scan_2_at ?? null;
  const bothScansRecorded = Boolean(scan1At && scan2At);
  const awaitingOtherScan = hasSavedScan && !isConnected && !bothScansRecorded;
  const finalizingConnection = hasSavedScan && bothScansRecorded && !isConnected;
  const instructionsText = finalizingConnection
    ? "Both QR codes have been scanned. We're finishing the connection now."
    : awaitingOtherScan
    ? 'Your scan is saved. Keep your QR code visible so the other person can scan it and finish the connection.'
    : "Both of you need to scan each other's QR codes. The second scan connects you automatically.";
  const qrHintText = finalizingConnection
    ? 'Keep this screen open for a moment while Planny finishes connecting both accounts.'
    : awaitingOtherScan
    ? 'Leave this screen open until the other person scans this code from their device.'
    : 'Keep this QR code visible while the other person scans it.';
  const cameraHint = finalizingConnection
    ? 'Both scans are in. The camera is paused while the connection is finalized.'
    : awaitingOtherScan
    ? 'This device is now waiting. The camera is paused here so the other person can scan the QR code above.'
    : scanGuidance;

  const scheduleScanReset = useCallback(() => {
    if (scanResetTimeoutRef.current) {
      clearTimeout(scanResetTimeoutRef.current);
    }

    scanResetTimeoutRef.current = setTimeout(() => {
      setIsHandlingScan(false);
      scanResetTimeoutRef.current = null;
    }, 1200);
  }, []);

  const refreshHandshake = useCallback(
    async (silent = false) => {
      if (!activeHandshakeId) return;

      try {
        const data = await getHandshake(activeHandshakeId);
        setHandshake(data);
      } catch (error: any) {
        if (!silent) {
          Alert.alert('Connection status unavailable', error?.message ?? 'Could not refresh the scan status.');
        }
      }
    },
    [activeHandshakeId]
  );

  useEffect(() => {
    const refreshPayload = async () => {
      try {
        const payload = await issueQrPayload();
        setQrPayload(payload);
      } catch (error: any) {
        Alert.alert('Could not generate QR code', error?.message ?? 'Unknown error');
      }
    };

    void refreshPayload();
    const interval = setInterval(() => {
      void refreshPayload();
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (scanResetTimeoutRef.current) {
        clearTimeout(scanResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!activeHandshakeId || isConnected) {
      return;
    }

    void refreshHandshake(true);
    const interval = setInterval(() => {
      void refreshHandshake(true);
    }, 1500);

    return () => clearInterval(interval);
  }, [activeHandshakeId, isConnected, refreshHandshake]);

  useEffect(() => {
    if (!activeHandshakeId || !bothScansRecorded || isConnected) {
      return;
    }

    if (hasTriggeredLegacyAutoConfirmRef.current === activeHandshakeId) {
      return;
    }

    hasTriggeredLegacyAutoConfirmRef.current = activeHandshakeId;
    let isCancelled = false;

    const finalizeLegacyHandshake = async () => {
      try {
        const result = await confirmHandshake(activeHandshakeId);
        if (isCancelled) {
          return;
        }

        setScanResult((current) => {
          if (!current || current.handshake_id !== result.handshake_id) {
            return current;
          }

          return {
            ...current,
            status: result.status,
            connection_id: result.connection_id,
          };
        });

        await refreshHandshake(true);
      } catch (error: any) {
        if (isCancelled) {
          return;
        }

        hasTriggeredLegacyAutoConfirmRef.current = null;
        Alert.alert(
          'Connection still finalizing',
          error?.message ??
            'Both scans were recorded, but Planny could not finish the connection automatically.'
        );
      }
    };

    void finalizeLegacyHandshake();

    return () => {
      isCancelled = true;
    };
  }, [activeHandshakeId, bothScansRecorded, isConnected, refreshHandshake]);

  useEffect(() => {
    if (!activeHandshakeId || !isConnected || hasNavigatedToCelebrationRef.current) {
      return;
    }

    hasNavigatedToCelebrationRef.current = true;
    router.replace(`/handshake/${activeHandshakeId}` as any);
  }, [activeHandshakeId, isConnected]);

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
      <TouchableOpacity
        accessibilityLabel="Go back"
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <ArrowLeft size={24} color="#111" />
      </TouchableOpacity>
      <Text style={styles.title}>New Connection</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!permission) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.stateContainer}>
          <ActivityIndicator color="#FF9500" size="large" />
          <Text style={styles.stateText}>Preparing the camera...</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Camera access needed</Text>
          <Text style={styles.stateText}>
            Allow camera access so you can scan the other person&apos;s QR code and connect automatically.
          </Text>
          <TouchableOpacity onPress={requestPermission} style={styles.button}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    setIsHandlingScan(true);

    try {
      const parsedData = JSON.parse(data);
      if (!parsedData.userId || !parsedData.token || !parsedData.expiresAt) {
        throw new Error('Invalid payload');
      }

      const result = await registerQrScan({
        userId: parsedData.userId,
        token: parsedData.token,
        expiresAt: parsedData.expiresAt,
      });

      setActiveHandshakeId(result.handshake_id);
      setScanResult(result);
      setHandshake(null);

      if (result.status !== 'connected') {
        void refreshHandshake(true);
      }
    } catch (error: any) {
      Alert.alert('Scan failed', error?.message ?? 'This does not appear to be a valid Planny code.');
    } finally {
      scheduleScanReset();
    }
  };

  const qrData = JSON.stringify(qrPayload);

  return (
    <View style={styles.container}>
      {renderHeader()}

      <Text style={styles.instructions}>{instructionsText}</Text>

      <View style={[styles.qrContainer, isLargeLayout && styles.qrContainerLarge]}>
        {qrPayload ? (
          <>
            <QRCode
              value={qrData}
              size={qrSize}
              color="#111"
              logoBackgroundColor="transparent"
            />
            <Text style={styles.qrHint}>{qrHintText}</Text>
          </>
        ) : (
          <Text>Loading...</Text>
        )}
      </View>

      {awaitingOtherScan || finalizingConnection ? (
        <View style={styles.progressCard}>
          <Text style={styles.progressEyebrow}>Connection progress</Text>
          <Text style={styles.progressTitle}>
            {finalizingConnection ? 'Both scans received' : 'Waiting for the other person to scan yours'}
          </Text>
          <Text style={styles.progressText}>
            {finalizingConnection
              ? 'We have both QR scans. Finishing the connection now and opening the celebration as soon as the backend confirms it.'
              : 'As soon as they scan your QR code, both devices will switch into the connection celebration automatically.'}
          </Text>
        </View>
      ) : null}

      <View style={styles.scanSection}>
        <Text style={styles.scanTitle}>
          {finalizingConnection
            ? 'Finishing the connection'
            : awaitingOtherScan
              ? 'Your QR is now live'
              : 'Scan their QR code'}
        </Text>
        <Text style={styles.scanHint}>{cameraHint}</Text>
      </View>

      <View style={[styles.cameraContainer, isLargeLayout && styles.cameraContainerLarge]}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={isHandlingScan || awaitingOtherScan || finalizingConnection ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
        <View
          pointerEvents="none"
          style={[styles.cameraOverlay, (awaitingOtherScan || finalizingConnection) && styles.cameraOverlayPaused]}
        >
          <View style={[styles.scanTarget, { width: scanTargetSize, height: scanTargetSize }]} />
          <Text style={styles.overlayHint}>
            {finalizingConnection
              ? 'Both scans are recorded. Planny is finishing the connection now.'
              : awaitingOtherScan
              ? 'Scanner paused on this device while the other person scans the QR above.'
              : 'It does not need to fit perfectly inside the frame.'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginBottom: 16,
    position: 'relative',
    zIndex: 2,
    elevation: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  headerSpacer: {
    width: 44,
    height: 44,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  instructions: {
    paddingHorizontal: 24,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 23,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stateTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  stateText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
    backgroundColor: '#F9F9F9',
    marginHorizontal: 24,
    borderRadius: 24,
    marginBottom: 20,
  },
  qrContainerLarge: {
    marginHorizontal: 40,
  },
  qrHint: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    textAlign: 'center',
    maxWidth: 320,
  },
  progressCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F2D8AA',
    backgroundColor: '#FFF8EE',
    gap: 12,
  },
  progressEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#A15C00',
    textTransform: 'uppercase',
  },
  progressTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  progressText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
  },
  scanSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  scanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  scanHint: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'relative',
    zIndex: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 320,
  },
  cameraContainerLarge: {
    marginHorizontal: 24,
    marginBottom: 24,
    borderRadius: 24,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.36)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOverlayPaused: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanTarget: {
    borderWidth: 3,
    borderColor: '#FF9500',
    backgroundColor: 'transparent',
    borderRadius: 30,
  },
  overlayHint: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FF9500',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
});
