import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { issueQrPayload, registerQrScan } from '@/services/connection-service';
import type { QrPayload } from '@/types/domain';

export default function ConnectScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const [qrPayload, setQrPayload] = useState<QrPayload | null>(null);
    const [scanned, setScanned] = useState(false);

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

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={{ textAlign: 'center', marginTop: 100 }}>We need your permission to show the camera</Text>
                <TouchableOpacity onPress={requestPermission} style={styles.button}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleBarcodeScanned = async ({ data }: { data: string }) => {
        setScanned(true);

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

            if (result.status === 'connected') {
                Alert.alert('Connected!', 'You are now connected with this user.', [
                    { text: 'OK', onPress: () => router.push('/manage-connections' as any) },
                ]);
                return;
            }

            Alert.alert('Scan registered', 'Now both users must confirm to activate the connection.', [
                {
                    text: 'Continue',
                    onPress: () => router.push(`/handshake/${result.handshake_id}` as any),
                },
            ]);
            return;
        } catch (error: any) {
            Alert.alert('Scan failed', error?.message ?? 'This does not appear to be a valid Planny code.');
        }

        setTimeout(() => setScanned(false), 3000);
    };

    const qrData = JSON.stringify(qrPayload);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <X size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.title}>New Connection</Text>
                <View style={{ width: 28 }} />
            </View>

            <Text style={styles.instructions}>
                Both of you need to scan each other&apos;s QR codes to confirm the connection.
            </Text>

            <View style={styles.qrContainer}>
                {qrPayload ? (
                    <QRCode
                        value={qrData}
                        size={200}
                        color="#111"
                        logoBackgroundColor='transparent'
                    />
                ) : (
                    <Text>Loading...</Text>
                )}
            </View>

            <View style={styles.cameraContainer}>
                <CameraView
                    style={styles.camera}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr'],
                    }}
                />
                <View pointerEvents="none" style={styles.cameraOverlay}>
                    <View style={styles.scanTarget} />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        marginBottom: 20,
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
        marginBottom: 30,
    },
    qrContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        backgroundColor: '#F9F9F9',
        marginHorizontal: 40,
        borderRadius: 24,
        marginBottom: 30,
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    camera: {
        flex: 1,
        width: '100%',
    },
    cameraOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanTarget: {
        width: 200,
        height: 200,
        borderWidth: 2,
        borderColor: '#FF9500',
        backgroundColor: 'transparent',
    },
    button: {
        backgroundColor: '#FF9500',
        padding: 16,
        borderRadius: 12,
        marginTop: 16,
    },
    buttonText: {
        color: '#fff',
        textAlign: 'center',
        fontWeight: '600',
    },
});
